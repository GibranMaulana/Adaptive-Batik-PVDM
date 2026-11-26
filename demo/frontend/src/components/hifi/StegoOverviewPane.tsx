import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { AlertCircle, ArrowRight } from 'lucide-react';
import type {
  CalculationStep,
  EmbedResponse,
  SchemeEmbedResult,
  SchemeName,
} from '../../api/types';
import { ALL_SCHEMES, formatBytes } from '../../utils/payload';
import { NeighborPixelStrip } from './NeighborPixelStrip';
import {
  PixelRasterCanvas,
  type PixelRasterCanvasHandle,
} from './PixelRasterCanvas';

gsap.registerPlugin(useGSAP);

const MASTER_DURATION = 3.8;
const OVERFLOW_PROGRESS = 0.22;

type RgbTriplet = [number, number, number];

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function resolveStepRgbPair(
  step: CalculationStep,
  phase: 'before' | 'after',
): [RgbTriplet, RgbTriplet] {
  const explicit = phase === 'before' ? step.rgb_before : step.rgb_after;
  if (
    Array.isArray(explicit) &&
    explicit.length === 2 &&
    Array.isArray(explicit[0]) &&
    explicit[0].length === 3 &&
    Array.isArray(explicit[1]) &&
    explicit[1].length === 3
  ) {
    return [
      [clampByte(explicit[0][0]), clampByte(explicit[0][1]), clampByte(explicit[0][2])],
      [clampByte(explicit[1][0]), clampByte(explicit[1][1]), clampByte(explicit[1][2])],
    ];
  }

  const values = phase === 'before' ? step.before : step.after;
  const xVal = clampByte(values?.[0] ?? 128);
  const yVal = clampByte(values?.[1] ?? 128);
  const toFallbackRgb = (v: number): RgbTriplet => {
    if (step.channel === 'R') return [v, Math.round(v * 0.45), Math.round(v * 0.4)];
    if (step.channel === 'G') return [Math.round(v * 0.45), v, Math.round(v * 0.45)];
    return [Math.round(v * 0.4), Math.round(v * 0.5), v];
  };
  return [toFallbackRgb(xVal), toFallbackRgb(yVal)];
}

function toCssRgb(rgb: RgbTriplet): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

interface StegoOverviewPaneProps {
  embedResult: EmbedResponse | null;
  coverImageUrl: string;
  imageWidth: number;
  imageHeight: number;
  isEmbedding: boolean;
  isIntroTransitioning: boolean;
  initialCompleted?: boolean;
  coverReticleRef?: RefObject<HTMLDivElement | null>;
  coverScanlineRef?: RefObject<HTMLDivElement | null>;
  onRasterComplete?: () => void;
  onSelectScheme: (scheme: SchemeName) => void;
}

const OVERVIEW_PILLS: Record<SchemeName, string> = {
  scheme1: '01 · Scheme 1',
  scheme2: '02 · Scheme 2',
  scheme3: '03 · Proposed HVS',
};

function selectRepresentativeSteps(
  resultMap: Map<SchemeName, SchemeEmbedResult>,
): CalculationStep[] {
  const preference: SchemeName[] = ['scheme3', 'scheme2', 'scheme1'];
  for (const scheme of preference) {
    const steps = resultMap.get(scheme)?.calculation_trace?.steps;
    if (Array.isArray(steps) && steps.length > 0) {
      if (steps.length <= 6) return steps;
      const picked: CalculationStep[] = [];
      const count = 6;
      for (let i = 0; i < count; i += 1) {
        const idx = Math.round((i * (steps.length - 1)) / (count - 1));
        if (!picked.includes(steps[idx])) {
          picked.push(steps[idx]);
        }
      }
      return picked;
    }
  }
  return [];
}

function clampReticlePercent(value: number, min = 10, max = 90): string {
  return `${Math.min(max, Math.max(min, value)).toFixed(1)}%`;
}

export function StegoOverviewPane({
  embedResult,
  coverImageUrl,
  imageWidth,
  imageHeight,
  isEmbedding,
  isIntroTransitioning,
  initialCompleted = false,
  coverReticleRef,
  coverScanlineRef,
  onRasterComplete,
  onSelectScheme,
}: StegoOverviewPaneProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const masterTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const canvasRefs = useRef<(PixelRasterCanvasHandle | null)[]>([null, null, null]);
  const overflowNoticeRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const swatchXRef = useRef<HTMLDivElement | null>(null);
  const swatchYRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const onRasterCompleteRef = useRef(onRasterComplete);
  useEffect(() => {
    onRasterCompleteRef.current = onRasterComplete;
  }, [onRasterComplete]);

  const [replayCount, setReplayCount] = useState(0);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(initialCompleted);
  const skipRequestedRef = useRef(false);

  const resultMap = useMemo(() => {
    const map = new Map<SchemeName, SchemeEmbedResult>();
    if (embedResult) {
      for (const item of embedResult.results) {
        map.set(item.scheme, item);
      }
    }
    return map;
  }, [embedResult]);

  const repSteps = useMemo(() => selectRepresentativeSteps(resultMap), [resultMap]);

  const snapToCompletedState = useCallback(() => {
    ALL_SCHEMES.forEach((scheme, idx) => {
      const result = resultMap.get(scheme);
      const isOk = result?.status === 'ok' && Boolean(result.stego_png_base64);
      const isOverflow = result?.status === 'overflow';
      const isFailed = result?.status === 'failed';

      if (isOk) {
        canvasRefs.current[idx]?.setProgress(1, false);
        if (overflowNoticeRefs.current[idx]) {
          gsap.set(overflowNoticeRefs.current[idx], { autoAlpha: 0, scale: 0.96 });
        }
      } else if (isOverflow || isFailed) {
        canvasRefs.current[idx]?.setProgress(isOverflow ? OVERFLOW_PROGRESS : 0, false);
        if (overflowNoticeRefs.current[idx]) {
          gsap.set(overflowNoticeRefs.current[idx], { autoAlpha: 1, scale: 1 });
        }
      } else {
        canvasRefs.current[idx]?.setProgress(0, false);
      }
    });

    if (repSteps.length > 0) {
      const lastIdx = repSteps.length - 1;
      setActiveStepIdx(lastIdx);
      const [afterX, afterY] = resolveStepRgbPair(repSteps[lastIdx], 'after');
      if (swatchXRef.current) {
        swatchXRef.current.style.backgroundColor = toCssRgb(afterX);
      }
      if (swatchYRef.current) {
        swatchYRef.current.style.backgroundColor = toCssRgb(afterY);
      }
    }

    if (progressBarRef.current) {
      gsap.set(progressBarRef.current, { scaleX: 1 });
    }
    if (coverReticleRef?.current) {
      gsap.set(coverReticleRef.current, { autoAlpha: 0 });
    }
    if (coverScanlineRef?.current) {
      gsap.set(coverScanlineRef.current, { autoAlpha: 0 });
    }

    setIsPaused(false);
    setIsComplete(true);
    onRasterCompleteRef.current?.();
  }, [coverReticleRef, coverScanlineRef, repSteps, resultMap]);

  useGSAP(
    () => {
      if (!embedResult) {
        masterTimelineRef.current = null;
        setIsPaused(false);
        setIsComplete(false);
        setActiveStepIdx(0);
        if (progressBarRef.current) {
          gsap.set(progressBarRef.current, { scaleX: 0 });
        }
        if (coverReticleRef?.current) {
          gsap.set(coverReticleRef.current, { autoAlpha: 0 });
        }
        if (coverScanlineRef?.current) {
          gsap.set(coverScanlineRef.current, { autoAlpha: 0 });
        }
        return;
      }

      if (isIntroTransitioning) {
        return;
      }

      const mm = gsap.matchMedia();
      mm.add(
        {
          isMotionOk: '(prefers-reduced-motion: no-preference)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const shouldSnap =
            Boolean(context.conditions?.reduceMotion) ||
            skipRequestedRef.current ||
            (initialCompleted && replayCount === 0);

          if (shouldSnap) {
            skipRequestedRef.current = false;
            snapToCompletedState();
            return;
          }

          let reverted = false;
          setIsPaused(false);
          setIsComplete(false);
          setActiveStepIdx(0);

          if (progressBarRef.current) {
            gsap.set(progressBarRef.current, { scaleX: 0 });
          }
          if (coverReticleRef?.current) {
            gsap.set(coverReticleRef.current, {
              left: '12%',
              top: '12%',
              autoAlpha: 0,
              scale: 1,
            });
          }
          if (coverScanlineRef?.current) {
            gsap.set(coverScanlineRef.current, { top: '0%', autoAlpha: 0 });
          }

          ALL_SCHEMES.forEach((scheme, idx) => {
            const result = resultMap.get(scheme);
            canvasRefs.current[idx]?.setProgress(0, true);
            if (overflowNoticeRefs.current[idx]) {
              const isFailed = result?.status === 'failed';
              gsap.set(overflowNoticeRefs.current[idx], {
                autoAlpha: isFailed ? 1 : 0,
                scale: isFailed ? 1 : 0.96,
              });
            }
          });

          const tl = gsap.timeline({
            onComplete: () => {
              if (reverted) return;
              if (masterTimelineRef.current === tl) {
                masterTimelineRef.current = null;
              }
              snapToCompletedState();
            },
          });
          masterTimelineRef.current = tl;

          // All 3 schemes generate pixel-by-pixel AT THE SAME TIME starting at t = 0
          ALL_SCHEMES.forEach((scheme, idx) => {
            const result = resultMap.get(scheme);
            const isOk = result?.status === 'ok' && Boolean(result.stego_png_base64);
            const isOverflow = result?.status === 'overflow';

            if (isOk) {
              const proxy = { p: 0 };
              tl.to(
                proxy,
                {
                  p: 1,
                  duration: MASTER_DURATION,
                  ease: 'none',
                  onUpdate: () => {
                    if (reverted) return;
                    canvasRefs.current[idx]?.setProgress(proxy.p, proxy.p < 1);
                  },
                },
                0,
              );
            } else if (isOverflow) {
              const overflowStopTime = MASTER_DURATION * 0.28;
              const proxy = { p: 0 };
              tl.to(
                proxy,
                {
                  p: OVERFLOW_PROGRESS,
                  duration: overflowStopTime,
                  ease: 'power1.out',
                  onUpdate: () => {
                    if (reverted) return;
                    canvasRefs.current[idx]?.setProgress(
                      proxy.p,
                      proxy.p < OVERFLOW_PROGRESS - 0.005,
                    );
                  },
                },
                0,
              );
              const noticeEl = overflowNoticeRefs.current[idx];
              if (noticeEl) {
                tl.fromTo(
                  noticeEl,
                  { autoAlpha: 0, scale: 0.95 },
                  { autoAlpha: 1, scale: 1, duration: 0.34, ease: 'power2.out' },
                  overflowStopTime,
                );
              }
            }
          });

          // Representative neighbor pixel morphs synced to the same master timeline
          if (repSteps.length > 0) {
            const stepDur = MASTER_DURATION / repSteps.length;
            repSteps.forEach((step, sIdx) => {
              const stepStart = sIdx * stepDur;
              const [beforeX, beforeY] = resolveStepRgbPair(step, 'before');
              const [afterX, afterY] = resolveStepRgbPair(step, 'after');

              const applyColorMorph = (t: number) => {
                if (reverted) return;
                const rx = Math.round(beforeX[0] + (afterX[0] - beforeX[0]) * t);
                const gx = Math.round(beforeX[1] + (afterX[1] - beforeX[1]) * t);
                const bx = Math.round(beforeX[2] + (afterX[2] - beforeX[2]) * t);
                const ry = Math.round(beforeY[0] + (afterY[0] - beforeY[0]) * t);
                const gy = Math.round(beforeY[1] + (afterY[1] - beforeY[1]) * t);
                const by = Math.round(beforeY[2] + (afterY[2] - beforeY[2]) * t);

                if (swatchXRef.current) {
                  swatchXRef.current.style.backgroundColor = `rgb(${rx}, ${gx}, ${bx})`;
                }
                if (swatchYRef.current) {
                  swatchYRef.current.style.backgroundColor = `rgb(${ry}, ${gy}, ${by})`;
                }
              };

              tl.call(
                () => {
                  if (reverted) return;
                  setActiveStepIdx(sIdx);
                  applyColorMorph(0);
                },
                [],
                stepStart,
              );

              const morphProxy = { t: 0 };
              tl.to(
                morphProxy,
                {
                  t: 1,
                  duration: Math.min(0.42, stepDur * 0.68),
                  ease: 'power2.out',
                  onUpdate: () => applyColorMorph(morphProxy.t),
                },
                stepStart + 0.04,
              );

              if (coverReticleRef?.current) {
                const targetLeft = clampReticlePercent(
                  10 + (step.columns[0] / Math.max(imageWidth, 1)) * 80,
                );
                const targetTop = clampReticlePercent(
                  10 + (step.row / Math.max(imageHeight, 1)) * 80,
                );

                tl.to(
                  coverReticleRef.current,
                  {
                    left: targetLeft,
                    top: targetTop,
                    autoAlpha: 1,
                    duration: Math.min(0.4, stepDur * 0.55),
                    ease: 'power2.out',
                  },
                  stepStart,
                ).fromTo(
                  coverReticleRef.current,
                  { scale: 1.18 },
                  { scale: 1, duration: Math.min(0.32, stepDur * 0.45), ease: 'power2.out' },
                  stepStart + 0.02,
                );
              }
            });
          }

          if (coverScanlineRef?.current) {
            tl.fromTo(
              coverScanlineRef.current,
              { top: '0%', autoAlpha: 0.45 },
              { top: '100%', duration: MASTER_DURATION - 0.15, ease: 'none' },
              0,
            ).to(
              coverScanlineRef.current,
              { autoAlpha: 0, duration: 0.18, ease: 'power2.out' },
              MASTER_DURATION - 0.18,
            );
          }

          if (coverReticleRef?.current) {
            tl.to(
              coverReticleRef.current,
              { autoAlpha: 0, duration: 0.25, ease: 'power2.out' },
              MASTER_DURATION - 0.25,
            );
          }

          if (progressBarRef.current) {
            tl.fromTo(
              progressBarRef.current,
              { scaleX: 0 },
              { scaleX: 1, duration: MASTER_DURATION, ease: 'none' },
              0,
            );
          }

          return () => {
            reverted = true;
            tl.kill();
            if (masterTimelineRef.current === tl) {
              masterTimelineRef.current = null;
            }
          };
        },
        rootRef,
      );

      return () => mm.revert();
    },
    {
      scope: rootRef,
      dependencies: [
        embedResult,
        isIntroTransitioning,
        replayCount,
        initialCompleted,
        snapToCompletedState,
      ],
    },
  );

  const handleTogglePause = () => {
    const tl = masterTimelineRef.current;
    if (!tl) return;
    const nextPaused = !tl.paused();
    tl.paused(nextPaused);
    setIsPaused(nextPaused);
  };

  const handleSkip = () => {
    if (!embedResult) {
      skipRequestedRef.current = true;
      return;
    }
    const tl = masterTimelineRef.current;
    if (tl) {
      tl.kill();
      masterTimelineRef.current = null;
    }
    snapToCompletedState();
  };

  const handleReplay = () => {
    skipRequestedRef.current = false;
    setIsComplete(false);
    setIsPaused(false);
    setReplayCount((c) => c + 1);
  };

  const activeStep = repSteps[activeStepIdx] ?? repSteps[0] ?? null;
  const initialRgbPair = activeStep
    ? resolveStepRgbPair(activeStep, isComplete ? 'after' : 'before')
    : null;
  const isWaitingForEngine = !embedResult || isEmbedding;

  return (
    <section
      ref={rootRef}
      aria-label="Stego overview gallery"
      className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden p-3 font-sans sm:p-4"
    >
      {/* Top Strip: Compact True-Color Neighbor Pixel Comparison + Controls */}
      <NeighborPixelStrip
        activeStep={activeStep}
        initialRgbPair={initialRgbPair}
        isWaitingForEngine={isWaitingForEngine}
        isPaused={isPaused}
        isComplete={isComplete}
        hasTrace={repSteps.length > 0}
        swatchXRef={swatchXRef}
        swatchYRef={swatchYRef}
        progressBarRef={progressBarRef}
        onTogglePause={handleTogglePause}
        onSkip={handleSkip}
        onReplay={handleReplay}
      />

      {/* 3 Simultaneous Stacked Raster Rows (100vh zero scroll) */}
      <div className="grid min-h-0 flex-1 grid-rows-3 gap-2.5">
        {ALL_SCHEMES.map((scheme, idx) => {
          const result = resultMap.get(scheme) ?? null;
          const isProposed = scheme === 'scheme3';
          const isLoading = !result || isEmbedding;
          const isOverflow = result?.status === 'overflow';
          const isFailed = result?.status === 'failed';
          const isOk = result?.status === 'ok' && Boolean(result.stego_png_base64);
          const canInspect = Boolean(result) && !isEmbedding && isComplete;

          return (
            <button
              key={scheme}
              type="button"
              disabled={!canInspect}
              onClick={() => {
                if (!canInspect) return;
                onSelectScheme(scheme);
              }}
              className={`stego-overview-slot group relative flex min-h-0 min-w-0 w-full items-center justify-center overflow-hidden rounded-2xl border p-2.5 text-left transition-colors focus:outline-none ${
                isLoading ? 'disabled:cursor-wait' : 'disabled:cursor-default'
              } ${
                isProposed
                  ? 'border-[#9A6B2F]/45 bg-[#FDFCF9] hover:border-[#9A6B2F] hover:shadow-[0_12px_32px_-20px_rgba(154,107,47,0.45)]'
                  : 'border-[#E4DFD3] bg-[#FDFCF9] hover:border-[#9A6B2F]/75 hover:shadow-[0_12px_28px_-22px_rgba(17,17,16,0.22)]'
              } ${canInspect ? 'cursor-pointer' : ''}`}
            >
              {/* Subtle top-left pill label */}
              <span
                className={`absolute top-2.5 left-3 z-20 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide tabular-nums ${
                  isProposed
                    ? 'border-[#9A6B2F]/40 bg-[#FDFCF9]/95 text-[#9A6B2F]'
                    : 'border-[#E4DFD3] bg-[#FDFCF9]/95 text-[#6B665C]'
                }`}
              >
                {OVERVIEW_PILLS[scheme]}
              </span>

              {/* Hover inspect badge once raster generation is complete */}
              {canInspect && (
                <span className="pointer-events-none absolute top-2.5 right-3 z-20 inline-flex items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#FDFCF9]/95 px-2.5 py-0.5 text-[10px] font-medium text-[#111110] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span>Inspect</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              )}

              {/* Slot body */}
              <div className="relative flex h-full w-full min-h-0 min-w-0 items-center justify-center">
                {isLoading ? (
                  <div className="relative flex aspect-square h-full max-h-full items-center justify-center overflow-hidden rounded-xl border border-[#E4DFD3] bg-[#F6F4EF] motion-safe:animate-pulse">
                    {coverImageUrl && (
                      <img
                        src={coverImageUrl}
                        alt=""
                        className="h-full w-full object-contain opacity-15"
                      />
                    )}
                    <div className="absolute h-1.5 w-10 rounded-full bg-[#D5CEBE]" />
                  </div>
                ) : (
                  <>
                    <PixelRasterCanvas
                      ref={(el) => {
                        canvasRefs.current[idx] = el;
                      }}
                      coverImageUrl={coverImageUrl}
                      stegoBase64={isOk ? (result?.stego_png_base64 ?? null) : null}
                      width={imageWidth}
                      height={imageHeight}
                      initialProgress={
                        initialCompleted
                          ? isOk
                            ? 1
                            : isOverflow
                              ? OVERFLOW_PROGRESS
                              : 0
                          : 0
                      }
                      initialShowCursor={!initialCompleted}
                      alt={`${OVERVIEW_PILLS[scheme]} stego output`}
                      className="rounded-lg"
                    />

                    {(isOverflow || isFailed) && (
                      <div
                        ref={(el) => {
                          overflowNoticeRefs.current[idx] = el;
                        }}
                        className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-[#FDFCF9]/82 px-6 text-center backdrop-blur-[1.5px] ${
                          initialCompleted ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider tabular-nums ${
                            isOverflow
                              ? 'border-[#B45309]/35 bg-[#B45309]/10 text-[#B45309]'
                              : 'border-rose-300 bg-rose-50 text-rose-800'
                          }`}
                        >
                          <AlertCircle className="h-3 w-3" />
                          <span>
                            {isOverflow ? 'Capacity Overflow' : isFailed ? 'Failed' : 'Unavailable'}
                          </span>
                        </span>
                        {result?.capacity && embedResult && (
                          <span className="text-[11px] tabular-nums text-[#6B665C]">
                            Payload {formatBytes(embedResult.payload_bytes)} exceeds max{' '}
                            {formatBytes(result.capacity.max_payload_bytes)}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
