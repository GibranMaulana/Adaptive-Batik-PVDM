import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  AlertCircle,
  Check,
  FastForward,
  Loader2,
  Pause,
  Play,
  ScanLine,
} from 'lucide-react';
import { base64ToPngDataUrl } from '../../api/client';
import type {
  CalculationStep,
  EmbedResponse,
  SchemeEmbedResult,
  SchemeName,
} from '../../api/types';
import { ALL_SCHEMES } from '../../utils/payload';

gsap.registerPlugin(useGSAP);

interface LiveEmbeddingPaneProps {
  embedResult: EmbedResponse | null;
  coverImageUrl: string;
  imageWidth: number;
  imageHeight: number;
  isIntroTransitioning: boolean;
  coverReticleRef?: React.RefObject<HTMLDivElement | null>;
  coverScanlineRef?: React.RefObject<HTMLDivElement | null>;
  onSchemeChange?: (schemeIndex: number | null) => void;
  onComplete: () => void;
  onSkip: () => void;
}

interface SchemePillMeta {
  name: SchemeName;
  pillLabel: string;
  title: string;
}

const SCHEME_PILLS: SchemePillMeta[] = [
  { name: 'scheme1', pillLabel: '01 · MPI', title: 'Modified Pixel Indicator' },
  { name: 'scheme2', pillLabel: '02 · Symmetric', title: 'Symmetric RGB PVDM' },
  { name: 'scheme3', pillLabel: '03 · Proposed HVS', title: 'HVS-Asymmetric RGB PVDM' },
];

const MAX_BIT_CHIPS = 8;

interface ActiveStepDisplay {
  step: CalculationStep;
  stepNumber: number;
  totalSteps: number;
}

interface ChannelPalette {
  badgeClass: string;
  swatchClass: string;
  barClass: string;
  label: string;
}

function getChannelPalette(channel: CalculationStep['channel'] | undefined): ChannelPalette {
  if (channel === 'R') {
    return {
      badgeClass: 'border-[#B45309]/35 bg-[#B45309]/10 text-[#B45309]',
      swatchClass: 'border-[#B45309]/30 bg-[#B45309]/[0.05]',
      barClass: 'bg-[#DC2626]/75',
      label: 'Red (R)',
    };
  }
  if (channel === 'G') {
    return {
      badgeClass: 'border-[#15803D]/35 bg-[#15803D]/10 text-[#15803D]',
      swatchClass: 'border-[#15803D]/30 bg-[#15803D]/[0.05]',
      barClass: 'bg-[#15803D]/75',
      label: 'Green (G)',
    };
  }
  if (channel === 'B') {
    return {
      badgeClass: 'border-[#2563EB]/35 bg-[#2563EB]/10 text-[#2563EB]',
      swatchClass: 'border-[#2563EB]/30 bg-[#2563EB]/[0.05]',
      barClass: 'bg-[#2563EB]/75',
      label: 'Blue (B)',
    };
  }
  return {
    badgeClass: 'border-[#E4DFD3] bg-[#F6F4EF] text-[#6B665C]',
    swatchClass: 'border-[#E4DFD3] bg-[#F6F4EF]/60',
    barClass: 'bg-[#9A6B2F]/60',
    label: 'Channel',
  };
}

function pickRepresentativeSteps(steps: CalculationStep[]): CalculationStep[] {
  if (steps.length <= 3) return steps;
  const mid = Math.floor((steps.length - 1) / 2);
  const indices = Array.from(new Set([0, mid, steps.length - 1]));
  return indices.map((idx) => steps[idx]);
}

function clampPercent(value: number, min = 10, max = 90): string {
  return `${Math.min(max, Math.max(min, value)).toFixed(1)}%`;
}

export function LiveEmbeddingPane({
  embedResult,
  coverImageUrl,
  imageWidth,
  imageHeight,
  isIntroTransitioning,
  coverReticleRef,
  coverScanlineRef,
  onSchemeChange,
  onComplete,
  onSkip,
}: LiveEmbeddingPaneProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const liveTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const stegoLayerRefs = useRef<(HTMLImageElement | null)[]>([]);
  const wipeScanlineRef = useRef<HTMLDivElement | null>(null);
  const overflowOverlayRef = useRef<HTMLDivElement | null>(null);

  const barXRef = useRef<HTMLDivElement | null>(null);
  const barYRef = useRef<HTMLDivElement | null>(null);
  const valXRef = useRef<HTMLSpanElement | null>(null);
  const valYRef = useRef<HTMLSpanElement | null>(null);
  const bitChipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const onCompleteRef = useRef(onComplete);
  const onSkipRef = useRef(onSkip);
  const onSchemeChangeRef = useRef(onSchemeChange);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onSkipRef.current = onSkip;
  }, [onSkip]);

  useEffect(() => {
    onSchemeChangeRef.current = onSchemeChange;
  }, [onSchemeChange]);

  const [activeSchemeIndex, setActiveSchemeIndex] = useState<number>(0);
  const [completedSchemes, setCompletedSchemes] = useState<Set<SchemeName>>(() => new Set());
  const [activeStepInfo, setActiveStepInfo] = useState<ActiveStepDisplay | null>(null);
  const [overflowMessage, setOverflowMessage] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const resultMap = useMemo(() => {
    const map = new Map<SchemeName, SchemeEmbedResult>();
    if (embedResult) {
      for (const item of embedResult.results) {
        map.set(item.scheme, item);
      }
    }
    return map;
  }, [embedResult]);

  useGSAP(
    () => {
      if (!embedResult || isIntroTransitioning) {
        liveTimelineRef.current = null;
        setIsPaused(false);
        return;
      }

      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: '(prefers-reduced-motion: reduce)' },
        (context) => {
          if (context.conditions?.reduceMotion) {
            onSchemeChangeRef.current?.(null);
            onCompleteRef.current();
            return;
          }

          let reverted = false;

          setActiveSchemeIndex(0);
          setCompletedSchemes(new Set());
          setActiveStepInfo(null);
          setOverflowMessage(null);
          setIsPaused(false);

          for (const layer of stegoLayerRefs.current) {
            if (layer) {
              gsap.set(layer, { clipPath: 'inset(0% 0% 100% 0%)', autoAlpha: 0 });
            }
          }
          if (wipeScanlineRef.current) {
            gsap.set(wipeScanlineRef.current, { top: '0%', autoAlpha: 0 });
          }
          if (overflowOverlayRef.current) {
            gsap.set(overflowOverlayRef.current, { autoAlpha: 0, scale: 0.96 });
          }
          if (coverScanlineRef?.current) {
            gsap.set(coverScanlineRef.current, { top: '0%', autoAlpha: 0 });
          }
          if (coverReticleRef?.current) {
            gsap.set(coverReticleRef.current, {
              left: '12%',
              top: '12%',
              autoAlpha: 0,
              scale: 1,
            });
          }
          if (progressBarRef.current) {
            gsap.set(progressBarRef.current, { scaleX: 0 });
          }
          if (barXRef.current) {
            gsap.set(barXRef.current, { scaleY: 0.05 });
          }
          if (barYRef.current) {
            gsap.set(barYRef.current, { scaleY: 0.05 });
          }

          const okCount = ALL_SCHEMES.filter(
            (name) => resultMap.get(name)?.status === 'ok' && resultMap.get(name)?.stego_png_base64,
          ).length;
          const overflowDuration = 0.85;
          const okDuration = okCount === 3 ? 1.5 : okCount === 2 ? 1.85 : 2.3;

          const tl = gsap.timeline({
            onComplete: () => {
              if (reverted) return;
              if (liveTimelineRef.current === tl) {
                liveTimelineRef.current = null;
              }
              onSchemeChangeRef.current?.(null);
              onCompleteRef.current();
            },
          });
          liveTimelineRef.current = tl;

          let cursorTime = 0;

          ALL_SCHEMES.forEach((scheme, schemeIdx) => {
            const result = resultMap.get(scheme);
            const schemeStart = cursorTime;
            const isOk = Boolean(result?.status === 'ok' && result?.stego_png_base64);

            tl.call(
              () => {
                if (reverted) return;
                setActiveSchemeIndex(schemeIdx);
                onSchemeChangeRef.current?.(schemeIdx);
              },
              [],
              schemeStart,
            );

            if (isOk && result) {
              const wipeDuration = okDuration - 0.12;
              const stegoLayer = stegoLayerRefs.current[schemeIdx];
              const repSteps = pickRepresentativeSteps(result.calculation_trace?.steps ?? []);

              tl.call(
                () => {
                  if (reverted) return;
                  setOverflowMessage(null);
                },
                [],
                schemeStart,
              );

              if (overflowOverlayRef.current) {
                tl.set(overflowOverlayRef.current, { autoAlpha: 0 }, schemeStart);
              }

              // Hide prior stego layers so the current scheme always wipes cleanly from Cover -> Stego
              stegoLayerRefs.current.forEach((layer, idx) => {
                if (layer && idx !== schemeIdx) {
                  tl.set(layer, { autoAlpha: 0 }, schemeStart);
                }
              });

              if (stegoLayer) {
                tl.set(
                  stegoLayer,
                  { autoAlpha: 1, clipPath: 'inset(0% 0% 100% 0%)' },
                  schemeStart,
                ).to(
                  stegoLayer,
                  {
                    clipPath: 'inset(0% 0% 0% 0%)',
                    duration: wipeDuration,
                    ease: 'power1.inOut',
                  },
                  schemeStart,
                );
              }

              if (wipeScanlineRef.current) {
                tl.fromTo(
                  wipeScanlineRef.current,
                  { top: '0%', autoAlpha: 1 },
                  { top: '100%', duration: wipeDuration, ease: 'power1.inOut' },
                  schemeStart,
                ).set(wipeScanlineRef.current, { autoAlpha: 0 }, schemeStart + wipeDuration);
              }

              if (coverScanlineRef?.current) {
                tl.fromTo(
                  coverScanlineRef.current,
                  { top: '0%', autoAlpha: 0.9 },
                  { top: '100%', duration: wipeDuration, ease: 'power1.inOut' },
                  schemeStart,
                ).set(coverScanlineRef.current, { autoAlpha: 0 }, schemeStart + wipeDuration);
              }

              if (repSteps.length > 0) {
                const stepDur = wipeDuration / repSteps.length;
                repSteps.forEach((step, sIdx) => {
                  const stepStart = schemeStart + sIdx * stepDur;
                  const bitsArray = step.payload_bits.split('').slice(0, MAX_BIT_CHIPS);

                  tl.call(
                    () => {
                      if (reverted) return;
                      setActiveStepInfo({
                        step,
                        stepNumber: sIdx + 1,
                        totalSteps: repSteps.length,
                      });
                      bitChipRefs.current.forEach((chip, cIdx) => {
                        if (!chip) return;
                        if (cIdx < bitsArray.length) {
                          chip.textContent = bitsArray[cIdx];
                          chip.classList.remove('hidden');
                          chip.classList.add('inline-flex');
                        } else {
                          chip.textContent = '';
                          chip.classList.add('hidden');
                          chip.classList.remove('inline-flex');
                        }
                      });
                    },
                    [],
                    stepStart,
                  );

                  const activeChips = bitChipRefs.current
                    .slice(0, bitsArray.length)
                    .filter((el): el is HTMLSpanElement => el !== null);

                  if (activeChips.length > 0) {
                    tl.fromTo(
                      activeChips,
                      { y: -12, autoAlpha: 0 },
                      {
                        y: 0,
                        autoAlpha: 1,
                        duration: Math.min(0.16, stepDur * 0.35),
                        stagger: 0.035,
                        ease: 'power2.out',
                      },
                      stepStart,
                    );
                  }

                  const fromX = Math.max(0.03, step.before[0] / 255);
                  const toX = Math.max(0.03, step.after[0] / 255);
                  const fromY = Math.max(0.03, step.before[1] / 255);
                  const toY = Math.max(0.03, step.after[1] / 255);

                  if (barXRef.current) {
                    tl.fromTo(
                      barXRef.current,
                      { scaleY: fromX },
                      { scaleY: toX, duration: stepDur * 0.72, ease: 'power2.out' },
                      stepStart + 0.04,
                    );
                  }
                  if (barYRef.current) {
                    tl.fromTo(
                      barYRef.current,
                      { scaleY: fromY },
                      { scaleY: toY, duration: stepDur * 0.72, ease: 'power2.out' },
                      stepStart + 0.04,
                    );
                  }

                  const counter = { x: step.before[0], y: step.before[1] };
                  tl.to(
                    counter,
                    {
                      x: step.after[0],
                      y: step.after[1],
                      duration: stepDur * 0.72,
                      ease: 'power2.out',
                      onUpdate: () => {
                        if (reverted) return;
                        if (valXRef.current) {
                          valXRef.current.textContent = String(Math.round(counter.x));
                        }
                        if (valYRef.current) {
                          valYRef.current.textContent = String(Math.round(counter.y));
                        }
                      },
                    },
                    stepStart + 0.04,
                  );

                  if (coverReticleRef?.current) {
                    const targetLeft = clampPercent(
                      10 + (step.columns[0] / Math.max(imageWidth, 1)) * 80,
                    );
                    const targetTop = clampPercent(
                      10 + (step.row / Math.max(imageHeight, 1)) * 80,
                    );

                    tl.to(
                      coverReticleRef.current,
                      {
                        left: targetLeft,
                        top: targetTop,
                        autoAlpha: 1,
                        duration: stepDur * 0.55,
                        ease: 'power2.out',
                      },
                      stepStart,
                    ).fromTo(
                      coverReticleRef.current,
                      { scale: 1.18 },
                      { scale: 1, duration: stepDur * 0.45, ease: 'power2.out' },
                      stepStart + 0.02,
                    );
                  }
                });
              }

              tl.call(
                () => {
                  if (reverted) return;
                  setCompletedSchemes((prev) => new Set([...prev, scheme]));
                },
                [],
                schemeStart + wipeDuration,
              );

              cursorTime += okDuration;
            } else {
              // Overflow or failed scheme: brief ~0.85s visual badge and advance smoothly
              stegoLayerRefs.current.forEach((layer) => {
                if (layer) tl.set(layer, { autoAlpha: 0 }, schemeStart);
              });
              if (wipeScanlineRef.current) {
                tl.set(wipeScanlineRef.current, { autoAlpha: 0 }, schemeStart);
              }
              if (coverScanlineRef?.current) {
                tl.set(coverScanlineRef.current, { autoAlpha: 0 }, schemeStart);
              }
              if (coverReticleRef?.current) {
                tl.set(coverReticleRef.current, { autoAlpha: 0 }, schemeStart);
              }

              const reason =
                result?.error ?? 'Payload exceeds scheme capacity; advancing to next scheme.';

              tl.call(
                () => {
                  if (reverted) return;
                  setActiveStepInfo(null);
                  setOverflowMessage(reason);
                },
                [],
                schemeStart,
              );

              if (overflowOverlayRef.current) {
                tl.fromTo(
                  overflowOverlayRef.current,
                  { autoAlpha: 0, scale: 0.95 },
                  { autoAlpha: 1, scale: 1, duration: 0.22, ease: 'power2.out' },
                  schemeStart,
                ).to(
                  overflowOverlayRef.current,
                  { autoAlpha: 0, duration: 0.18, ease: 'power2.in' },
                  schemeStart + overflowDuration - 0.18,
                );
              }

              tl.call(
                () => {
                  if (reverted) return;
                  setCompletedSchemes((prev) => new Set([...prev, scheme]));
                },
                [],
                schemeStart + overflowDuration - 0.05,
              );

              cursorTime += overflowDuration;
            }
          });

          if (coverReticleRef?.current) {
            tl.set(coverReticleRef.current, { autoAlpha: 0 }, cursorTime);
          }

          if (progressBarRef.current && cursorTime > 0) {
            tl.fromTo(
              progressBarRef.current,
              { scaleX: 0 },
              { scaleX: 1, duration: cursorTime, ease: 'none' },
              0,
            );
          }

          tl.to({}, { duration: 0.15 }, cursorTime);

          return () => {
            reverted = true;
            tl.kill();
            if (liveTimelineRef.current === tl) {
              liveTimelineRef.current = null;
            }
          };
        },
        rootRef,
      );

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [embedResult, isIntroTransitioning] },
  );

  const handleTogglePause = () => {
    const tl = liveTimelineRef.current;
    if (!tl) return;
    const nextPaused = !tl.paused();
    tl.paused(nextPaused);
    setIsPaused(nextPaused);
  };

  const handleSkip = () => {
    const tl = liveTimelineRef.current;
    if (tl) {
      tl.kill();
      liveTimelineRef.current = null;
    }
    onSchemeChangeRef.current?.(null);
    onSkipRef.current();
  };

  const activePill = SCHEME_PILLS[activeSchemeIndex] ?? SCHEME_PILLS[0];
  const activeStep = activeStepInfo?.step ?? null;
  const palette = getChannelPalette(activeStep?.channel);
  const isWaitingForEngine = !embedResult;

  return (
    <section
      ref={rootRef}
      aria-label="Live embedding simulation"
      className="flex h-full min-h-0 flex-col justify-between gap-2.5 overflow-hidden p-4 font-sans sm:p-5"
    >
      {/* Top Row: 3 Scheme Pills + Play/Pause & Skip Controls */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {SCHEME_PILLS.map((pill, idx) => {
            const result = resultMap.get(pill.name);
            const isDone = completedSchemes.has(pill.name);
            const isCurrent = Boolean(embedResult) && idx === activeSchemeIndex && !isDone;
            const isOverflowDone = isDone && result?.status !== 'ok';

            return (
              <div
                key={pill.name}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors ${
                  isCurrent
                    ? 'border-[#9A6B2F] bg-[#9A6B2F]/12 text-[#9A6B2F]'
                    : isOverflowDone
                      ? 'border-[#B45309]/35 bg-[#B45309]/10 text-[#B45309]'
                      : isDone
                        ? 'border-[#15803D]/35 bg-[#15803D]/[0.07] text-[#15803D]'
                        : 'border-[#E4DFD3] bg-[#FDFCF9] text-[#6B665C]'
                }`}
              >
                {isDone ? (
                  isOverflowDone ? (
                    <AlertCircle className="h-3 w-3 shrink-0 text-[#B45309]" />
                  ) : (
                    <Check className="h-3 w-3 shrink-0 text-[#15803D]" />
                  )
                ) : isCurrent ? (
                  <ScanLine className="h-3 w-3 shrink-0 text-[#9A6B2F]" />
                ) : null}
                <span>{pill.pillLabel}</span>
              </div>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={isWaitingForEngine || isIntroTransitioning}
            onClick={handleTogglePause}
            aria-label={isPaused ? 'Play live simulation' : 'Pause live simulation'}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-[#FDFCF9] px-3 py-1 text-[11px] font-medium text-[#111110] transition-colors hover:border-[#9A6B2F] hover:text-[#9A6B2F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPaused ? (
              <>
                <Play className="h-3 w-3 fill-current" />
                <span>Play</span>
              </>
            ) : (
              <>
                <Pause className="h-3 w-3 fill-current" />
                <span>Pause</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="inline-flex items-center gap-1 rounded-full border border-[#111110] bg-[#111110] px-3 py-1 text-[11px] font-medium text-[#FDFCF9] transition-colors hover:border-[#9A6B2F] hover:bg-[#9A6B2F]"
          >
            <span>Skip</span>
            <FastForward className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Main Visual Canvas: Cover->Stego Wipe + Macro Pixel-Pair Loupe */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Panel A: Live Cover -> Stego Wipe Preview */}
        <div className="flex min-h-0 flex-col justify-between rounded-2xl border border-[#E4DFD3] bg-[#FDFCF9] p-3.5">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A6B2F]">
                Live Stego Wipe
              </p>
              <h2 className="font-editorial text-lg leading-tight text-[#111110]">
                {isWaitingForEngine ? 'Preparing Stego' : activePill.pillLabel}
              </h2>
            </div>
            <span className="rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[#6B665C]">
              {isWaitingForEngine
                ? 'Engine running'
                : overflowMessage
                  ? 'Overflow'
                  : 'Cover → Stego'}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center py-2">
            <div className="relative aspect-square h-full max-h-[260px] w-auto max-w-full overflow-hidden rounded-xl border border-[#E4DFD3] bg-[#F6F4EF] shadow-[0_14px_34px_-22px_rgba(17,17,16,0.28)]">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt="Original Batik cover preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-[#EFECE3]" />
              )}

              {ALL_SCHEMES.map((scheme, idx) => {
                const res = resultMap.get(scheme);
                if (res?.status !== 'ok' || !res.stego_png_base64) {
                  return null;
                }
                return (
                  <img
                    key={scheme}
                    ref={(el) => {
                      stegoLayerRefs.current[idx] = el;
                    }}
                    src={base64ToPngDataUrl(res.stego_png_base64)}
                    alt={`${SCHEME_PILLS[idx].title} stego output`}
                    className="absolute inset-0 h-full w-full object-cover opacity-0"
                  />
                );
              })}

              {/* Glowing sogan-gold wipe scanline */}
              <div
                ref={wipeScanlineRef}
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] bg-[#9A6B2F] opacity-0 shadow-[0_0_16px_4px_rgba(154,107,47,0.55)]"
              />

              {/* Overflow brief visual badge */}
              <div
                ref={overflowOverlayRef}
                className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FDFCF9]/88 p-4 text-center opacity-0 backdrop-blur-[2px]"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B45309]/35 bg-[#B45309]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#B45309]">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Capacity Overflow</span>
                </span>
                <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-[#6B665C]">
                  {overflowMessage ?? 'Exceeds scheme capacity'}
                </p>
              </div>

              {/* Editorial waiting state while embedPayload() is in flight */}
              {isWaitingForEngine && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FDFCF9]/78 p-4 text-center backdrop-blur-[2px]">
                  <Loader2 className="h-5 w-5 animate-spin text-[#9A6B2F]" />
                  <p className="mt-2.5 font-editorial text-base text-[#111110]">
                    Encoding RGB pairs…
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6B665C]">
                    Running Schemes 01–03
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 text-[11px] tabular-nums text-[#6B665C]">
            <span className="truncate">{activePill.title}</span>
            <span>
              {imageWidth} × {imageHeight}
            </span>
          </div>
        </div>

        {/* Panel B: Macro Pixel-Pair Loupe (P_x | P_y) */}
        <div className="relative flex min-h-0 flex-col justify-between rounded-2xl border border-[#E4DFD3] bg-[#FDFCF9] p-3.5">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A6B2F]">
                Macro Pixel-Pair Loupe
              </p>
              <h2 className="font-editorial text-lg leading-tight text-[#111110]">
                Pₓ | Pᵧ Morph
              </h2>
            </div>

            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tabular-nums transition-colors duration-200 ${palette.badgeClass}`}
            >
              {activeStep ? palette.label : 'Awaiting trace'}
            </span>
          </div>

          {/* Payload Bit Chips */}
          <div className="flex shrink-0 flex-col items-center gap-1 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#6B665C]">
              Payload Bit Word
            </span>
            <div className="flex min-h-[26px] flex-wrap items-center justify-center gap-1">
              {Array.from({ length: MAX_BIT_CHIPS }).map((_, idx) => (
                <span
                  key={idx}
                  ref={(el) => {
                    bitChipRefs.current[idx] = el;
                  }}
                  className="hidden h-6 min-w-[22px] items-center justify-center rounded-md border border-[#9A6B2F]/35 bg-[#9A6B2F]/10 px-1.5 text-xs font-semibold tabular-nums text-[#9A6B2F]"
                />
              ))}
              {!activeStep && (
                <span className="text-[11px] tabular-nums text-[#6B665C]">
                  {isWaitingForEngine ? 'Waiting for bits…' : '—'}
                </span>
              )}
            </div>
          </div>

          {/* Two Large Side-by-Side Pixel Swatches */}
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2.5 py-1">
            {/* P_x Swatch */}
            <div
              className={`flex min-h-0 flex-col justify-between rounded-xl border p-2.5 transition-colors duration-200 ${palette.swatchClass}`}
            >
              <div className="flex shrink-0 items-center justify-between text-[11px] font-semibold tabular-nums text-[#111110]">
                <span>Pₓ</span>
                <span className="text-[10px] font-normal text-[#6B665C]">
                  {activeStep ? `c${activeStep.columns[0] + 1}` : 'col₀'}
                </span>
              </div>

              <div className="relative my-1.5 flex min-h-[72px] w-full flex-1 items-end overflow-hidden rounded-lg border border-[#E4DFD3] bg-[#FDFCF9]">
                <div
                  ref={barXRef}
                  className={`h-full w-full origin-bottom transition-colors duration-200 ${palette.barClass}`}
                />
                <span
                  ref={valXRef}
                  className="pointer-events-none absolute right-2 bottom-1.5 rounded bg-[#FDFCF9]/90 px-1.5 py-0.5 text-xs font-bold tabular-nums text-[#111110] shadow-xs"
                >
                  {activeStep ? activeStep.before[0] : '—'}
                </span>
              </div>

              <div className="flex shrink-0 items-center justify-between text-[10px] tabular-nums text-[#6B665C]">
                <span>0–255</span>
                <span className="font-semibold text-[#111110]">
                  {activeStep ? `${activeStep.before[0]} → ${activeStep.after[0]}` : '—'}
                </span>
              </div>
            </div>

            {/* P_y Swatch */}
            <div
              className={`flex min-h-0 flex-col justify-between rounded-xl border p-2.5 transition-colors duration-200 ${palette.swatchClass}`}
            >
              <div className="flex shrink-0 items-center justify-between text-[11px] font-semibold tabular-nums text-[#111110]">
                <span>Pᵧ</span>
                <span className="text-[10px] font-normal text-[#6B665C]">
                  {activeStep ? `c${activeStep.columns[1] + 1}` : 'col₁'}
                </span>
              </div>

              <div className="relative my-1.5 flex min-h-[72px] w-full flex-1 items-end overflow-hidden rounded-lg border border-[#E4DFD3] bg-[#FDFCF9]">
                <div
                  ref={barYRef}
                  className={`h-full w-full origin-bottom transition-colors duration-200 ${palette.barClass}`}
                />
                <span
                  ref={valYRef}
                  className="pointer-events-none absolute right-2 bottom-1.5 rounded bg-[#FDFCF9]/90 px-1.5 py-0.5 text-xs font-bold tabular-nums text-[#111110] shadow-xs"
                >
                  {activeStep ? activeStep.before[1] : '—'}
                </span>
              </div>

              <div className="flex shrink-0 items-center justify-between text-[10px] tabular-nums text-[#6B665C]">
                <span>0–255</span>
                <span className="font-semibold text-[#111110]">
                  {activeStep ? `${activeStep.before[1]} → ${activeStep.after[1]}` : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 text-[11px] tabular-nums text-[#6B665C]">
            <span>
              {activeStep
                ? `Row ${activeStep.row + 1} · Cols ${activeStep.columns[0] + 1}–${activeStep.columns[1] + 1}`
                : 'Pair coordinates'}
            </span>
            <span>
              {activeStepInfo
                ? `Sample ${activeStepInfo.stepNumber} / ${activeStepInfo.totalSteps}`
                : '—'}
            </span>
          </div>

          {/* Non-destructive overlay when engine is waiting or current scheme overflowed */}
          {(isWaitingForEngine || overflowMessage) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-[#FDFCF9]/90 p-5 text-center backdrop-blur-[2px]">
              {isWaitingForEngine ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-[#9A6B2F]" />
                  <p className="mt-2.5 text-xs font-medium text-[#111110]">
                    Awaiting observed PVDM trace…
                  </p>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B45309]/35 bg-[#B45309]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#B45309]">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>No Pair Writes</span>
                  </span>
                  <p className="mt-2 max-w-[220px] text-xs text-[#6B665C]">
                    Skipped due to capacity overflow — advancing to next scheme.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Compact Strip: Single Inline Formula Ribbon + Hairline Progress Bar */}
      <div className="shrink-0">
        <div className="truncate rounded-xl border border-[#E4DFD3] bg-[#FDFCF9] px-3 py-2 text-[11px] font-medium tabular-nums text-[#111110]">
          {activeStep ? (
            <>
              Ch {activeStep.channel} · ({activeStep.before[0]}, {activeStep.before[1]}) → (
              {activeStep.after[0]}, {activeStep.after[1]}) · Range [{activeStep.range[0]},{' '}
              {activeStep.range[1]}] · {activeStep.bits} bits · FREM {activeStep.frem_before} →{' '}
              {activeStep.frem_after}
              {activeStep.indicator !== undefined
                ? ` · PI ${activeStep.indicator.toString(2).padStart(2, '0')}`
                : ''}
            </>
          ) : isWaitingForEngine ? (
            <span className="text-[#6B665C]">
              Preparing cover → stego wipe preview and pixel-pair trace…
            </span>
          ) : overflowMessage ? (
            <span className="text-[#B45309]">{overflowMessage}</span>
          ) : (
            <span className="text-[#6B665C]">Initializing GSAP simulation timeline…</span>
          )}
        </div>

        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[#E4DFD3]">
          <div
            ref={progressBarRef}
            className="h-full w-full origin-left scale-x-0 bg-[#9A6B2F]"
          />
        </div>
      </div>
    </section>
  );
}
