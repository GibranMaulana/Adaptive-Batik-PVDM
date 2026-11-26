import type { RefObject } from 'react';
import { FastForward, Pause, Play, RotateCcw } from 'lucide-react';
import type { CalculationStep } from '../../api/types';

type RgbTriplet = [number, number, number];

function getRegionMeta(diff: number): {
  label: 'Smooth' | 'Texture' | 'Edge';
  badgeClass: string;
} {
  if (diff <= 7) {
    return {
      label: 'Smooth',
      badgeClass: 'border-[#15803D]/30 bg-[#15803D]/10 text-[#15803D]',
    };
  }
  if (diff <= 31) {
    return {
      label: 'Texture',
      badgeClass: 'border-[#9A6B2F]/35 bg-[#9A6B2F]/10 text-[#9A6B2F]',
    };
  }
  return {
    label: 'Edge',
    badgeClass: 'border-[#B45309]/35 bg-[#B45309]/10 text-[#B45309]',
  };
}

function getChannelBadgeClass(channel: CalculationStep['channel']): string {
  if (channel === 'R') return 'border-[#B45309]/30 bg-[#B45309]/10 text-[#B45309]';
  if (channel === 'G') return 'border-[#15803D]/30 bg-[#15803D]/10 text-[#15803D]';
  return 'border-[#2563EB]/30 bg-[#2563EB]/10 text-[#2563EB]';
}

interface NeighborPixelStripProps {
  activeStep: CalculationStep | null;
  initialRgbPair: [RgbTriplet, RgbTriplet] | null;
  isWaitingForEngine: boolean;
  isPaused: boolean;
  isComplete: boolean;
  hasTrace: boolean;
  swatchXRef: RefObject<HTMLDivElement | null>;
  swatchYRef: RefObject<HTMLDivElement | null>;
  progressBarRef: RefObject<HTMLDivElement | null>;
  onTogglePause: () => void;
  onSkip: () => void;
  onReplay: () => void;
}

export function NeighborPixelStrip({
  activeStep,
  initialRgbPair,
  isWaitingForEngine,
  isPaused,
  isComplete,
  hasTrace,
  swatchXRef,
  swatchYRef,
  progressBarRef,
  onTogglePause,
  onSkip,
  onReplay,
}: NeighborPixelStripProps) {
  const diff = activeStep ? activeStep.difference_before : 0;
  const region = getRegionMeta(diff);

  return (
    <div className="relative shrink-0 overflow-hidden rounded-xl border border-[#E4DFD3] bg-[#FDFCF9] px-3 py-2 font-sans">
      <div className="flex min-h-[30px] items-center justify-between gap-2">
        {/* Left: True-Color Neighbor Pixel Pair + |d| Bridge + Channel Badge */}
        {activeStep && initialRgbPair ? (
          <div className="flex min-w-0 items-center gap-2">
            {/* P_x + |d| bridge + P_y */}
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex items-center gap-1">
                <div
                  ref={swatchXRef}
                  style={{
                    backgroundColor: `rgb(${initialRgbPair[0][0]}, ${initialRgbPair[0][1]}, ${initialRgbPair[0][2]})`,
                  }}
                  title={`Pₓ true RGB (${initialRgbPair[0].join(', ')})`}
                  className="h-6 w-6 shrink-0 rounded-md border border-[#111110]/15 shadow-xs"
                />
                <span className="text-[11px] font-semibold tabular-nums text-[#111110]">Pₓ</span>
              </div>

              <span className="h-[1px] w-2 bg-[#D5CEBE]" aria-hidden="true" />

              <span className="inline-flex items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#111110]">
                <span>|d| = {diff}</span>
                <span
                  className={`rounded-full border px-1.5 py-[1px] text-[9px] font-semibold leading-none ${region.badgeClass}`}
                >
                  {region.label}
                </span>
              </span>

              <span className="h-[1px] w-2 bg-[#D5CEBE]" aria-hidden="true" />

              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold tabular-nums text-[#111110]">Pᵧ</span>
                <div
                  ref={swatchYRef}
                  style={{
                    backgroundColor: `rgb(${initialRgbPair[1][0]}, ${initialRgbPair[1][1]}, ${initialRgbPair[1][2]})`,
                  }}
                  title={`Pᵧ true RGB (${initialRgbPair[1].join(', ')})`}
                  className="h-6 w-6 shrink-0 rounded-md border border-[#111110]/15 shadow-xs"
                />
              </div>
            </div>

            {/* Tiny Channel Badge */}
            <span
              className={`hidden truncate rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums sm:inline-flex ${getChannelBadgeClass(activeStep.channel)}`}
            >
              Ch {activeStep.channel} · {activeStep.bits} bits · {activeStep.payload_bits || '—'}
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2 text-[11px] tabular-nums text-[#6B665C]">
            <span className="truncate">
              {isWaitingForEngine
                ? 'Encoding Schemes 01–03…'
                : hasTrace
                  ? 'Simultaneous pixel-by-pixel raster generation'
                  : 'Simultaneous 3-scheme raster preview'}
            </span>
          </div>
        )}

        {/* Right: Play/Pause & Skip OR Complete + Replay */}
        <div className="flex shrink-0 items-center gap-1.5">
          {!isComplete ? (
            <>
              <button
                type="button"
                disabled={isWaitingForEngine}
                onClick={onTogglePause}
                aria-label={isPaused ? 'Play raster generation' : 'Pause raster generation'}
                className="inline-flex items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2.5 py-1 text-[11px] font-medium text-[#111110] transition-colors hover:border-[#9A6B2F] hover:text-[#9A6B2F] disabled:cursor-not-allowed disabled:opacity-50"
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
                onClick={onSkip}
                className="inline-flex items-center gap-1 rounded-full border border-[#111110] bg-[#111110] px-2.5 py-1 text-[11px] font-medium text-[#FDFCF9] transition-colors hover:border-[#9A6B2F] hover:bg-[#9A6B2F]"
              >
                <span>Skip</span>
                <FastForward className="h-3 w-3" />
              </button>
            </>
          ) : (
            <>
              <span className="hidden text-[11px] font-medium text-[#6B665C] sm:inline">
                Click any stego to inspect
              </span>
              <button
                type="button"
                onClick={onReplay}
                aria-label="Replay raster generation"
                title="Replay raster generation"
                className="inline-flex items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2.5 py-1 text-[11px] font-medium text-[#111110] transition-colors hover:border-[#9A6B2F] hover:text-[#9A6B2F]"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Replay</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hairline progress bar */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-[2px] bg-[#E4DFD3]/70">
        <div
          ref={progressBarRef}
          className="h-full w-full origin-left scale-x-0 bg-[#9A6B2F]"
        />
      </div>
    </div>
  );
}
