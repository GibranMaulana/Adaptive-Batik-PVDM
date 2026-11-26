import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { embedPayload, fetchHealth, fetchSamples } from '../api/client';
import type { EmbedResponse, HealthResponse, SampleSummary } from '../api/types';
import { HiFiExtractor, type HiFiPreloadExtract } from '../components/hifi/HiFiExtractor';
import { SchemeResultCard, type GalleryViewMode } from '../components/hifi/SchemeResultCard';
import {
  SAMPLE_MESSAGE,
  formatBytes,
  generateDeterministicPayload,
  utf8ByteLength,
} from '../utils/payload';

gsap.registerPlugin(useGSAP);

type ActiveMode = 'embed' | 'extract';
type EmbedStage = 'compose' | 'split';

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

export function HiFiConverter({ onNavigate }: HiFiConverterProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const heroFrameRef = useRef<HTMLDivElement | null>(null);
  const heroImgRef = useRef<HTMLImageElement | null>(null);
  const splitCoverFrameRef = useRef<HTMLElement | null>(null);
  const heroRectRef = useRef<DOMRect | null>(null);
  const returnRectRef = useRef<DOMRect | null>(null);
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
  const [isEmbedding, setIsEmbedding] = useState(false);
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

  useEffect(() => {
    if (!selectedSampleKey || activeMode !== 'embed' || embedStage !== 'compose') return;
    const activeThumb = thumbRefs.current.get(selectedSampleKey);
    activeThumb?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [selectedSampleKey, activeMode, embedStage]);

  // Hero image swap animation whenever selectedSample changes
  useGSAP(
    () => {
      if (activeMode !== 'embed' || embedStage !== 'compose' || !selectedSampleKey) return;
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

  // Stage transition animations (compose <-> split <-> extract)
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: '(prefers-reduced-motion: reduce)' },
        (context) => {
          const reduceMotion = Boolean(context.conditions?.reduceMotion);
          if (reduceMotion) {
            heroRectRef.current = null;
            returnRectRef.current = null;
            return;
          }

          if (activeMode === 'embed' && embedStage === 'compose') {
            const fromSplitRect = returnRectRef.current;
            returnRectRef.current = null;

            if (fromSplitRect && heroFrameRef.current) {
              const nextRect = heroFrameRef.current.getBoundingClientRect();
              if (nextRect.width > 0 && fromSplitRect.width > 0) {
                const dx =
                  fromSplitRect.left +
                  fromSplitRect.width / 2 -
                  (nextRect.left + nextRect.width / 2);
                const dy =
                  fromSplitRect.top +
                  fromSplitRect.height / 2 -
                  (nextRect.top + nextRect.height / 2);
                const scale = fromSplitRect.width / nextRect.width;

                gsap.from(heroFrameRef.current, {
                  x: dx,
                  y: dy,
                  scale,
                  duration: 0.5,
                  ease: 'power3.out',
                  clearProps: 'transform',
                });
              }
            } else if (heroFrameRef.current) {
              gsap.from(heroFrameRef.current, {
                y: 12,
                autoAlpha: 0,
                duration: 0.42,
                ease: 'power3.out',
                clearProps: 'transform,opacity,visibility',
              });
            }

            gsap.from('.compose-chrome', {
              y: 12,
              autoAlpha: 0,
              duration: 0.42,
              stagger: 0.06,
              ease: 'power3.out',
              clearProps: 'transform,opacity,visibility',
            });
          } else if (activeMode === 'embed' && embedStage === 'split' && embedResult) {
            const fromComposeRect = heroRectRef.current;
            heroRectRef.current = null;

            if (fromComposeRect && splitCoverFrameRef.current) {
              const nextRect = splitCoverFrameRef.current.getBoundingClientRect();
              if (nextRect.width > 0 && fromComposeRect.width > 0) {
                const dx =
                  fromComposeRect.left +
                  fromComposeRect.width / 2 -
                  (nextRect.left + nextRect.width / 2);
                const dy =
                  fromComposeRect.top +
                  fromComposeRect.height / 2 -
                  (nextRect.top + nextRect.height / 2);
                const scale = fromComposeRect.width / nextRect.width;

                gsap.from(splitCoverFrameRef.current, {
                  x: dx,
                  y: dy,
                  scale,
                  duration: 0.55,
                  ease: 'power3.out',
                  clearProps: 'transform',
                });
              }
            } else {
              gsap.from('.split-cover-frame', {
                x: -20,
                autoAlpha: 0,
                duration: 0.5,
                ease: 'power3.out',
                clearProps: 'transform,opacity,visibility',
              });
            }

            gsap.from('.split-chrome', {
              y: 10,
              autoAlpha: 0,
              duration: 0.4,
              ease: 'power3.out',
              clearProps: 'transform,opacity,visibility',
            });

            gsap.from('.scheme-stagger-card', {
              y: 22,
              autoAlpha: 0,
              duration: 0.52,
              stagger: 0.1,
              delay: 0.06,
              ease: 'power3.out',
              clearProps: 'transform,opacity,visibility',
            });
          } else if (activeMode === 'extract') {
            gsap.from('.extract-stage', {
              y: 16,
              autoAlpha: 0,
              duration: 0.45,
              ease: 'power3.out',
              clearProps: 'transform,opacity,visibility',
            });
          }
        },
        stageRef,
      );

      return () => {
        mm.revert();
      };
    },
    { scope: stageRef, dependencies: [activeMode, embedStage, embedResult] },
  );

  const handleScrollSlider = (direction: -1 | 1) => {
    sliderRef.current?.scrollBy({ left: direction * 240, behavior: 'smooth' });
  };

  const handleEmbed = async () => {
    if (!selectedSample || isEmbedding) return;
    setIsEmbedding(true);
    setEmbedError(null);

    try {
      const response = await embedPayload({
        motif: selectedSample.motif,
        filename: selectedSample.filename,
        message,
      });
      heroRectRef.current = heroFrameRef.current?.getBoundingClientRect() ?? null;
      setEmbedResult(response);
      setEmbedStage('split');
    } catch (err) {
      setEmbedError(err instanceof Error ? err.message : 'Embedding request failed.');
    } finally {
      setIsEmbedding(false);
    }
  };

  const handleBackToCompose = () => {
    returnRectRef.current = splitCoverFrameRef.current?.getBoundingClientRect() ?? null;
    setEmbedStage('compose');
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
                      : 'animate-pulse bg-[#6B665C]'
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
        {activeMode === 'embed' && embedStage === 'compose' && (
          <main className="flex h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-4 overflow-hidden px-4 py-4 sm:gap-5 sm:px-6">
            {/* 1. Top — Compact Horizontal Sample Slider */}
            <div className="compose-chrome w-full max-w-[560px]">
              {samplesLoading ? (
                <div className="flex items-center justify-center gap-2 py-2">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-11 w-11 shrink-0 animate-pulse rounded-lg border border-[#E4DFD3] bg-[#FDFCF9]"
                    />
                  ))}
                </div>
              ) : samplesError ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#B45309]/35 bg-[#B45309]/[0.06] px-3.5 py-2 text-xs text-[#111110]">
                  <span className="truncate">{samplesError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSamplesLoading(true);
                      setSamplesError(null);
                      void loadCatalogAndHealth();
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#FDFCF9] px-2.5 py-1 font-medium hover:border-[#111110]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Scroll samples left"
                    onClick={() => handleScrollSlider(-1)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E4DFD3] bg-[#FDFCF9] text-[#6B665C] transition-colors hover:border-[#9A6B2F] hover:text-[#111110]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div
                    ref={sliderRef}
                    role="listbox"
                    aria-label="Batik cover samples"
                    className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto scroll-smooth px-1.5 py-2"
                  >
                    {orderedSamples.map((sample) => {
                      const key = sampleKey(sample);
                      const selected = key === selectedSampleKey;
                      return (
                        <button
                          key={key}
                          ref={(el) => {
                            if (el) {
                              thumbRefs.current.set(key, el);
                            } else {
                              thumbRefs.current.delete(key);
                            }
                          }}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          aria-label={`Select ${sample.filename}`}
                          title={`${sample.motif} · ${sample.filename}`}
                          onClick={() => setSelectedSample(sample)}
                          className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#FDFCF9] transition-all duration-200 focus:outline-none ${
                            selected
                              ? 'scale-105 ring-2 ring-[#9A6B2F] ring-offset-2 ring-offset-[#F6F4EF]'
                              : 'opacity-80 ring-1 ring-[#E4DFD3] hover:opacity-100 hover:ring-[#9A6B2F]/60'
                          }`}
                        >
                          <img
                            src={sample.image_url}
                            alt={`${sample.motif} ${sample.filename}`}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    aria-label="Scroll samples right"
                    onClick={() => handleScrollSlider(1)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E4DFD3] bg-[#FDFCF9] text-[#6B665C] transition-colors hover:border-[#9A6B2F] hover:text-[#111110]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* 2. Center — Big Hero Image of Selected Sample */}
            <div className="flex flex-col items-center">
              <div
                ref={heroFrameRef}
                className="relative aspect-square w-[clamp(220px,38vh,360px)] overflow-hidden rounded-2xl border border-[#E4DFD3] bg-[#FDFCF9] shadow-[0_24px_60px_-32px_rgba(17,17,16,0.28)] will-change-transform"
              >
                {selectedSample ? (
                  <img
                    ref={heroImgRef}
                    src={selectedSample.image_url}
                    alt={`${selectedSample.motif} ${selectedSample.filename}`}
                    className="h-full w-full object-cover will-change-transform"
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-[#EFECE3]" />
                )}
              </div>

              {selectedSample && (
                <div className="compose-chrome mt-2.5 inline-flex items-center rounded-full border border-[#E4DFD3] bg-[#FDFCF9]/90 px-2.5 py-0.5 font-mono-tabular text-[11px] text-[#6B665C]">
                  {selectedSample.filename}
                </div>
              )}
            </div>

            {/* 3. Bottom — Minimal Message Field + Presets + Embed CTA */}
            <div className="compose-chrome w-full max-w-[520px]">
              <textarea
                id="hifi-payload-input"
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a secret message..."
                aria-label="Secret message"
                className="w-full resize-none rounded-xl border border-[#E4DFD3] bg-[#FDFCF9] px-3.5 py-2.5 text-xs leading-relaxed text-[#111110] placeholder:text-[#6B665C]/65 transition-colors focus:border-[#9A6B2F] focus:outline-none sm:text-[13px]"
              />

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {PAYLOAD_PRESETS.map((preset) => {
                    const activePreset = payloadBytes === preset.bytes;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={isEmbedding}
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
                  onClick={() => void handleEmbed()}
                  disabled={!selectedSample || isEmbedding}
                  className="inline-flex items-center gap-2 rounded-full bg-[#111110] px-5 py-2 text-xs font-semibold tracking-wide text-[#FDFCF9] transition-all hover:bg-[#9A6B2F] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#D5CEBE] disabled:text-[#6B665C]"
                >
                  {isEmbedding ? (
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
          </main>
        )}

        {activeMode === 'embed' && embedStage === 'split' && embedResult && (
          <main className="mx-auto grid max-w-[1440px] grid-cols-1 lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-2 lg:overflow-hidden">
            <section className="split-cover-frame flex flex-col justify-between border-b border-[#E4DFD3] bg-[#F6F4EF] p-5 will-change-transform lg:h-[calc(100dvh-3.5rem)] lg:border-r lg:border-b-0 lg:p-7">
              <div className="split-chrome flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleBackToCompose}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-[#FDFCF9] px-3.5 py-1.5 text-xs font-medium text-[#111110] transition-colors hover:border-[#111110]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>New Embed</span>
                </button>

                <div
                  className="inline-flex rounded-full border border-[#E4DFD3] bg-[#FDFCF9] p-0.5"
                  role="group"
                  aria-label="Stego comparison view mode"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('stego')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === 'stego'
                        ? 'bg-[#111110] text-[#FDFCF9]'
                        : 'text-[#6B665C] hover:text-[#111110]'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Stego Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('heatmap')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === 'heatmap'
                        ? 'bg-[#111110] text-[#FDFCF9]'
                        : 'text-[#6B665C] hover:text-[#111110]'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>×20 Diff Heatmap</span>
                  </button>
                </div>
              </div>

              <div className="my-5 flex flex-1 items-center justify-center">
                <figure
                  ref={splitCoverFrameRef}
                  className="w-full max-w-[420px] rounded-2xl border border-[#E4DFD3] bg-[#FDFCF9] p-4 shadow-[0_20px_50px_-34px_rgba(17,17,16,0.28)] will-change-transform"
                >
                  <div className="overflow-hidden rounded-xl border border-[#E4DFD3] bg-[#F6F4EF]">
                    {activeCoverSample ? (
                      <img
                        src={activeCoverSample.image_url}
                        alt={`${embedResult.motif} ${embedResult.filename} original cover`}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center text-xs text-[#6B665C]">
                        Cover preview unavailable
                      </div>
                    )}
                  </div>
                  <figcaption className="split-chrome mt-3 flex items-baseline justify-between gap-2 border-t border-[#E4DFD3] pt-2.5">
                    <div>
                      <div className="font-mono-tabular text-[10px] uppercase tracking-[0.16em] text-[#9A6B2F]">
                        Original Cover Plate
                      </div>
                      <div className="font-editorial text-xl text-[#111110]">
                        <span className="capitalize">{embedResult.motif}</span> /{' '}
                        <span className="font-mono-tabular text-sm">{embedResult.filename}</span>
                      </div>
                    </div>
                    <div className="text-right font-mono-tabular text-[11px] text-[#6B665C]">
                      <div>
                        {activeCoverSample
                          ? `${activeCoverSample.width} × ${activeCoverSample.height} RGB`
                          : '512 × 512 RGB'}
                      </div>
                      <div className="font-semibold text-[#111110]">
                        {formatBytes(embedResult.payload_bytes)}
                      </div>
                    </div>
                  </figcaption>
                </figure>
              </div>

              <div className="split-chrome flex flex-wrap items-center justify-between gap-2 border-t border-[#E4DFD3] pt-3 font-mono-tabular text-[11px] text-[#6B665C]">
                <span>3-Scheme Blind PVDM Evaluation</span>
                <span>
                  Viewing:{' '}
                  <strong className="text-[#111110]">
                    {viewMode === 'stego' ? 'Lossless Stego PNG' : '|Cover − Stego| × 20'}
                  </strong>
                </span>
              </div>
            </section>

            <section className="gallery-scroll space-y-4 p-5 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:p-7">
              {embedResult.results.map((res) => (
                <SchemeResultCard
                  key={res.scheme}
                  motif={embedResult.motif}
                  payloadBytes={embedResult.payload_bytes}
                  result={res}
                  viewMode={viewMode}
                  onExtractFile={handleExtractFile}
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
