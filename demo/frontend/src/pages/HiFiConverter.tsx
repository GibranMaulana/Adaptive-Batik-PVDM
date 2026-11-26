import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  Grid2x2,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { embedPayload, fetchHealth, fetchSamples } from '../api/client';
import type { EmbedResponse, HealthResponse, SampleSummary, SchemeName } from '../api/types';
import { HiFiExtractor, type HiFiPreloadExtract } from '../components/hifi/HiFiExtractor';
import { SchemeResultCard, type GalleryViewMode } from '../components/hifi/SchemeResultCard';
import { SpecimenModal } from '../components/hifi/SpecimenModal';
import {
  ALL_SCHEMES,
  SAMPLE_MESSAGE,
  SCHEME_META,
  formatBytes,
  formatKb,
  generateDeterministicPayload,
  utf8ByteLength,
} from '../utils/payload';

gsap.registerPlugin(useGSAP);

type ActiveMode = 'embed' | 'extract';
type EmbedStage = 'compose' | 'split';

interface HiFiConverterProps {
  onNavigate: (path: string) => void;
}

const FEATURED_FILENAMES = new Set(['parang_01.png', 'kawung_01.png', 'megamendung_01.png']);

const PAYLOAD_PRESETS: { label: string; bytes: number }[] = [
  { label: '1 KB', bytes: 1024 },
  { label: '10 KB', bytes: 10 * 1024 },
  { label: '50 KB', bytes: 50 * 1024 },
];

function pickDefaultSample(samples: SampleSummary[]): SampleSummary | null {
  if (samples.length === 0) return null;
  return (
    samples.find((s) => s.motif === 'parang' && s.filename === 'parang_01.png') ??
    samples.find((s) => s.featured) ??
    samples[0]
  );
}

function isFeaturedSample(sample: SampleSummary): boolean {
  return sample.featured || FEATURED_FILENAMES.has(sample.filename);
}

export function HiFiConverter({ onNavigate }: HiFiConverterProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const extractCounterRef = useRef(0);

  const [activeMode, setActiveMode] = useState<ActiveMode>('embed');
  const [embedStage, setEmbedStage] = useState<EmbedStage>('compose');

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthOffline, setHealthOffline] = useState(false);

  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState<SampleSummary | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
      setSamples(catalog.samples);
      setSamplesError(null);
      setSelectedSample((current) => {
        if (current) {
          const match = catalog.samples.find(
            (s) => s.motif === current.motif && s.filename === current.filename,
          );
          if (match) return match;
        }
        return pickDefaultSample(catalog.samples);
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
        setSamples(catalog.samples);
        setSamplesError(null);
        setSelectedSample((current) => current ?? pickDefaultSample(catalog.samples));
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

  const featuredSamples = useMemo(
    () => samples.filter((s) => isFeaturedSample(s)).slice(0, 3),
    [samples],
  );

  const isSelectedFeatured = selectedSample ? isFeaturedSample(selectedSample) : false;
  const payloadBytes = utf8ByteLength(message);

  const schemeReadiness = useMemo(() => {
    return ALL_SCHEMES.map((scheme: SchemeName) => {
      const maxBytes = selectedSample?.capacities[scheme].max_payload_bytes ?? null;
      const overflow = maxBytes !== null && payloadBytes > maxBytes;
      return { scheme, maxBytes, overflow };
    });
  }, [selectedSample, payloadBytes]);

  const scheme1Overflow = schemeReadiness[0]?.overflow ?? false;
  const scheme1Max = schemeReadiness[0]?.maxBytes ?? null;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const reduceMotion = Boolean(context.conditions?.reduceMotion);
          if (reduceMotion) return;

          if (activeMode === 'embed' && embedStage === 'compose') {
            gsap.from('.compose-folio', {
              y: 18,
              autoAlpha: 0,
              scale: 0.985,
              duration: 0.48,
              ease: 'power3.out',
              clearProps: 'transform,opacity,visibility',
            });
          } else if (activeMode === 'embed' && embedStage === 'split' && embedResult) {
            gsap.from('.split-cover-frame', {
              x: -20,
              autoAlpha: 0,
              duration: 0.5,
              ease: 'power3.out',
              clearProps: 'transform,opacity,visibility',
            });

            gsap.from('.scheme-stagger-card', {
              y: 24,
              autoAlpha: 0,
              duration: 0.55,
              stagger: 0.1,
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
      setEmbedResult(response);
      setEmbedStage('split');
    } catch (err) {
      setEmbedError(err instanceof Error ? err.message : 'Embedding request failed.');
    } finally {
      setIsEmbedding(false);
    }
  };

  const handleBackToCompose = () => {
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
          <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-6 sm:px-6 lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden lg:py-0">
            <div className="compose-folio w-full max-w-3xl rounded-2xl border border-[#E4DFD3] bg-[#FDFCF9] p-5 shadow-[0_24px_60px_-36px_rgba(17,17,16,0.22)] will-change-transform sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E4DFD3] pb-4">
                <div>
                  <div className="font-mono-tabular text-[10px] uppercase tracking-[0.2em] text-[#9A6B2F]">
                    Adaptive Batik RGB Steganography
                  </div>
                  <h1 className="font-editorial mt-0.5 text-3xl leading-none tracking-tight text-[#111110] sm:text-4xl">
                    Embed into <span className="italic text-[#9A6B2F]">Sogan &amp; Indigo</span>
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  disabled={samplesLoading || samples.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-3 py-1.5 text-xs font-medium text-[#111110] transition-colors hover:border-[#9A6B2F] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Grid2x2 className="h-3.5 w-3.5 text-[#9A6B2F]" />
                  <span>All {samples.length || 45} Specimens</span>
                </button>
              </div>

              <div className="mt-4">
                {samplesLoading && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {[0, 1, 2].map((idx) => (
                      <div
                        key={idx}
                        className="h-20 animate-pulse rounded-xl border border-[#E4DFD3] bg-[#F6F4EF]"
                      />
                    ))}
                  </div>
                )}

                {!samplesLoading && samplesError && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#B45309]/35 bg-[#B45309]/[0.06] px-4 py-3 text-xs text-[#111110]">
                    <span>Unable to load specimens: {samplesError}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSamplesLoading(true);
                        setSamplesError(null);
                        void loadCatalogAndHealth();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-[#FDFCF9] px-3 py-1 font-medium hover:border-[#111110]"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </button>
                  </div>
                )}

                {!samplesLoading && !samplesError && featuredSamples.length > 0 && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {featuredSamples.map((sample) => {
                      const selected =
                        selectedSample?.motif === sample.motif &&
                        selectedSample?.filename === sample.filename;
                      return (
                        <button
                          key={`${sample.motif}/${sample.filename}`}
                          type="button"
                          onClick={() => setSelectedSample(sample)}
                          className={`group flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all ${
                            selected
                              ? 'border-[#9A6B2F] bg-[#F6F4EF] ring-1 ring-[#9A6B2F]'
                              : 'border-[#E4DFD3] bg-[#FDFCF9] hover:border-[#9A6B2F]/60'
                          }`}
                        >
                          <img
                            src={sample.image_url}
                            alt={`${sample.motif} ${sample.filename}`}
                            className="h-14 w-14 shrink-0 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF] object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A6B2F]">
                                {sample.motif}
                              </span>
                              {selected && (
                                <span className="h-1.5 w-1.5 rounded-full bg-[#9A6B2F]" />
                              )}
                            </div>
                            <div className="truncate font-mono-tabular text-xs font-medium text-[#111110]">
                              {sample.filename}
                            </div>
                            <div className="mt-0.5 font-mono-tabular text-[10px] text-[#6B665C]">
                              S3 max {formatKb(sample.capacities.scheme3.max_payload_bytes)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!samplesLoading && !samplesError && selectedSample && !isSelectedFeatured && (
                  <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-[#9A6B2F]/40 bg-[#F6F4EF] px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <img
                        src={selectedSample.image_url}
                        alt={selectedSample.filename}
                        className="h-6 w-6 rounded border border-[#E4DFD3] object-cover"
                      />
                      <span className="text-[#6B665C]">
                        Active specimen:{' '}
                        <strong className="font-mono-tabular text-[#111110]">
                          {selectedSample.filename}
                        </strong>{' '}
                        <span className="capitalize">({selectedSample.motif})</span>
                      </span>
                    </div>
                    <span className="font-mono-tabular text-[11px] text-[#9A6B2F]">
                      S3 {formatKb(selectedSample.capacities.scheme3.max_payload_bytes)}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-[#E4DFD3] pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="hifi-payload-input"
                    className="font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B665C]"
                  >
                    Secret UTF-8 Payload
                  </label>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {PAYLOAD_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={isEmbedding}
                        onClick={() => setMessage(generateDeterministicPayload(preset.bytes))}
                        className="rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2.5 py-0.5 font-mono-tabular text-[11px] font-medium text-[#111110] transition-colors hover:border-[#9A6B2F] disabled:opacity-50"
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={isEmbedding}
                      onClick={() => setMessage(SAMPLE_MESSAGE)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-[#6B665C] underline-offset-2 hover:text-[#111110] hover:underline disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Sample
                    </button>
                  </div>
                </div>

                <textarea
                  id="hifi-payload-input"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write secret UTF-8 text or choose a payload preset above…"
                  className="mt-2 w-full resize-none rounded-xl border border-[#E4DFD3] bg-[#F6F4EF]/65 px-3.5 py-2.5 font-mono-tabular text-xs leading-relaxed text-[#111110] placeholder:text-[#6B665C]/60 focus:border-[#9A6B2F] focus:bg-[#FDFCF9] focus:outline-none"
                />

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono-tabular text-[11px] text-[#6B665C]">
                    Payload:{' '}
                    <strong className="text-[#111110]">{formatBytes(payloadBytes)}</strong> (
                    {(payloadBytes / 1024).toFixed(2)} KB)
                  </div>

                  <div className="flex flex-wrap items-center gap-3 font-mono-tabular text-[11px]">
                    {schemeReadiness.map(({ scheme, overflow }) => (
                      <span
                        key={scheme}
                        className="inline-flex items-center gap-1.5 text-[#6B665C]"
                        title={SCHEME_META[scheme].fullName}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            overflow ? 'bg-[#B45309]' : 'bg-[#15803D]'
                          }`}
                        />
                        <span className={overflow ? 'text-[#B45309]' : 'text-[#111110]'}>
                          {SCHEME_META[scheme].shortLabel.replace('Scheme ', 'S')}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {scheme1Overflow && scheme1Max !== null && (
                  <p className="mt-2 rounded-lg border border-[#B45309]/30 bg-[#B45309]/[0.06] px-3 py-1.5 text-[11px] text-[#B45309]">
                    Payload exceeds Scheme 1 max capacity ({formatBytes(scheme1Max)}). Scheme 1
                    will report overflow, while <strong>Scheme 2 &amp; Scheme 3</strong> still
                    embed cleanly.
                  </p>
                )}

                {embedError && (
                  <p className="mt-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-800">
                    {embedError}
                  </p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E4DFD3] pt-4">
                <div className="font-mono-tabular text-[11px] text-[#6B665C]">
                  {selectedSample
                    ? `${selectedSample.motif}/${selectedSample.filename} · ${selectedSample.width}×${selectedSample.height} RGB`
                    : 'Waiting for specimen catalog…'}
                </div>

                <button
                  type="button"
                  onClick={() => void handleEmbed()}
                  disabled={!selectedSample || isEmbedding}
                  className="inline-flex items-center gap-2 rounded-full bg-[#111110] px-6 py-2.5 text-xs font-semibold tracking-wide text-[#FDFCF9] transition-all hover:bg-[#9A6B2F] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#D5CEBE] disabled:text-[#6B665C]"
                >
                  {isEmbedding ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Embedding 3 Schemes…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Embed to Stego</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </main>
        )}

        {activeMode === 'embed' && embedStage === 'split' && embedResult && (
          <main className="mx-auto grid max-w-[1440px] grid-cols-1 lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-2 lg:overflow-hidden">
            <section className="split-cover-frame flex flex-col justify-between border-b border-[#E4DFD3] bg-[#F6F4EF] p-5 will-change-transform lg:h-[calc(100dvh-3.5rem)] lg:border-r lg:border-b-0 lg:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
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
                <figure className="w-full max-w-[420px] rounded-2xl border border-[#E4DFD3] bg-[#FDFCF9] p-4 shadow-[0_20px_50px_-34px_rgba(17,17,16,0.28)]">
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
                  <figcaption className="mt-3 flex items-baseline justify-between gap-2 border-t border-[#E4DFD3] pt-2.5">
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

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4DFD3] pt-3 font-mono-tabular text-[11px] text-[#6B665C]">
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

      <SpecimenModal
        open={modalOpen}
        samples={samples}
        selectedSample={selectedSample}
        onSelect={setSelectedSample}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
