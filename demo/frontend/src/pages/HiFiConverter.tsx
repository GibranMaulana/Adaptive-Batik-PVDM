import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { AlertCircle, ArrowUpRight, Loader2, Sparkles } from 'lucide-react';
import { embedPayloadStream, fetchHealth, fetchSamples } from '../api/client';
import type {
  EmbedStreamEvent,
  HealthResponse,
  LiveSchemeStatus,
  RowTraceEntry,
  SampleSummary,
  SchemeEmbedResult,
  SchemeLiveState,
  SchemeName,
} from '../api/types';
import {
  FourImageComparison,
  type ComparisonViewMode,
} from '../components/hifi/FourImageComparison';
import { HiFiExtractor, type HiFiPreloadExtract } from '../components/hifi/HiFiExtractor';
import { SchemeCalculationLog } from '../components/hifi/SchemeCalculationLog';
import { TopSampleSlider } from '../components/hifi/TopSampleSlider';
import {
  ALL_SCHEMES,
  SAMPLE_MESSAGE,
  formatBytes,
  generateDeterministicPayload,
  utf8ByteLength,
} from '../utils/payload';

gsap.registerPlugin(useGSAP);

type ActiveMode = 'embed' | 'extract';
type EmbedStage = 'compose' | 'results';

interface HiFiConverterProps {
  onNavigate: (path: string) => void;
}

interface SchemeQueue {
  rows: Array<{ row: RowTraceEntry; totalRows: number }>;
  pendingResult: SchemeEmbedResult | null;
  rafId: number | null;
  lastFlushAt: number;
  knownTotalRows: number;
}

const FEATURED_ORDER = ['parang_01.png', 'kawung_01.png', 'megamendung_01.png'] as const;

const PAYLOAD_PRESETS: { label: string; bytes: number }[] = [
  { label: '1 KB', bytes: 1024 },
  { label: '10 KB', bytes: 10 * 1024 },
  { label: '50 KB', bytes: 50 * 1024 },
];

function sampleKey(sample: Pick<SampleSummary, 'motif' | 'filename'>): string {
  return `${sample.motif}/${sample.filename}`;
}

function orderSamplesFeaturedFirst(samples: SampleSummary[]): SampleSummary[] {
  const featured: SampleSummary[] = [];
  for (const filename of FEATURED_ORDER) {
    const match = samples.find((s) => s.filename === filename);
    if (match) {
      featured.push(match);
    }
  }

  const featuredKeys = new Set(featured.map((s) => sampleKey(s)));
  const rest = samples.filter((s) => !featuredKeys.has(sampleKey(s)));
  return [...featured, ...rest];
}

function pickDefaultSample(samples: SampleSummary[]): SampleSummary | null {
  if (samples.length === 0) return null;
  return (
    samples.find((s) => s.motif === 'parang' && s.filename === 'parang_01.png') ??
    samples.find((s) => s.featured) ??
    samples[0]
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function createInitialSchemeStates(): Record<SchemeName, SchemeLiveState> {
  return {
    scheme1: {
      scheme: 'scheme1',
      status: 'processing',
      analysis: null,
      rows: [],
      totalRows: 0,
      result: null,
      pendingStegoBase64: null,
      errorMessage: null,
    },
    scheme2: {
      scheme: 'scheme2',
      status: 'processing',
      analysis: null,
      rows: [],
      totalRows: 0,
      result: null,
      pendingStegoBase64: null,
      errorMessage: null,
    },
    scheme3: {
      scheme: 'scheme3',
      status: 'processing',
      analysis: null,
      rows: [],
      totalRows: 0,
      result: null,
      pendingStegoBase64: null,
      errorMessage: null,
    },
  };
}

function createEmptyQueues(): Record<SchemeName, SchemeQueue> {
  return {
    scheme1: { rows: [], pendingResult: null, rafId: null, lastFlushAt: 0, knownTotalRows: 0 },
    scheme2: { rows: [], pendingResult: null, rafId: null, lastFlushAt: 0, knownTotalRows: 0 },
    scheme3: { rows: [], pendingResult: null, rafId: null, lastFlushAt: 0, knownTotalRows: 0 },
  };
}

function getAdaptivePacing(totalRows: number): { intervalMs: number; batchSize: number } {
  if (totalRows <= 10) {
    return { intervalMs: 120, batchSize: 1 };
  }
  if (totalRows <= 60) {
    return { intervalMs: 35, batchSize: 1 };
  }
  if (totalRows <= 180) {
    return { intervalMs: Math.max(16, Math.round(2200 / totalRows)), batchSize: 1 };
  }
  return {
    intervalMs: 18,
    batchSize: Math.max(2, Math.min(4, Math.ceil(totalRows / 150))),
  };
}

function mapResultStatus(status: SchemeEmbedResult['status']): LiveSchemeStatus {
  if (status === 'ok') return 'completed';
  if (status === 'overflow') return 'overflow';
  return 'failed';
}

export function HiFiConverter({ onNavigate }: HiFiConverterProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const topSliderRef = useRef<HTMLDivElement | null>(null);
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const composeCaptionRef = useRef<HTMLDivElement | null>(null);
  const heroImgRef = useRef<HTMLImageElement | null>(null);
  const bottomComposerRef = useRef<HTMLDivElement | null>(null);

  const exitTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queuesRef = useRef<Record<SchemeName, SchemeQueue>>(createEmptyQueues());
  const skipPacingRef = useRef(false);
  const receivedAnyStreamEventRef = useRef(false);

  const prevSampleKeyRef = useRef<string>('');
  const embedRequestIdRef = useRef(0);
  const extractCounterRef = useRef(0);

  const [activeMode, setActiveMode] = useState<ActiveMode>('embed');
  const [embedStage, setEmbedStage] = useState<EmbedStage>('compose');

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthOffline, setHealthOffline] = useState(false);

  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState<SampleSummary | null>(null);

  const [message, setMessage] = useState<string>(SAMPLE_MESSAGE);
  const [isTransitioningOut, setIsTransitioningOut] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ComparisonViewMode>('stego');
  const [hasPendingPacing, setHasPendingPacing] = useState(false);
  const [embedRunId, setEmbedRunId] = useState(0);

  const [schemeStates, setSchemeStates] = useState<Record<SchemeName, SchemeLiveState>>(
    createInitialSchemeStates,
  );
  const [activeRunMeta, setActiveRunMeta] = useState<{
    motif: string;
    filename: string;
    imageUrl: string;
    width: number;
    height: number;
    payloadBytes: number;
  } | null>(null);

  const [preloadExtract, setPreloadExtract] = useState<HiFiPreloadExtract | null>(null);

  const clearAllQueueTimers = useCallback(() => {
    for (const scheme of ALL_SCHEMES) {
      const queue = queuesRef.current[scheme];
      if (queue.rafId !== null) {
        window.cancelAnimationFrame(queue.rafId);
        queue.rafId = null;
      }
      queue.rows = [];
      queue.pendingResult = null;
      queue.lastFlushAt = 0;
      queue.knownTotalRows = 0;
    }
    setHasPendingPacing(false);
  }, []);

  const abortActiveStream = useCallback(() => {
    embedRequestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    exitTimelineRef.current?.kill();
    exitTimelineRef.current = null;
    clearAllQueueTimers();
    setIsStreaming(false);
    setIsTransitioningOut(false);
  }, [clearAllQueueTimers]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      exitTimelineRef.current?.kill();
    };
  }, []);

  useEffect(() => {
    const queues = queuesRef.current;
    return () => {
      for (const scheme of ALL_SCHEMES) {
        const rafId = queues[scheme].rafId;
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
          queues[scheme].rafId = null;
        }
      }
    };
  }, []);

  const refreshPendingPacingFlag = useCallback(() => {
    const pending = ALL_SCHEMES.some(
      (scheme) =>
        queuesRef.current[scheme].rows.length > 0 ||
        queuesRef.current[scheme].pendingResult !== null,
    );
    setHasPendingPacing(pending);
  }, []);

  const loadCatalogAndHealth = useCallback(async () => {
    fetchHealth()
      .then((res) => {
        setHealth(res);
        setHealthOffline(false);
      })
      .catch(() => {
        setHealthOffline(true);
      });

    try {
      const catalog = await fetchSamples();
      const ordered = orderSamplesFeaturedFirst(catalog.samples);
      setSamples(ordered);
      setSamplesError(null);
      setSelectedSample((current) => {
        if (current) {
          const match = ordered.find(
            (s) => s.motif === current.motif && s.filename === current.filename,
          );
          if (match) return match;
        }
        return pickDefaultSample(ordered);
      });
    } catch (err) {
      setSamplesError(err instanceof Error ? err.message : 'Unable to reach /api/samples.');
    } finally {
      setSamplesLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((res) => {
        if (!active) return;
        setHealth(res);
        setHealthOffline(false);
      })
      .catch(() => {
        if (!active) return;
        setHealthOffline(true);
      });

    fetchSamples()
      .then((catalog) => {
        if (!active) return;
        const ordered = orderSamplesFeaturedFirst(catalog.samples);
        setSamples(ordered);
        setSamplesError(null);
        setSelectedSample((current) => current ?? pickDefaultSample(ordered));
      })
      .catch((err) => {
        if (!active) return;
        setSamplesError(err instanceof Error ? err.message : 'Unable to reach /api/samples.');
      })
      .finally(() => {
        if (active) {
          setSamplesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const orderedSamples = useMemo(() => orderSamplesFeaturedFirst(samples), [samples]);
  const selectedSampleKey = selectedSample ? sampleKey(selectedSample) : '';

  const payloadBytes = utf8ByteLength(message);
  const s1Max = selectedSample?.capacities.scheme1.max_payload_bytes ?? null;
  const s1Overflow = s1Max !== null && payloadBytes > s1Max;

  // 1. Hero image swap animation when picking a different sample in compose
  useGSAP(
    () => {
      if (!selectedSampleKey) return;
      const prevKey = prevSampleKeyRef.current;
      prevSampleKeyRef.current = selectedSampleKey;

      if (!prevKey || prevKey === selectedSampleKey) return;
      if (activeMode !== 'embed' || embedStage !== 'compose') return;

      const heroImg = heroImgRef.current;
      if (!heroImg) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          isMotionOk: '(prefers-reduced-motion: no-preference)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          if (!context.conditions?.isMotionOk || context.conditions?.reduceMotion) return;

          gsap.fromTo(
            heroImg,
            { opacity: 0.25, scale: 0.94, y: 8 },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.45,
              ease: 'power3.out',
              clearProps: 'transform,opacity',
            },
          );
        },
        stageRef,
      );

      return () => mm.revert();
    },
    { scope: stageRef, dependencies: [selectedSampleKey] },
  );

  // 2. Stage enter animations for compose, results, and extract
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          isMotionOk: '(prefers-reduced-motion: no-preference)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          if (!context.conditions?.isMotionOk || context.conditions?.reduceMotion) return;

          if (activeMode === 'extract') {
            gsap.from('.extract-stage', {
              y: 16,
              autoAlpha: 0,
              duration: 0.42,
              ease: 'power3.out',
              clearProps: 'transform,opacity,visibility',
            });
            return;
          }

          if (embedStage === 'compose') {
            const tl = gsap.timeline();
            if (topSliderRef.current) {
              tl.fromTo(
                topSliderRef.current,
                { y: -16, autoAlpha: 0 },
                {
                  y: 0,
                  autoAlpha: 1,
                  duration: 0.36,
                  ease: 'power3.out',
                  clearProps: 'transform,opacity,visibility',
                },
                0,
              );
            }
            if (heroSectionRef.current) {
              tl.fromTo(
                heroSectionRef.current,
                { scale: 0.97, autoAlpha: 0 },
                {
                  scale: 1,
                  autoAlpha: 1,
                  duration: 0.4,
                  ease: 'power3.out',
                  clearProps: 'transform,opacity,visibility',
                },
                0.04,
              );
            }
            if (bottomComposerRef.current) {
              tl.fromTo(
                bottomComposerRef.current,
                { y: 18, autoAlpha: 0 },
                {
                  y: 0,
                  autoAlpha: 1,
                  duration: 0.38,
                  ease: 'power3.out',
                  clearProps: 'transform,opacity,visibility',
                },
                0.08,
              );
            }
            return;
          }

          if (embedStage === 'results') {
            gsap.fromTo(
              '.results-card-enter',
              { y: 18, autoAlpha: 0 },
              {
                y: 0,
                autoAlpha: 1,
                duration: 0.42,
                stagger: 0.06,
                ease: 'power3.out',
                clearProps: 'transform,opacity,visibility',
              },
            );
            gsap.fromTo(
              '.results-log-enter',
              { y: 22, autoAlpha: 0 },
              {
                y: 0,
                autoAlpha: 1,
                duration: 0.46,
                stagger: 0.08,
                delay: 0.1,
                ease: 'power3.out',
                clearProps: 'transform,opacity,visibility',
              },
            );
          }
        },
        stageRef,
      );

      return () => mm.revert();
    },
    { scope: stageRef, dependencies: [activeMode, embedStage] },
  );

  // Per-scheme non-blocking requestAnimationFrame row pacing
  const scheduleSchemeDrain = useCallback(
    function drainScheme(scheme: SchemeName, reqId: number) {
      const queue = queuesRef.current[scheme];
      if (queue.rafId !== null) return;

      const tick = (now: number) => {
        queue.rafId = null;
        if (embedRequestIdRef.current !== reqId) return;

        const effectiveTotal = Math.max(queue.knownTotalRows, queue.rows.length, 1);
        const { intervalMs, batchSize } = getAdaptivePacing(effectiveTotal);

        const hasRows = queue.rows.length > 0;
        const readyForNextFlush = queue.lastFlushAt === 0 || now - queue.lastFlushAt >= intervalMs;

        if (hasRows && readyForNextFlush) {
          queue.lastFlushAt = now;
          const batch = queue.rows.splice(0, batchSize);
          const finishedAllQueuedRows = queue.rows.length === 0;
          const resultToApply = finishedAllQueuedRows ? queue.pendingResult : null;
          if (resultToApply) {
            queue.pendingResult = null;
          }

          setSchemeStates((prev) => {
            const current = prev[scheme];
            const addedRows = batch.map((item) => item.row);
            const lastTotal = batch[batch.length - 1]?.totalRows ?? current.totalRows;

            return {
              ...prev,
              [scheme]: {
                ...current,
                rows: [...current.rows, ...addedRows],
                totalRows: Math.max(current.totalRows, lastTotal),
                ...(resultToApply
                  ? {
                      status: mapResultStatus(resultToApply.status),
                      result: resultToApply,
                      pendingStegoBase64:
                        resultToApply.stego_png_base64 ?? current.pendingStegoBase64,
                      errorMessage: resultToApply.error,
                    }
                  : {}),
              },
            };
          });
        } else if (!hasRows && queue.pendingResult !== null) {
          const resultToApply = queue.pendingResult;
          queue.pendingResult = null;
          setSchemeStates((prev) => ({
            ...prev,
            [scheme]: {
              ...prev[scheme],
              status: mapResultStatus(resultToApply.status),
              result: resultToApply,
              pendingStegoBase64:
                resultToApply.stego_png_base64 ?? prev[scheme].pendingStegoBase64,
              errorMessage: resultToApply.error,
            },
          }));
        }

        if (queue.rows.length > 0 || queue.pendingResult !== null) {
          queue.rafId = window.requestAnimationFrame(tick);
        } else {
          refreshPendingPacingFlag();
        }
      };

      queue.rafId = window.requestAnimationFrame(tick);
    },
    [refreshPendingPacingFlag],
  );

  const handleSkipPacing = useCallback(() => {
    skipPacingRef.current = true;

    const drained: Partial<
      Record<
        SchemeName,
        { rows: RowTraceEntry[]; totalRows: number; result: SchemeEmbedResult | null }
      >
    > = {};
    for (const scheme of ALL_SCHEMES) {
      const queue = queuesRef.current[scheme];
      if (queue.rafId !== null) {
        window.cancelAnimationFrame(queue.rafId);
        queue.rafId = null;
      }
      if (queue.rows.length > 0 || queue.pendingResult !== null) {
        const lastTotal =
          queue.rows.length > 0
            ? queue.rows[queue.rows.length - 1].totalRows
            : queue.knownTotalRows;
        drained[scheme] = {
          rows: queue.rows.map((item) => item.row),
          totalRows: lastTotal,
          result: queue.pendingResult,
        };
        queue.rows = [];
        queue.pendingResult = null;
        queue.lastFlushAt = 0;
      }
    }

    setSchemeStates((prev) => {
      const next = { ...prev };
      for (const scheme of ALL_SCHEMES) {
        const patch = drained[scheme];
        if (!patch) continue;
        const current = prev[scheme];
        next[scheme] = {
          ...current,
          rows: [...current.rows, ...patch.rows],
          totalRows: Math.max(current.totalRows, patch.totalRows),
          ...(patch.result
            ? {
                status: mapResultStatus(patch.result.status),
                result: patch.result,
                pendingStegoBase64:
                  patch.result.stego_png_base64 ?? current.pendingStegoBase64,
                errorMessage: patch.result.error,
              }
            : {}),
        };
      }
      return next;
    });

    setHasPendingPacing(false);
  }, []);

  const handleStreamEvent = useCallback(
    (event: EmbedStreamEvent, reqId: number) => {
      if (embedRequestIdRef.current !== reqId) return;

      if (event.type === 'done') {
        setIsStreaming(false);
        return;
      }

      receivedAnyStreamEventRef.current = true;
      const scheme = event.scheme;

      if (event.type === 'scheme_start') {
        setSchemeStates((prev) => ({
          ...prev,
          [scheme]: {
            ...prev[scheme],
            analysis: {
              width: event.width,
              height: event.height,
              payload_bytes: event.payload_bytes,
              required_bits: event.required_bits,
              capacity: event.capacity,
            },
          },
        }));
        return;
      }

      if (event.type === 'scheme_row') {
        if (prefersReducedMotion() || skipPacingRef.current) {
          setSchemeStates((prev) => ({
            ...prev,
            [scheme]: {
              ...prev[scheme],
              rows: [...prev[scheme].rows, event.row],
              totalRows: Math.max(prev[scheme].totalRows, event.total_rows),
            },
          }));
        } else {
          const queue = queuesRef.current[scheme];
          queue.knownTotalRows = Math.max(queue.knownTotalRows, event.total_rows);
          queue.rows.push({
            row: event.row,
            totalRows: event.total_rows,
          });
          setHasPendingPacing(true);
          scheduleSchemeDrain(scheme, reqId);
        }
        return;
      }

      if (event.type === 'scheme_result') {
        const queue = queuesRef.current[scheme];
        const hasQueuedRows = queue.rows.length > 0;

        if (!hasQueuedRows || prefersReducedMotion() || skipPacingRef.current) {
          setSchemeStates((prev) => ({
            ...prev,
            [scheme]: {
              ...prev[scheme],
              status: mapResultStatus(event.result.status),
              result: event.result,
              pendingStegoBase64: event.result.stego_png_base64 ?? prev[scheme].pendingStegoBase64,
              errorMessage: event.result.error,
            },
          }));
        } else {
          // Give PixelRasterCanvas the real stego buffer while remaining rows tick out
          if (event.result.stego_png_base64) {
            setSchemeStates((prev) => ({
              ...prev,
              [scheme]: {
                ...prev[scheme],
                pendingStegoBase64: event.result.stego_png_base64,
              },
            }));
          }
          queue.pendingResult = event.result;
          setHasPendingPacing(true);
          scheduleSchemeDrain(scheme, reqId);
        }
      }
    },
    [scheduleSchemeDrain],
  );

  const handleEmbed = () => {
    if (!selectedSample || isTransitioningOut || isStreaming) return;

    abortActiveStream();
    const reqId = embedRequestIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    skipPacingRef.current = prefersReducedMotion();
    receivedAnyStreamEventRef.current = false;

    setEmbedError(null);
    setViewMode('stego');
    setEmbedRunId((prev) => prev + 1);
    setSchemeStates(createInitialSchemeStates());
    setActiveRunMeta({
      motif: selectedSample.motif,
      filename: selectedSample.filename,
      imageUrl: selectedSample.image_url,
      width: selectedSample.width,
      height: selectedSample.height,
      payloadBytes,
    });
    setIsStreaming(true);

    // Stream concurrently while GSAP exit transition plays
    embedPayloadStream(
      {
        motif: selectedSample.motif,
        filename: selectedSample.filename,
        message,
      },
      (event) => handleStreamEvent(event, reqId),
      controller.signal,
    )
      .then(() => {
        if (embedRequestIdRef.current !== reqId) return;
        setIsStreaming(false);
      })
      .catch((err) => {
        if (embedRequestIdRef.current !== reqId) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;

        const messageText = err instanceof Error ? err.message : 'Streaming embed failed.';
        setIsStreaming(false);
        setEmbedError(messageText);

        if (!receivedAnyStreamEventRef.current) {
          exitTimelineRef.current?.revert();
          exitTimelineRef.current = null;
          setIsTransitioningOut(false);
          setEmbedStage('compose');
        } else {
          // Mark any schemes still processing as failed without disturbing completed/overflow ones
          clearAllQueueTimers();
          setSchemeStates((prev) => {
            const next = { ...prev };
            for (const scheme of ALL_SCHEMES) {
              if (next[scheme].status === 'processing') {
                next[scheme] = {
                  ...next[scheme],
                  status: 'failed',
                  errorMessage: messageText,
                };
              }
            }
            return next;
          });
        }
      });

    if (prefersReducedMotion()) {
      setEmbedStage('results');
      return;
    }

    setIsTransitioningOut(true);
    const tl = gsap.timeline({
      onComplete: () => {
        if (exitTimelineRef.current === tl) {
          exitTimelineRef.current = null;
        }
        setIsTransitioningOut(false);
        if (embedRequestIdRef.current === reqId) {
          setEmbedStage('results');
        }
      },
    });
    exitTimelineRef.current = tl;

    if (topSliderRef.current) {
      tl.to(
        topSliderRef.current,
        { y: -24, autoAlpha: 0, duration: 0.24, ease: 'power2.in' },
        0,
      );
    }
    if (bottomComposerRef.current) {
      tl.to(
        bottomComposerRef.current,
        { y: 24, autoAlpha: 0, duration: 0.24, ease: 'power2.in' },
        0,
      );
    }
    if (composeCaptionRef.current) {
      tl.to(
        composeCaptionRef.current,
        { y: 8, autoAlpha: 0, duration: 0.18, ease: 'power2.in' },
        0,
      );
    }
    if (heroSectionRef.current) {
      tl.to(
        heroSectionRef.current,
        { scale: 0.96, autoAlpha: 0, duration: 0.26, ease: 'power2.inOut' },
        0.06,
      );
    }
  };

  const handleBackToCompose = () => {
    abortActiveStream();
    setEmbedError(null);
    setEmbedStage('compose');
  };

  const handleSwitchMode = (mode: ActiveMode) => {
    if (mode === activeMode) return;
    if (mode === 'extract') {
      abortActiveStream();
    }
    setActiveMode(mode);
  };

  const handleExtractFile = (file: File) => {
    abortActiveStream();
    extractCounterRef.current += 1;
    setPreloadExtract({ file, requestId: extractCounterRef.current });
    setActiveMode('extract');
  };

  return (
    <div className="min-h-dvh bg-[#F6F4EF] text-[#111110]">
      <header className="sticky top-0 z-30 h-14 border-b border-[#E4DFD3] bg-[#FDFCF9]/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1520px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="font-editorial text-xl tracking-tight text-[#111110] sm:text-2xl">
              BATIK PVDM
            </span>
            <span className="rounded border border-[#E4DFD3] bg-[#F6F4EF] px-1.5 py-0.5 text-[10px] font-medium tracking-[0.14em] text-[#9A6B2F] tabular-nums">
              HVS-RGB
            </span>
          </div>

          <div
            className="inline-flex rounded-full border border-[#E4DFD3] bg-[#F6F4EF] p-0.5"
            role="tablist"
            aria-label="Converter mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'embed'}
              onClick={() => handleSwitchMode('embed')}
              className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
                activeMode === 'embed'
                  ? 'bg-[#111110] text-[#FDFCF9]'
                  : 'text-[#6B665C] hover:text-[#111110]'
              }`}
            >
              Embed
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'extract'}
              onClick={() => handleSwitchMode('extract')}
              className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
                activeMode === 'extract'
                  ? 'bg-[#111110] text-[#FDFCF9]'
                  : 'text-[#6B665C] hover:text-[#111110]'
              }`}
            >
              Extract
            </button>
          </div>

          <div className="flex items-center gap-3">
            <a href="/how-it-works" className="hidden text-xs font-medium text-[#6B665C] hover:underline md:inline">How It Works</a>
            <div
              className="hidden items-center gap-1.5 text-[11px] text-[#6B665C] tabular-nums sm:inline-flex"
              title={health ? `API ${health.status} (${health.phase})` : 'API status'}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  health
                    ? 'bg-[#15803D]'
                    : healthOffline
                      ? 'bg-[#B45309]'
                      : 'motion-safe:animate-pulse bg-[#6B665C]'
                }`}
              />
              <span>{health ? 'API ok' : healthOffline ? 'offline' : 'checking'}</span>
            </div>

            <a
              href="/test"
              onClick={(e) => {
                e.preventDefault();
                abortActiveStream();
                onNavigate('/test');
              }}
              className="inline-flex items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2.5 py-1 text-[11px] text-[#6B665C] tabular-nums transition-colors hover:border-[#9A6B2F] hover:text-[#111110]"
            >
              <span>/test</span>
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </header>
      <div className="px-4 pt-2 text-right md:hidden">
        <a href="/how-it-works" className="text-xs font-medium text-[#6B665C] underline">How It Works</a>
      </div>

      <div ref={stageRef}>
        {activeMode === 'embed' && embedStage === 'compose' && (
          <main className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden">
            {/* Layer 1: Top Full-Width Slider */}
            <div
              ref={topSliderRef}
              className="absolute top-0 right-0 left-0 z-20 pt-4 will-change-transform"
            >
              <TopSampleSlider
                samples={orderedSamples}
                selectedSampleKey={selectedSampleKey}
                samplesLoading={samplesLoading}
                samplesError={samplesError}
                disabled={isTransitioningOut}
                onSelectSample={(sample) => setSelectedSample(sample)}
                onRetry={() => {
                  setSamplesLoading(true);
                  setSamplesError(null);
                  void loadCatalogAndHealth();
                }}
              />
            </div>

            {/* Layer 2: Centered Hero Sample */}
            <section
              ref={heroSectionRef}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 sm:p-6 will-change-transform"
            >
              <div className="relative flex items-center justify-center">
                <div className="relative aspect-square w-[clamp(190px,35vh,340px)] overflow-hidden rounded-2xl border border-[#E4DFD3] bg-[#FDFCF9] shadow-[0_24px_60px_-32px_rgba(17,17,16,0.28)]">
                  {selectedSample ? (
                    <img
                      ref={heroImgRef}
                      src={selectedSample.image_url}
                      alt={`${selectedSample.motif} ${selectedSample.filename}`}
                      className="h-full w-full object-cover will-change-transform"
                    />
                  ) : (
                    <div className="h-full w-full motion-safe:animate-pulse bg-[#EFECE3]" />
                  )}
                </div>

                {selectedSample && (
                  <div className="pointer-events-none absolute top-full left-1/2 mt-3 -translate-x-1/2">
                    <div
                      ref={composeCaptionRef}
                      className="compose-hero-caption whitespace-nowrap rounded-full border border-[#E4DFD3] bg-[#FDFCF9]/90 px-2.5 py-0.5 text-[11px] text-[#6B665C] tabular-nums will-change-transform"
                    >
                      {selectedSample.filename}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Layer 3: Bottom Message Composer */}
            <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 w-full max-w-[520px] -translate-x-1/2 px-4 pb-5">
              <div
                ref={bottomComposerRef}
                className="compose-bottom-composer pointer-events-auto w-full will-change-transform"
              >
                <textarea
                  id="hifi-payload-input"
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isTransitioningOut}
                  placeholder="Write a secret message..."
                  aria-label="Secret message"
                  className="w-full resize-none rounded-xl border border-[#E4DFD3] bg-[#FDFCF9] px-3.5 py-2.5 text-xs leading-relaxed text-[#111110] placeholder:text-[#6B665C]/65 transition-colors focus:border-[#9A6B2F] focus:outline-none disabled:opacity-70 sm:text-[13px]"
                />

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PAYLOAD_PRESETS.map((preset) => {
                      const activePreset = payloadBytes === preset.bytes;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          disabled={isTransitioningOut}
                          onClick={() => setMessage(generateDeterministicPayload(preset.bytes))}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors disabled:opacity-50 ${
                            activePreset
                              ? 'border-[#9A6B2F] bg-[#FDFCF9] text-[#9A6B2F]'
                              : 'border-[#E4DFD3] bg-[#FDFCF9] text-[#111110] hover:border-[#9A6B2F]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}

                    <span className="ml-1 text-[11px] text-[#6B665C] tabular-nums">
                      {formatBytes(payloadBytes)}
                    </span>

                    {s1Overflow && (
                      <span
                        className="rounded-full border border-[#B45309]/35 bg-[#B45309]/10 px-2 py-0.5 text-[10px] font-medium text-[#B45309] tabular-nums"
                        title={
                          s1Max !== null
                            ? `Exceeds Scheme 1 max (${formatBytes(s1Max)}); Scheme 2 & 3 embed cleanly`
                            : 'Exceeds Scheme 1 max capacity'
                        }
                      >
                        S1 overflow
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleEmbed}
                    disabled={!selectedSample || isTransitioningOut}
                    className="inline-flex items-center gap-2 rounded-full bg-[#111110] px-5 py-2 text-xs font-semibold tracking-wide text-[#FDFCF9] transition-colors hover:bg-[#9A6B2F] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#D5CEBE] disabled:text-[#6B665C]"
                  >
                    {isTransitioningOut ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Starting…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Embed to Stego</span>
                      </>
                    )}
                  </button>
                </div>

                {embedError && (
                  <p className="mt-2 truncate rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-800">
                    {embedError}
                  </p>
                )}
              </div>
            </div>
          </main>
        )}

        {activeMode === 'embed' && embedStage === 'results' && activeRunMeta && (
          <main className="mx-auto max-w-[1520px] px-4 py-4 sm:px-6 sm:py-5">
            {embedError && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs text-rose-900">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-700" />
                <span>{embedError}</span>
              </div>
            )}

            {/* Top Row: 4-Image Comparison Layout */}
            <FourImageComparison
              key={`comparison-${embedRunId}`}
              coverImageUrl={activeRunMeta.imageUrl}
              motif={activeRunMeta.motif}
              filename={activeRunMeta.filename}
              width={activeRunMeta.width}
              height={activeRunMeta.height}
              payloadBytes={activeRunMeta.payloadBytes}
              viewMode={viewMode}
              schemes={schemeStates}
              hasPendingPacing={hasPendingPacing}
              onBackToCompose={handleBackToCompose}
              onChangeViewMode={setViewMode}
              onSkipPacing={handleSkipPacing}
              onExtractFile={handleExtractFile}
            />

            {/* Bottom Row: 3 Independent Persistent Scrollable Calculation Log Panels */}
            <section
              aria-label="Per-scheme calculation logs"
              className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-3"
            >
              {ALL_SCHEMES.map((schemeName) => (
                <SchemeCalculationLog
                  key={`${schemeName}-${embedRunId}`}
                  state={schemeStates[schemeName]}
                />
              ))}
            </section>
          </main>
        )}

        {activeMode === 'extract' && (
          <main className="extract-stage will-change-transform">
            <HiFiExtractor
              key={preloadExtract?.requestId ?? 0}
              preloadRequest={preloadExtract}
            />
          </main>
        )}
      </div>
    </div>
  );
}
