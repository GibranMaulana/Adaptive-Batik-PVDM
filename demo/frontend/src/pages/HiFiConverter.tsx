import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { ArrowLeft, ArrowUpRight, Loader2, Sparkles } from 'lucide-react';
import { embedPayload, fetchHealth, fetchSamples } from '../api/client';
import type { EmbedResponse, HealthResponse, SampleSummary, SchemeName } from '../api/types';
import { HiFiExtractor, type HiFiPreloadExtract } from '../components/hifi/HiFiExtractor';
import type { GalleryViewMode } from '../components/hifi/SchemeResultCard';
import { StegoFocusPane } from '../components/hifi/StegoFocusPane';
import { StegoOverviewPane } from '../components/hifi/StegoOverviewPane';
import { TopSampleSlider } from '../components/hifi/TopSampleSlider';
import {
  ALL_SCHEMES,
  SAMPLE_MESSAGE,
  formatBytes,
  generateDeterministicPayload,
  utf8ByteLength,
} from '../utils/payload';

gsap.registerPlugin(useGSAP, Flip);

type ActiveMode = 'embed' | 'extract';
type EmbedStage = 'compose' | 'overview' | 'focus';

interface HiFiConverterProps {
  onNavigate: (path: string) => void;
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

export function HiFiConverter({ onNavigate }: HiFiConverterProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sampleFrameRef = useRef<HTMLDivElement | null>(null);
  const heroImgRef = useRef<HTMLImageElement | null>(null);
  const focusMediaRef = useRef<HTMLDivElement | null>(null);

  const pendingFlipStateRef = useRef<Flip.FlipState | null>(null);
  const stegoFlipStateRef = useRef<Flip.FlipState | null>(null);
  const overviewEnterNeedsBeat3Ref = useRef(false);
  const beat1TimelineRef = useRef<gsap.core.Timeline | null>(null);

  const prevSampleKeyRef = useRef<string>('');
  const prevFocusedSchemeRef = useRef<SchemeName | null>(null);
  const lastFocusedSchemeRef = useRef<SchemeName | null>(null);
  const focusSwitchDirRef = useRef<1 | -1>(1);

  const embedRequestIdRef = useRef(0);
  const extractCounterRef = useRef(0);

  const [activeMode, setActiveMode] = useState<ActiveMode>('embed');
  const [embedStage, setEmbedStage] = useState<EmbedStage>('compose');
  const [focusedScheme, setFocusedScheme] = useState<SchemeName | null>(null);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthOffline, setHealthOffline] = useState(false);

  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState<SampleSummary | null>(null);

  const [message, setMessage] = useState<string>(SAMPLE_MESSAGE);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [isTransitioningOut, setIsTransitioningOut] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [embedResult, setEmbedResult] = useState<EmbedResponse | null>(null);
  const [viewMode, setViewMode] = useState<GalleryViewMode>('stego');

  const [preloadExtract, setPreloadExtract] = useState<HiFiPreloadExtract | null>(null);

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
        { reduceMotion: '(prefers-reduced-motion: reduce)' },
        (context) => {
          if (context.conditions?.reduceMotion) return;

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

  // 2. Stage choreography: compose <-> overview <-> focus <-> extract
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: '(prefers-reduced-motion: reduce)' },
        (context) => {
          const reduceMotion = Boolean(context.conditions?.reduceMotion);
          if (reduceMotion) {
            pendingFlipStateRef.current = null;
            stegoFlipStateRef.current = null;
            overviewEnterNeedsBeat3Ref.current = false;
            return;
          }

          if (activeMode === 'extract') {
            pendingFlipStateRef.current = null;
            stegoFlipStateRef.current = null;
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
            const flipState = pendingFlipStateRef.current;
            pendingFlipStateRef.current = null;

            if (flipState && sampleFrameRef.current) {
              Flip.from(flipState, {
                duration: 0.58,
                ease: 'power3.inOut',
                scale: true,
                onComplete: () => {
                  if (sampleFrameRef.current) {
                    gsap.set(sampleFrameRef.current, { clearProps: 'transform' });
                  }
                },
              });
            } else if (sampleFrameRef.current) {
              gsap.fromTo(
                sampleFrameRef.current,
                { y: 12, opacity: 0 },
                {
                  y: 0,
                  opacity: 1,
                  duration: 0.42,
                  ease: 'power3.out',
                  clearProps: 'transform,opacity',
                },
              );
            }

            gsap.fromTo(
              '.compose-top-slider',
              { y: -18, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.4,
                delay: flipState ? 0.14 : 0.02,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
              },
            );

            gsap.fromTo(
              '.compose-bottom-composer',
              { y: 18, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.4,
                delay: flipState ? 0.16 : 0.05,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
              },
            );

            gsap.fromTo(
              '.compose-hero-caption',
              { y: 8, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.35,
                delay: flipState ? 0.18 : 0.06,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
              },
            );
            return;
          }

          if (embedStage === 'overview') {
            const heroFlipState = pendingFlipStateRef.current;
            pendingFlipStateRef.current = null;

            const stegoFlipState = stegoFlipStateRef.current;
            stegoFlipStateRef.current = null;

            const useBeat3Delay = overviewEnterNeedsBeat3Ref.current;
            overviewEnterNeedsBeat3Ref.current = false;

            // Beat 2: Seamless Flip of persistent hero sample from center -> left 50%
            if (heroFlipState && sampleFrameRef.current) {
              Flip.from(heroFlipState, {
                duration: 0.65,
                ease: 'power3.inOut',
                scale: true,
                onComplete: () => {
                  if (sampleFrameRef.current) {
                    gsap.set(sampleFrameRef.current, { clearProps: 'transform' });
                  }
                },
              });

              gsap.fromTo(
                '.split-left-chrome',
                { y: 10, opacity: 0 },
                {
                  y: 0,
                  opacity: 1,
                  duration: 0.4,
                  delay: 0.2,
                  ease: 'power3.out',
                  clearProps: 'transform,opacity',
                },
              );
            }

            // Returning from focus ("All 3")
            if (stegoFlipState && lastFocusedSchemeRef.current) {
              const targetTile = stageRef.current?.querySelector<HTMLElement>(
                `[data-flip-id="stego-${lastFocusedSchemeRef.current}"]`,
              );
              if (targetTile) {
                Flip.from(stegoFlipState, {
                  targets: targetTile,
                  duration: 0.44,
                  ease: 'power3.inOut',
                  scale: true,
                  onComplete: () => {
                    gsap.set(targetTile, { clearProps: 'transform' });
                  },
                });
              }

              const otherSlots = Array.from(
                stageRef.current?.querySelectorAll<HTMLElement>('.stego-overview-slot') ?? [],
              ).filter(
                (slot) =>
                  !slot.querySelector(`[data-flip-id="stego-${lastFocusedSchemeRef.current}"]`),
              );

              if (otherSlots.length > 0) {
                gsap.fromTo(
                  otherSlots,
                  { opacity: 0, y: 12 },
                  {
                    opacity: 1,
                    y: 0,
                    duration: 0.36,
                    stagger: 0.06,
                    delay: 0.08,
                    ease: 'power3.out',
                    clearProps: 'transform,opacity',
                  },
                );
              }
              return;
            }

            // Beat 3 (0.55s = 0.27s after Beat 2 starts at 0.28s): Stagger 3 stego slots on right 50%
            gsap.fromTo(
              '.stego-overview-slot',
              { x: 36, opacity: 0 },
              {
                x: 0,
                opacity: 1,
                duration: 0.5,
                stagger: 0.09,
                delay: useBeat3Delay ? 0.27 : 0.06,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
              },
            );
            return;
          }

          if (embedStage === 'focus') {
            const stegoFlipState = stegoFlipStateRef.current;
            stegoFlipStateRef.current = null;

            if (stegoFlipState && focusMediaRef.current) {
              Flip.from(stegoFlipState, {
                targets: focusMediaRef.current,
                duration: 0.48,
                ease: 'power3.inOut',
                scale: true,
                onComplete: () => {
                  if (focusMediaRef.current) {
                    gsap.set(focusMediaRef.current, { clearProps: 'transform' });
                  }
                },
              });
            } else {
              gsap.fromTo(
                '.focus-swap-content',
                { scale: 0.97, opacity: 0 },
                {
                  scale: 1,
                  opacity: 1,
                  duration: 0.4,
                  ease: 'power3.out',
                  clearProps: 'transform,opacity',
                },
              );
            }

            gsap.fromTo(
              '.focus-top-bar',
              { y: -10, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.34,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
              },
            );

            gsap.fromTo(
              '.focus-detail-stagger',
              { y: 14, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.38,
                stagger: 0.06,
                delay: 0.08,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
              },
            );
          }
        },
        stageRef,
      );

      return () => {
        mm.revert();
      };
    },
    { scope: stageRef, dependencies: [activeMode, embedStage] },
  );

  // 3. Fade stego images cleanly into the 3 overview slots as soon as embedResult arrives
  useGSAP(
    () => {
      if (!embedResult || activeMode !== 'embed' || embedStage !== 'overview') return;

      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: '(prefers-reduced-motion: reduce)' },
        (context) => {
          if (context.conditions?.reduceMotion) return;

          gsap.fromTo(
            '.stego-reveal-image',
            { opacity: 0, scale: 0.98 },
            {
              opacity: 1,
              scale: 1,
              duration: 0.45,
              stagger: 0.06,
              ease: 'power3.out',
              clearProps: 'transform,opacity',
            },
          );
        },
        stageRef,
      );

      return () => mm.revert();
    },
    { scope: stageRef, dependencies: [embedResult] },
  );

  // 4. Crisp crossfade/slide when switching between 01 | 02 | 03 in focus stage
  useGSAP(
    () => {
      if (!focusedScheme) {
        prevFocusedSchemeRef.current = null;
        return;
      }
      const prev = prevFocusedSchemeRef.current;
      prevFocusedSchemeRef.current = focusedScheme;

      if (!prev || prev === focusedScheme) return;
      if (activeMode !== 'embed' || embedStage !== 'focus') return;

      const dir = focusSwitchDirRef.current;
      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: '(prefers-reduced-motion: reduce)' },
        (context) => {
          if (context.conditions?.reduceMotion) return;

          gsap.fromTo(
            '.focus-swap-content',
            { x: dir * 24, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              duration: 0.34,
              ease: 'power3.out',
              clearProps: 'transform,opacity',
            },
          );
        },
        stageRef,
      );

      return () => mm.revert();
    },
    { scope: stageRef, dependencies: [focusedScheme] },
  );

  const handleEmbed = () => {
    if (!selectedSample || isEmbedding || isTransitioningOut) return;

    embedRequestIdRef.current += 1;
    const reqId = embedRequestIdRef.current;

    setIsEmbedding(true);
    setEmbedError(null);
    setEmbedResult(null);
    setFocusedScheme(null);
    prevFocusedSchemeRef.current = null;

    // Kick off API call immediately in parallel with Beat 1 choreography
    embedPayload({
      motif: selectedSample.motif,
      filename: selectedSample.filename,
      message,
    })
      .then((response) => {
        if (embedRequestIdRef.current !== reqId) return;
        setEmbedResult(response);
        setIsEmbedding(false);
      })
      .catch((err) => {
        if (embedRequestIdRef.current !== reqId) return;
        const messageText = err instanceof Error ? err.message : 'Embedding request failed.';
        setIsEmbedding(false);
        setEmbedError(messageText);

        if (beat1TimelineRef.current) {
          beat1TimelineRef.current.kill();
          beat1TimelineRef.current = null;
          setIsTransitioningOut(false);
          if (!prefersReducedMotion()) {
            gsap.to('.compose-top-slider, .compose-bottom-composer, .compose-hero-caption', {
              y: 0,
              opacity: 1,
              duration: 0.28,
              ease: 'power3.out',
              clearProps: 'transform,opacity',
            });
          }
          return;
        }

        // Gracefully Flip back to compose if already in overview/focus
        if (!prefersReducedMotion() && sampleFrameRef.current) {
          pendingFlipStateRef.current = Flip.getState(sampleFrameRef.current);
        }
        setFocusedScheme(null);
        setEmbedStage('compose');
      });

    if (prefersReducedMotion()) {
      pendingFlipStateRef.current = null;
      overviewEnterNeedsBeat3Ref.current = false;
      setEmbedStage('overview');
      return;
    }

    // Beat 1 (0.00s -> 0.28s): Slide top slider and bottom composer out, leaving ONLY hero sample
    setIsTransitioningOut(true);
    const tl = gsap.timeline({
      onComplete: () => {
        beat1TimelineRef.current = null;
        setIsTransitioningOut(false);
        if (embedRequestIdRef.current !== reqId) return;

        if (sampleFrameRef.current) {
          pendingFlipStateRef.current = Flip.getState(sampleFrameRef.current);
        }
        overviewEnterNeedsBeat3Ref.current = true;
        setEmbedStage('overview');
      },
    });
    beat1TimelineRef.current = tl;

    tl.to(
      '.compose-top-slider',
      {
        y: -24,
        opacity: 0,
        duration: 0.28,
        ease: 'power2.in',
      },
      0,
    )
      .to(
        '.compose-bottom-composer',
        {
          y: 24,
          opacity: 0,
          duration: 0.28,
          ease: 'power2.in',
        },
        0,
      )
      .to(
        '.compose-hero-caption',
        {
          y: 8,
          opacity: 0,
          duration: 0.2,
          ease: 'power2.in',
        },
        0,
      );
  };

  const handleBackToCompose = () => {
    embedRequestIdRef.current += 1;
    if (beat1TimelineRef.current) {
      beat1TimelineRef.current.kill();
      beat1TimelineRef.current = null;
    }
    setIsTransitioningOut(false);
    setIsEmbedding(false);

    if (!prefersReducedMotion() && sampleFrameRef.current) {
      pendingFlipStateRef.current = Flip.getState(sampleFrameRef.current);
    } else {
      pendingFlipStateRef.current = null;
    }

    stegoFlipStateRef.current = null;
    prevFocusedSchemeRef.current = null;
    setFocusedScheme(null);
    setEmbedStage('compose');
  };

  const handleSelectOverviewScheme = (scheme: SchemeName, tileMediaEl: HTMLElement | null) => {
    if (!embedResult) return;
    if (!prefersReducedMotion() && tileMediaEl) {
      stegoFlipStateRef.current = Flip.getState(tileMediaEl);
    } else {
      stegoFlipStateRef.current = null;
    }
    prevFocusedSchemeRef.current = null;
    lastFocusedSchemeRef.current = scheme;
    setFocusedScheme(scheme);
    setEmbedStage('focus');
  };

  const handleSwitchFocusedScheme = (nextScheme: SchemeName) => {
    if (!focusedScheme || nextScheme === focusedScheme) return;
    const prevIdx = ALL_SCHEMES.indexOf(focusedScheme);
    const nextIdx = ALL_SCHEMES.indexOf(nextScheme);
    focusSwitchDirRef.current = nextIdx >= prevIdx ? 1 : -1;
    lastFocusedSchemeRef.current = nextScheme;
    setFocusedScheme(nextScheme);
  };

  const handleReturnToOverview = () => {
    if (!prefersReducedMotion() && focusMediaRef.current) {
      stegoFlipStateRef.current = Flip.getState(focusMediaRef.current);
    } else {
      stegoFlipStateRef.current = null;
    }
    lastFocusedSchemeRef.current = focusedScheme;
    prevFocusedSchemeRef.current = null;
    setEmbedStage('overview');
  };

  const handleExtractFile = (file: File) => {
    extractCounterRef.current += 1;
    setPreloadExtract({ file, requestId: extractCounterRef.current });
    setActiveMode('extract');
  };

  const activeCoverSample = useMemo(() => {
    if (!embedResult) return selectedSample;
    return (
      samples.find(
        (s) => s.motif === embedResult.motif && s.filename === embedResult.filename,
      ) ?? selectedSample
    );
  }, [embedResult, samples, selectedSample]);

  const isCompose = embedStage === 'compose';
  const displaySample = isCompose ? selectedSample : activeCoverSample;
  const coverMotif = embedResult?.motif ?? displaySample?.motif ?? '';
  const coverFilename = embedResult?.filename ?? displaySample?.filename ?? '';
  const activePayloadBytes = embedResult?.payload_bytes ?? payloadBytes;

  return (
    <div className="min-h-dvh bg-[#F6F4EF] text-[#111110]">
      <header className="sticky top-0 z-30 h-14 border-b border-[#E4DFD3] bg-[#FDFCF9]/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="font-editorial text-xl tracking-tight text-[#111110] sm:text-2xl">
              BATIK PVDM
            </span>
            <span className="rounded border border-[#E4DFD3] bg-[#F6F4EF] px-1.5 py-0.5 font-mono-tabular text-[10px] font-medium tracking-[0.14em] text-[#9A6B2F]">
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
              onClick={() => setActiveMode('embed')}
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
              onClick={() => setActiveMode('extract')}
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
            <div
              className="hidden items-center gap-1.5 font-mono-tabular text-[11px] text-[#6B665C] sm:inline-flex"
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
                onNavigate('/test');
              }}
              className="inline-flex items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2.5 py-1 font-mono-tabular text-[11px] text-[#6B665C] transition-colors hover:border-[#9A6B2F] hover:text-[#111110]"
            >
              <span>/test</span>
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </header>

      <div ref={stageRef}>
        {activeMode === 'embed' && (
          <main
            className={
              isCompose
                ? 'flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden'
                : 'grid min-h-[calc(100dvh-3.5rem)] w-full grid-cols-1 lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-2 lg:overflow-hidden'
            }
          >
            {/* Left / Center Hero Pane — Keeps sampleFrameRef mounted across all 3 stages */}
            <section
              key="hero-pane"
              className={
                isCompose
                  ? 'flex h-full min-h-0 w-full flex-col items-center justify-between overflow-hidden'
                  : 'flex min-h-0 w-full flex-col justify-between overflow-hidden border-b border-[#E4DFD3] bg-[#F6F4EF] p-4 sm:p-5 lg:h-full lg:border-r lg:border-b-0 lg:p-7'
              }
            >
              {isCompose ? (
                <TopSampleSlider
                  key="compose-slider"
                  samples={orderedSamples}
                  selectedSampleKey={selectedSampleKey}
                  samplesLoading={samplesLoading}
                  samplesError={samplesError}
                  disabled={isTransitioningOut || isEmbedding}
                  onSelectSample={(sample) => setSelectedSample(sample)}
                  onRetry={() => {
                    setSamplesLoading(true);
                    setSamplesError(null);
                    void loadCatalogAndHealth();
                  }}
                />
              ) : (
                <div
                  key="split-top-bar"
                  className="split-left-chrome flex shrink-0 items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={handleBackToCompose}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-[#FDFCF9] px-3.5 py-1.5 text-xs font-medium text-[#111110] transition-colors hover:border-[#111110]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>New Embed</span>
                  </button>

                  <span className="font-mono-tabular text-[10px] font-medium uppercase tracking-[0.16em] text-[#9A6B2F]">
                    Original Cover
                  </span>
                </div>
              )}

              {/* Persistent Hero Cover Element (ZERO unmount across compose -> overview -> focus) */}
              <div
                key="hero-center-slot"
                className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 py-2"
              >
                <div
                  ref={sampleFrameRef}
                  data-flip-id="hero-sample"
                  className={`relative aspect-square max-h-full overflow-hidden rounded-2xl border border-[#E4DFD3] bg-[#FDFCF9] shadow-[0_24px_60px_-32px_rgba(17,17,16,0.28)] will-change-transform ${
                    isCompose
                      ? 'w-[clamp(200px,36vh,340px)]'
                      : 'w-[clamp(220px,44vh,420px)]'
                  }`}
                >
                  {displaySample ? (
                    <img
                      ref={heroImgRef}
                      src={displaySample.image_url}
                      alt={`${displaySample.motif} ${displaySample.filename}`}
                      className="h-full w-full object-cover will-change-transform"
                    />
                  ) : (
                    <div className="h-full w-full motion-safe:animate-pulse bg-[#EFECE3]" />
                  )}
                </div>

                {isCompose && displaySample && (
                  <div className="compose-hero-caption mt-2.5 inline-flex items-center rounded-full border border-[#E4DFD3] bg-[#FDFCF9]/90 px-2.5 py-0.5 font-mono-tabular text-[11px] text-[#6B665C]">
                    {displaySample.filename}
                  </div>
                )}
              </div>

              {isCompose ? (
                <div
                  key="compose-bottom"
                  className="compose-bottom-composer w-full max-w-[520px] shrink-0 px-4 pb-5"
                >
                  <textarea
                    id="hifi-payload-input"
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isTransitioningOut || isEmbedding}
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
                            disabled={isEmbedding || isTransitioningOut}
                            onClick={() => setMessage(generateDeterministicPayload(preset.bytes))}
                            className={`rounded-full border px-2.5 py-1 font-mono-tabular text-[11px] font-medium transition-colors disabled:opacity-50 ${
                              activePreset
                                ? 'border-[#9A6B2F] bg-[#FDFCF9] text-[#9A6B2F]'
                                : 'border-[#E4DFD3] bg-[#FDFCF9] text-[#111110] hover:border-[#9A6B2F]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}

                      <span className="ml-1 font-mono-tabular text-[11px] text-[#6B665C]">
                        {formatBytes(payloadBytes)}
                      </span>

                      {s1Overflow && (
                        <span
                          className="rounded-full border border-[#B45309]/35 bg-[#B45309]/10 px-2 py-0.5 font-mono-tabular text-[10px] font-medium text-[#B45309]"
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
                      disabled={!selectedSample || isEmbedding || isTransitioningOut}
                      className="inline-flex items-center gap-2 rounded-full bg-[#111110] px-5 py-2 text-xs font-semibold tracking-wide text-[#FDFCF9] transition-colors hover:bg-[#9A6B2F] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#D5CEBE] disabled:text-[#6B665C]"
                    >
                      {isEmbedding || isTransitioningOut ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Embedding…</span>
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
              ) : (
                <div
                  key="split-footer"
                  className="split-left-chrome flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#E4DFD3] pt-3 font-mono-tabular text-[11px] text-[#6B665C]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-editorial text-base capitalize text-[#111110]">
                      {coverMotif}
                    </span>
                    <span>/</span>
                    <span className="text-[#111110]">{coverFilename}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>
                      {displaySample
                        ? `${displaySample.width} × ${displaySample.height} RGB`
                        : '512 × 512 RGB'}
                    </span>
                    <span className="font-semibold text-[#111110]">
                      {formatBytes(activePayloadBytes)}
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* Right 50% Pane: Stage 2 (overview) or Stage 3 (focus) */}
            {embedStage === 'overview' && (
              <StegoOverviewPane
                embedResult={embedResult}
                isEmbedding={isEmbedding}
                onSelectScheme={handleSelectOverviewScheme}
              />
            )}

            {embedStage === 'focus' && embedResult && focusedScheme && (
              <StegoFocusPane
                embedResult={embedResult}
                focusedScheme={focusedScheme}
                viewMode={viewMode}
                focusMediaRef={focusMediaRef}
                onSwitchScheme={handleSwitchFocusedScheme}
                onShowAll={handleReturnToOverview}
                onChangeViewMode={setViewMode}
                onExtractFile={handleExtractFile}
              />
            )}
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
