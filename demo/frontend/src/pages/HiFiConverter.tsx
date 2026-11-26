import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowLeft, ArrowUpRight, Loader2, Sparkles } from 'lucide-react';
import { embedPayload, fetchHealth, fetchSamples } from '../api/client';
import type { EmbedResponse, HealthResponse, SampleSummary, SchemeName } from '../api/types';
import { HiFiExtractor, type HiFiPreloadExtract } from '../components/hifi/HiFiExtractor';
import type { GalleryViewMode } from '../components/hifi/SchemeResultCard';
import { StegoFocusPane } from '../components/hifi/StegoFocusPane';
import { LiveEmbeddingPane } from '../components/hifi/LiveEmbeddingPane';
import { StegoOverviewPane } from '../components/hifi/StegoOverviewPane';
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
type EmbedStage = 'compose' | 'live' | 'overview' | 'focus';

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

function isDesktopViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
}

export function HiFiConverter({ onNavigate }: HiFiConverterProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const topSliderRef = useRef<HTMLDivElement | null>(null);
  const heroPaneRef = useRef<HTMLElement | null>(null);
  const sampleFrameRef = useRef<HTMLDivElement | null>(null);
  const composeCaptionRef = useRef<HTMLDivElement | null>(null);
  const heroImgRef = useRef<HTMLImageElement | null>(null);
  const bottomComposerRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);

  const activeTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const returningFromFocusRef = useRef(false);
  const enteringOverviewFromLiveRef = useRef(false);
  const embedStageRef = useRef<EmbedStage>('compose');

  const coverReticleRef = useRef<HTMLDivElement | null>(null);
  const coverScanlineRef = useRef<HTMLDivElement | null>(null);

  const prevSampleKeyRef = useRef<string>('');
  const prevFocusedSchemeRef = useRef<SchemeName | null>(null);
  const focusSwitchDirRef = useRef<1 | -1>(1);

  const embedRequestIdRef = useRef(0);
  const extractCounterRef = useRef(0);

  const [activeMode, setActiveMode] = useState<ActiveMode>('embed');
  const [embedStage, setEmbedStage] = useState<EmbedStage>('compose');
  const [focusedScheme, setFocusedScheme] = useState<SchemeName | null>(null);

  useEffect(() => {
    embedStageRef.current = embedStage;
  }, [embedStage]);

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
  const [liveSchemeIndex, setLiveSchemeIndex] = useState<number | null>(null);

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
        {
          isMotionOk: '(prefers-reduced-motion: no-preference)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
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

  // 2. Persistent stage initialization & responsive matchMedia (runs on activeMode mount)
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          isDesktop: '(min-width: 1024px)',
          isMotionOk: '(prefers-reduced-motion: no-preference)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const isDesktop = Boolean(context.conditions?.isDesktop);
          const reduceMotion = Boolean(context.conditions?.reduceMotion);

          if (activeMode === 'extract') {
            if (!reduceMotion) {
              gsap.from('.extract-stage', {
                y: 16,
                autoAlpha: 0,
                duration: 0.42,
                ease: 'power3.out',
                clearProps: 'transform,opacity,visibility',
              });
            }
            return;
          }

          if (embedStageRef.current === 'compose') {
            if (heroPaneRef.current) {
              gsap.set(heroPaneRef.current, {
                xPercent: isDesktop ? 50 : 0,
                autoAlpha: 1,
                pointerEvents: 'auto',
              });
            }
            if (sampleFrameRef.current) {
              gsap.set(sampleFrameRef.current, { scale: 1 });
            }
            if (topSliderRef.current) {
              gsap.set(topSliderRef.current, { y: 0, autoAlpha: 1 });
            }
            if (bottomComposerRef.current) {
              gsap.set(bottomComposerRef.current, { y: 0, autoAlpha: 1 });
            }
            if (composeCaptionRef.current) {
              gsap.set(composeCaptionRef.current, { y: 0, autoAlpha: 1 });
            }
            gsap.set('.split-left-chrome', {
              y: 10,
              autoAlpha: 0,
              pointerEvents: 'none',
            });
            if (rightPaneRef.current) {
              gsap.set(rightPaneRef.current, {
                x: 0,
                autoAlpha: 0,
                pointerEvents: 'none',
              });
            }
          } else {
            if (heroPaneRef.current) {
              gsap.set(heroPaneRef.current, {
                xPercent: 0,
                autoAlpha: isDesktop ? 1 : 0,
                pointerEvents: isDesktop ? 'auto' : 'none',
              });
            }
            if (sampleFrameRef.current) {
              gsap.set(sampleFrameRef.current, { scale: isDesktop ? 1.06 : 1 });
            }
            if (topSliderRef.current) {
              gsap.set(topSliderRef.current, { y: -28, autoAlpha: 0 });
            }
            if (bottomComposerRef.current) {
              gsap.set(bottomComposerRef.current, { y: 28, autoAlpha: 0 });
            }
            if (composeCaptionRef.current) {
              gsap.set(composeCaptionRef.current, { y: 8, autoAlpha: 0 });
            }
            gsap.set('.split-left-chrome', {
              y: 0,
              autoAlpha: 1,
              pointerEvents: 'auto',
            });
            if (rightPaneRef.current) {
              gsap.set(rightPaneRef.current, {
                x: 0,
                autoAlpha: 1,
                pointerEvents: 'auto',
              });
            }
            gsap.set('.stego-overview-slot', { x: 0, autoAlpha: 1 });
          }
        },
        stageRef,
      );

      return () => {
        activeTimelineRef.current?.kill();
        activeTimelineRef.current = null;
        setIsTransitioningOut(false);
        mm.revert();
      };
    },
    { scope: stageRef, dependencies: [activeMode] },
  );

  // 3. Right-pane overview <-> focus choreography (never touches left/compose layers)
  useGSAP(
    () => {
      if (activeMode !== 'embed') return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          isMotionOk: '(prefers-reduced-motion: no-preference)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          if (context.conditions?.reduceMotion) {
            returningFromFocusRef.current = false;
            enteringOverviewFromLiveRef.current = false;
            return;
          }

          let reverted = false;

          if (embedStage === 'focus') {
            const focusTl = gsap.timeline();
            focusTl
              .fromTo(
                '.focus-top-bar',
                { y: -10, autoAlpha: 0 },
                {
                  y: 0,
                  autoAlpha: 1,
                  duration: 0.32,
                  ease: 'power3.out',
                  clearProps: 'transform,opacity,visibility',
                },
                0,
              )
              .fromTo(
                '.focus-swap-content',
                { scale: 0.96, y: 12, autoAlpha: 0 },
                {
                  scale: 1,
                  y: 0,
                  autoAlpha: 1,
                  duration: 0.42,
                  ease: 'power3.out',
                  clearProps: 'transform,opacity,visibility',
                },
                0.04,
              )
              .fromTo(
                '.focus-detail-stagger',
                { y: 12, autoAlpha: 0 },
                {
                  y: 0,
                  autoAlpha: 1,
                  duration: 0.36,
                  stagger: 0.06,
                  ease: 'power3.out',
                  clearProps: 'transform,opacity,visibility',
                },
                0.12,
              );
            return;
          }

          if (embedStage === 'overview' && returningFromFocusRef.current) {
            gsap.fromTo(
              '.stego-overview-slot',
              { scale: 0.97, y: 10, autoAlpha: 0 },
              {
                scale: 1,
                y: 0,
                autoAlpha: 1,
                duration: 0.38,
                stagger: 0.06,
                ease: 'power3.out',
                clearProps: 'transform,opacity,visibility',
                onComplete: () => {
                  if (!reverted) {
                    returningFromFocusRef.current = false;
                  }
                },
              },
            );
          } else if (embedStage === 'overview' && enteringOverviewFromLiveRef.current) {
            const overviewTl = gsap.timeline({
              onComplete: () => {
                if (!reverted) {
                  enteringOverviewFromLiveRef.current = false;
                }
              },
            });
            overviewTl.fromTo(
              '.stego-overview-slot',
              { x: 28, autoAlpha: 0 },
              {
                x: 0,
                autoAlpha: 1,
                duration: 0.44,
                stagger: 0.08,
                ease: 'power3.out',
                clearProps: 'transform,opacity,visibility',
              },
              0,
            );
            if (embedResult) {
              overviewTl.fromTo(
                '.stego-reveal-image',
                { opacity: 0, scale: 0.98 },
                {
                  opacity: 1,
                  scale: 1,
                  duration: 0.42,
                  stagger: 0.08,
                  ease: 'power3.out',
                  clearProps: 'transform,opacity',
                },
                0.06,
              );
            }
          }

          return () => {
            reverted = true;
          };
        },
        stageRef,
      );

      return () => mm.revert();
    },
    { scope: stageRef, dependencies: [activeMode, embedStage] },
  );

  // 4. Fade stego images cleanly into the 3 overview slots when embedResult arrives directly in overview
  useGSAP(
    () => {
      if (!embedResult || activeMode !== 'embed' || embedStage !== 'overview') return;
      if (enteringOverviewFromLiveRef.current || returningFromFocusRef.current) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          isMotionOk: '(prefers-reduced-motion: no-preference)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
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
    { scope: stageRef, dependencies: [embedResult, embedStage] },
  );

  // 5. Crisp crossfade/slide when switching between 01 | 02 | 03 in focus stage
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
        {
          isMotionOk: '(prefers-reduced-motion: no-preference)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          if (context.conditions?.reduceMotion) return;

          gsap.fromTo(
            '.focus-swap-content',
            { x: dir * 24, autoAlpha: 0 },
            {
              x: 0,
              autoAlpha: 1,
              duration: 0.34,
              ease: 'power3.out',
              clearProps: 'transform,opacity,visibility',
            },
          );
        },
        stageRef,
      );

      return () => mm.revert();
    },
    { scope: stageRef, dependencies: [focusedScheme] },
  );

  const runBackToComposeAnimation = (clearError: boolean) => {
    activeTimelineRef.current?.kill();
    activeTimelineRef.current = null;
    returningFromFocusRef.current = false;
    enteringOverviewFromLiveRef.current = false;

    if (clearError) {
      setEmbedError(null);
    }

    const isDesktop = isDesktopViewport();

    if (prefersReducedMotion()) {
      if (rightPaneRef.current) {
        gsap.set(rightPaneRef.current, { x: 0, autoAlpha: 0, pointerEvents: 'none' });
      }
      gsap.set('.split-left-chrome', { y: 10, autoAlpha: 0, pointerEvents: 'none' });
      if (heroPaneRef.current) {
        gsap.set(heroPaneRef.current, {
          xPercent: isDesktop ? 50 : 0,
          autoAlpha: 1,
          pointerEvents: 'auto',
        });
      }
      if (sampleFrameRef.current) {
        gsap.set(sampleFrameRef.current, { scale: 1 });
      }
      if (topSliderRef.current) {
        gsap.set(topSliderRef.current, { y: 0, autoAlpha: 1 });
      }
      if (bottomComposerRef.current) {
        gsap.set(bottomComposerRef.current, { y: 0, autoAlpha: 1 });
      }
      if (composeCaptionRef.current) {
        gsap.set(composeCaptionRef.current, { y: 0, autoAlpha: 1 });
      }
      embedStageRef.current = 'compose';
      prevFocusedSchemeRef.current = null;
      setFocusedScheme(null);
      setEmbedStage('compose');
      setIsTransitioningOut(false);
      return;
    }

    setIsTransitioningOut(true);

    const tl = gsap.timeline({
      onComplete: () => {
        if (activeTimelineRef.current === tl) {
          activeTimelineRef.current = null;
        }
        if (rightPaneRef.current) {
          gsap.set(rightPaneRef.current, { x: 0 });
        }
        embedStageRef.current = 'compose';
        prevFocusedSchemeRef.current = null;
        setFocusedScheme(null);
        setEmbedStage('compose');
        setIsTransitioningOut(false);
      },
    });
    activeTimelineRef.current = tl;

    if (rightPaneRef.current) {
      tl.set(rightPaneRef.current, { pointerEvents: 'none' }, 0).to(
        rightPaneRef.current,
        { x: 24, autoAlpha: 0, duration: 0.26, ease: 'power2.in' },
        0,
      );
    }

    tl.set('.split-left-chrome', { pointerEvents: 'none' }, 0).to(
      '.split-left-chrome',
      { y: 10, autoAlpha: 0, duration: 0.24, ease: 'power2.in' },
      0,
    );

    if (heroPaneRef.current) {
      if (isDesktop) {
        tl.to(
          heroPaneRef.current,
          { xPercent: 50, autoAlpha: 1, pointerEvents: 'auto', duration: 0.56, ease: 'power3.inOut' },
          0.18,
        );
      } else {
        tl.to(
          heroPaneRef.current,
          { xPercent: 0, autoAlpha: 1, pointerEvents: 'auto', duration: 0.36, ease: 'power3.out' },
          0.18,
        );
      }
    }

    if (sampleFrameRef.current) {
      if (isDesktop) {
        tl.to(
          sampleFrameRef.current,
          { scale: 1, duration: 0.56, ease: 'power3.inOut' },
          0.18,
        );
      } else {
        tl.set(sampleFrameRef.current, { scale: 1 }, 0.18);
      }
    }

    if (topSliderRef.current) {
      tl.to(
        topSliderRef.current,
        { y: 0, autoAlpha: 1, duration: 0.36, ease: 'power3.out' },
        0.52,
      );
    }

    if (bottomComposerRef.current) {
      tl.to(
        bottomComposerRef.current,
        { y: 0, autoAlpha: 1, duration: 0.36, ease: 'power3.out' },
        0.52,
      );
    }

    if (composeCaptionRef.current) {
      tl.to(
        composeCaptionRef.current,
        { y: 0, autoAlpha: 1, duration: 0.3, ease: 'power3.out' },
        0.56,
      );
    }
  };

  const handleEmbed = () => {
    if (!selectedSample || isEmbedding || isTransitioningOut) return;

    embedRequestIdRef.current += 1;
    const reqId = embedRequestIdRef.current;
    const reduceMotion = prefersReducedMotion();
    const targetStage: EmbedStage = reduceMotion ? 'overview' : 'live';

    setIsEmbedding(true);
    setEmbedError(null);
    setEmbedResult(null);
    setLiveSchemeIndex(null);
    setFocusedScheme(null);
    prevFocusedSchemeRef.current = null;
    returningFromFocusRef.current = false;
    enteringOverviewFromLiveRef.current = false;
    embedStageRef.current = targetStage;
    setEmbedStage(targetStage);

    // Kick off API call immediately in parallel with the single-stage timeline
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
        runBackToComposeAnimation(false);
      });

    const isDesktop = isDesktopViewport();

    if (reduceMotion) {
      if (topSliderRef.current) {
        gsap.set(topSliderRef.current, { y: -28, autoAlpha: 0 });
      }
      if (bottomComposerRef.current) {
        gsap.set(bottomComposerRef.current, { y: 28, autoAlpha: 0 });
      }
      if (composeCaptionRef.current) {
        gsap.set(composeCaptionRef.current, { y: 8, autoAlpha: 0 });
      }
      if (heroPaneRef.current) {
        gsap.set(heroPaneRef.current, {
          xPercent: 0,
          autoAlpha: isDesktop ? 1 : 0,
          pointerEvents: isDesktop ? 'auto' : 'none',
        });
      }
      if (sampleFrameRef.current) {
        gsap.set(sampleFrameRef.current, { scale: isDesktop ? 1.06 : 1 });
      }
      gsap.set('.split-left-chrome', { y: 0, autoAlpha: 1, pointerEvents: 'auto' });
      if (rightPaneRef.current) {
        gsap.set(rightPaneRef.current, { x: 0, autoAlpha: 1, pointerEvents: 'auto' });
      }
      gsap.set('.stego-overview-slot', { x: 0, autoAlpha: 1 });
      return;
    }

    activeTimelineRef.current?.kill();
    setIsTransitioningOut(true);

    if (rightPaneRef.current) {
      gsap.set(rightPaneRef.current, { x: 28, autoAlpha: 0, pointerEvents: 'none' });
    }

    const tl = gsap.timeline({
      onComplete: () => {
        if (activeTimelineRef.current === tl) {
          activeTimelineRef.current = null;
        }
        setIsTransitioningOut(false);
      },
    });
    activeTimelineRef.current = tl;

    // Step 1 (0.00s): Slide top slider, bottom composer, and compose caption out
    if (topSliderRef.current) {
      tl.to(
        topSliderRef.current,
        { y: -28, autoAlpha: 0, duration: 0.3, ease: 'power2.in' },
        0,
      );
    }
    if (bottomComposerRef.current) {
      tl.to(
        bottomComposerRef.current,
        { y: 28, autoAlpha: 0, duration: 0.3, ease: 'power2.in' },
        0,
      );
    }
    if (composeCaptionRef.current) {
      tl.to(
        composeCaptionRef.current,
        { y: 8, autoAlpha: 0, duration: 0.22, ease: 'power2.in' },
        0,
      );
    }

    // Step 2 (0.32s): Glide hero pane smoothly from center -> left 50% + subtle scale polish
    if (heroPaneRef.current) {
      if (isDesktop) {
        tl.to(
          heroPaneRef.current,
          { xPercent: 0, duration: 0.62, ease: 'power3.inOut' },
          0.32,
        );
      } else {
        tl.to(
          heroPaneRef.current,
          { autoAlpha: 0, pointerEvents: 'none', duration: 0.34, ease: 'power2.in' },
          0.42,
        );
      }
    }

    if (sampleFrameRef.current && isDesktop) {
      tl.to(
        sampleFrameRef.current,
        { scale: 1.06, duration: 0.62, ease: 'power3.inOut' },
        0.32,
      );
    }

    tl.set('.split-left-chrome', { pointerEvents: 'auto' }, 0.62).to(
      '.split-left-chrome',
      { y: 0, autoAlpha: 1, duration: 0.38, ease: 'power3.out' },
      0.62,
    );

    // Step 3 (0.72s): Reveal right 50% pane in 'live' stage
    if (rightPaneRef.current) {
      tl.fromTo(
        rightPaneRef.current,
        { x: 28, autoAlpha: 0 },
        {
          x: 0,
          autoAlpha: 1,
          pointerEvents: 'auto',
          duration: 0.44,
          ease: 'power3.out',
          clearProps: 'transform',
        },
        0.72,
      );
    }
  };

  const handleTransitionLiveToOverview = useCallback(() => {
    if (embedStageRef.current !== 'live') return;
    setLiveSchemeIndex(null);
    enteringOverviewFromLiveRef.current = true;
    embedStageRef.current = 'overview';
    setEmbedStage('overview');
  }, []);

  const handleBackToCompose = () => {
    embedRequestIdRef.current += 1;
    setIsEmbedding(false);
    setLiveSchemeIndex(null);
    runBackToComposeAnimation(true);
  };

  const handleSelectOverviewScheme = (scheme: SchemeName) => {
    if (!embedResult) return;
    returningFromFocusRef.current = false;
    prevFocusedSchemeRef.current = null;
    embedStageRef.current = 'focus';
    setFocusedScheme(scheme);
    setEmbedStage('focus');
  };

  const handleSwitchFocusedScheme = (nextScheme: SchemeName) => {
    if (!focusedScheme || nextScheme === focusedScheme) return;
    const prevIdx = ALL_SCHEMES.indexOf(focusedScheme);
    const nextIdx = ALL_SCHEMES.indexOf(nextScheme);
    focusSwitchDirRef.current = nextIdx >= prevIdx ? 1 : -1;
    setFocusedScheme(nextScheme);
  };

  const handleReturnToOverview = () => {
    returningFromFocusRef.current = true;
    prevFocusedSchemeRef.current = null;
    embedStageRef.current = 'overview';
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
              onClick={() => {
                if (embedStageRef.current === 'live' && embedResult) {
                  setLiveSchemeIndex(null);
                  embedStageRef.current = 'overview';
                  setEmbedStage('overview');
                }
                setActiveMode('extract');
              }}
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
          <main className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden">
            {/* Layer 1: Top Full-Width Slider */}
            <div
              ref={topSliderRef}
              aria-hidden={!isCompose}
              className="absolute top-0 right-0 left-0 z-20 pt-4 will-change-transform"
            >
              <TopSampleSlider
                samples={orderedSamples}
                selectedSampleKey={selectedSampleKey}
                samplesLoading={samplesLoading}
                samplesError={samplesError}
                disabled={isTransitioningOut || isEmbedding || !isCompose}
                onSelectSample={(sample) => setSelectedSample(sample)}
                onRetry={() => {
                  setSamplesLoading(true);
                  setSamplesError(null);
                  void loadCatalogAndHealth();
                }}
              />
            </div>

            {/* Layer 2: Hero Sample Layer (centered via xPercent: 50 in compose, glides to xPercent: 0 left 50% on embed) */}
            <section
              ref={heroPaneRef}
              className="absolute inset-y-0 left-0 z-10 flex w-full flex-col justify-between p-4 sm:p-5 lg:w-1/2 lg:p-7 will-change-transform"
            >
              {/* Left-pane top bar (revealed at t = 0.62s) */}
              <div
                aria-hidden={isCompose}
                className="split-left-chrome invisible pointer-events-none flex shrink-0 items-center justify-between gap-2 opacity-0"
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

              {/* Persistent Hero Square Frame */}
              <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 py-2">
                <div className="relative flex items-center justify-center">
                  <div
                    ref={sampleFrameRef}
                    className="relative aspect-square w-[clamp(190px,35vh,340px)] overflow-hidden rounded-2xl border border-[#E4DFD3] bg-[#FDFCF9] shadow-[0_24px_60px_-32px_rgba(17,17,16,0.28)] will-change-transform"
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
                    {embedStage === 'live' && (
                      <>
                        <div
                          ref={coverScanlineRef}
                          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] bg-[#9A6B2F] opacity-0 shadow-[0_0_16px_4px_rgba(154,107,47,0.45)]"
                        />
                        <div
                          ref={coverReticleRef}
                          className="pointer-events-none absolute top-[12%] left-[12%] z-10 h-9 w-9 -translate-x-1/2 -translate-y-1/2 opacity-0"
                        >
                          <span className="absolute top-0 left-0 h-2.5 w-2.5 border-t-2 border-l-2 border-[#9A6B2F]" />
                          <span className="absolute top-0 right-0 h-2.5 w-2.5 border-t-2 border-r-2 border-[#9A6B2F]" />
                          <span className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b-2 border-l-2 border-[#9A6B2F]" />
                          <span className="absolute right-0 bottom-0 h-2.5 w-2.5 border-r-2 border-b-2 border-[#9A6B2F]" />
                          <span className="absolute top-1/2 left-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9A6B2F]" />
                        </div>
                        {liveSchemeIndex !== null && (
                          <div className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-full border border-[#FDFCF9]/80 bg-[#111110]/75 px-2.5 py-1 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-[#FDFCF9] backdrop-blur-sm">
                            Writing pixels · 0{liveSchemeIndex + 1}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {displaySample && (
                    <div
                      aria-hidden={!isCompose}
                      className="pointer-events-none absolute top-full left-1/2 mt-3 -translate-x-1/2"
                    >
                      <div
                        ref={composeCaptionRef}
                        className="compose-hero-caption whitespace-nowrap rounded-full border border-[#E4DFD3] bg-[#FDFCF9]/90 px-2.5 py-0.5 font-mono-tabular text-[11px] text-[#6B665C] will-change-transform"
                      >
                        {displaySample.filename}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Left-pane footer (revealed at t = 0.62s) */}
              <div
                aria-hidden={isCompose}
                className="split-left-chrome invisible pointer-events-none flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#E4DFD3] pt-3 font-mono-tabular text-[11px] text-[#6B665C] opacity-0"
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
            </section>

            {/* Layer 3: Bottom Message Composer */}
            <div
              aria-hidden={!isCompose}
              className="pointer-events-none absolute bottom-0 left-1/2 z-20 w-full max-w-[520px] -translate-x-1/2 px-4 pb-5"
            >
              <div
                ref={bottomComposerRef}
                className="compose-bottom-composer pointer-events-auto w-full will-change-transform"
              >
                <textarea
                  id="hifi-payload-input"
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isTransitioningOut || isEmbedding || !isCompose}
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
                          disabled={isEmbedding || isTransitioningOut || !isCompose}
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
                    disabled={!selectedSample || isEmbedding || isTransitioningOut || !isCompose}
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
            </div>

            {/* Layer 4: Right 50% Stego Results Layer */}
            <div
              ref={rightPaneRef}
              aria-hidden={isCompose}
              className="invisible pointer-events-none absolute inset-y-0 right-0 z-10 flex w-full flex-col bg-[#F6F4EF] opacity-0 lg:w-1/2 lg:border-l lg:border-[#E4DFD3] will-change-transform"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#E4DFD3] px-4 py-2.5 lg:hidden">
                <button
                  type="button"
                  onClick={handleBackToCompose}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-[#FDFCF9] px-3 py-1 text-xs font-medium text-[#111110] transition-colors hover:border-[#111110]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>New Embed</span>
                </button>
                <span className="font-mono-tabular text-[11px] text-[#6B665C]">
                  {coverFilename} · {formatBytes(activePayloadBytes)}
                </span>
              </div>

              <div className="min-h-0 flex-1">
                {embedStage === 'live' ? (
                  <LiveEmbeddingPane
                    embedResult={embedResult}
                    coverImageUrl={displaySample?.image_url ?? ''}
                    imageWidth={displaySample?.width ?? 512}
                    imageHeight={displaySample?.height ?? 512}
                    isIntroTransitioning={isTransitioningOut}
                    coverReticleRef={coverReticleRef}
                    coverScanlineRef={coverScanlineRef}
                    onSchemeChange={setLiveSchemeIndex}
                    onComplete={handleTransitionLiveToOverview}
                    onSkip={handleTransitionLiveToOverview}
                  />
                ) : embedStage === 'focus' && embedResult && focusedScheme ? (
                  <StegoFocusPane
                    embedResult={embedResult}
                    focusedScheme={focusedScheme}
                    viewMode={viewMode}
                    onSwitchScheme={handleSwitchFocusedScheme}
                    onShowAll={handleReturnToOverview}
                    onChangeViewMode={setViewMode}
                    onExtractFile={handleExtractFile}
                  />
                ) : (
                  <StegoOverviewPane
                    embedResult={embedResult}
                    isEmbedding={isEmbedding}
                    onSelectScheme={handleSelectOverviewScheme}
                  />
                )}
              </div>
            </div>
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
