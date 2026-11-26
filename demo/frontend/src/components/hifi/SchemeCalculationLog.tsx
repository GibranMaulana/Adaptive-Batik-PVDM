import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { AlertCircle, ArrowDown, CheckCircle2, Info } from 'lucide-react';
import type { CalculationStep, SchemeLiveState, SchemeName } from '../../api/types';
import {
  formatBytes,
  formatMetric,
  getFobpCount,
  getPsnrChannel,
  getPsnrTotal,
} from '../../utils/payload';
import { LiveStatusBadge } from './FourImageComparison';

gsap.registerPlugin(useGSAP);

interface SchemeCalculationLogProps {
  state: SchemeLiveState;
}

const LOG_PANEL_TITLES: Record<SchemeName, string> = {
  scheme1: '01 · Scheme 1 — Modified Pixel Indicator',
  scheme2: '02 · Scheme 2 — Symmetric PVDM',
  scheme3: '03 · Scheme 3 — Proposed HVS',
};

function getChannelBadgeClass(channel: CalculationStep['channel']): string {
  if (channel === 'R') return 'border-[#B45309]/30 bg-[#B45309]/10 text-[#B45309]';
  if (channel === 'G') return 'border-[#15803D]/30 bg-[#15803D]/10 text-[#15803D]';
  return 'border-[#2563EB]/30 bg-[#2563EB]/10 text-[#2563EB]';
}

function formatRgbCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function formatIndicator(indicator: number | undefined): string | null {
  if (indicator === undefined || indicator === null) return null;
  return `PI: ${indicator.toString(2).padStart(2, '0')}`;
}

export function SchemeCalculationLog({ state }: SchemeCalculationLogProps) {
  const { scheme, status, analysis, steps, result, errorMessage } = state;

  const panelRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isPinnedToBottomRef = useRef(true);
  const animatedCountRef = useRef(0);

  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinned = distanceFromBottom <= 28;
    if (pinned !== isPinnedToBottomRef.current) {
      isPinnedToBottomRef.current = pinned;
      setIsPinnedToBottom(pinned);
    }
  };

  // Auto-scroll to newest appended entry only while pinned to bottom
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !isPinnedToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [steps.length, analysis, result, status]);

  // Reset animated step counter when a fresh embed starts (steps cleared)
  useEffect(() => {
    if (steps.length === 0) {
      animatedCountRef.current = 0;
    }
  }, [steps.length]);

  // Crisp entrance animation for newly appended step rows
  useGSAP(
    () => {
      if (steps.length <= animatedCountRef.current) return;
      const startIndex = animatedCountRef.current;
      animatedCountRef.current = steps.length;

      const container = scrollContainerRef.current;
      if (!container) return;

      const newRows = Array.from(
        container.querySelectorAll<HTMLElement>('[data-step-index]'),
      ).filter((node) => {
        const idx = Number(node.dataset.stepIndex);
        return Number.isFinite(idx) && idx >= startIndex;
      });

      if (newRows.length === 0) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          isMotionOk: '(prefers-reduced-motion: no-preference)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          if (!context.conditions?.isMotionOk || context.conditions?.reduceMotion) return;
          gsap.fromTo(
            newRows,
            { y: 8, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.22,
              stagger: 0.02,
              ease: 'power2.out',
              clearProps: 'transform,opacity',
            },
          );
        },
        panelRef,
      );

      return () => mm.revert();
    },
    { scope: panelRef, dependencies: [steps.length] },
  );

  const handleSnapToLatest = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isPinnedToBottomRef.current = true;
    setIsPinnedToBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const title = LOG_PANEL_TITLES[scheme];
  const isProposed = scheme === 'scheme3';

  const capacityFits =
    analysis !== null && analysis.required_bits <= analysis.capacity.capacity_bits;

  const psnrTotal = getPsnrTotal(result?.psnr);
  const psnrR = getPsnrChannel(result?.psnr, 'r');
  const psnrG = getPsnrChannel(result?.psnr, 'g');
  const psnrB = getPsnrChannel(result?.psnr, 'b');
  const fobpTotal = getFobpCount(result?.embed_stats);

  return (
    <section
      ref={panelRef}
      aria-label={`${title} calculation log`}
      className={`results-log-enter relative flex flex-col overflow-hidden rounded-xl border bg-[#FDFCF9] ${
        isProposed ? 'border-[#9A6B2F]/70 ring-1 ring-[#9A6B2F]/15' : 'border-[#E4DFD3]'
      }`}
    >
      {/* Panel Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4DFD3] bg-[#FDFCF9] px-3.5 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-xs font-semibold tracking-tight text-[#111110]">
            {title}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2 py-0.5 text-[10px] font-medium text-[#6B665C] tabular-nums">
            {steps.length} steps logged
          </span>
          <LiveStatusBadge status={status} />
        </div>
      </header>

      {/* Scrollable Timeline Container */}
      <div className="relative">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-[340px] space-y-2.5 overflow-y-auto bg-[#F6F4EF]/55 p-3 gallery-scroll sm:h-[380px]"
        >
          {/* Entry 0 — Initial Image Analysis */}
          {analysis ? (
            <div className="rounded-lg border border-[#E4DFD3] bg-[#FDFCF9] p-2.5 text-[11px] tabular-nums">
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#E4DFD3] pb-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#9A6B2F]">
                  <Info className="h-3 w-3" />
                  <span>Entry 0 · Initial Image Analysis</span>
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    capacityFits
                      ? 'border-[#15803D]/30 bg-[#15803D]/10 text-[#15803D]'
                      : 'border-[#B45309]/35 bg-[#B45309]/10 text-[#B45309]'
                  }`}
                >
                  {capacityFits ? 'Capacity OK' : 'Exceeds Capacity'}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div>
                  <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">Cover Size</dt>
                  <dd className="font-medium text-[#111110]">
                    {analysis.width} × {analysis.height} RGB
                  </dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">Max Capacity</dt>
                  <dd className="font-medium text-[#111110]">
                    {formatBytes(analysis.capacity.max_payload_bytes)} ({analysis.capacity.bpp.toFixed(3)} bpp)
                  </dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">Payload Size</dt>
                  <dd className="font-medium text-[#111110]">
                    {formatBytes(analysis.payload_bytes)} ({analysis.required_bits.toLocaleString()} bits)
                  </dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">Usable Capacity</dt>
                  <dd className="font-medium text-[#111110]">
                    {analysis.capacity.capacity_bits.toLocaleString()} bits
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#E4DFD3] bg-[#FDFCF9] p-3 text-[11px] text-[#6B665C] tabular-nums">
              Awaiting initial image analysis stream…
            </div>
          )}

          {/* Entries 1..N — Persistent Step Log Cards */}
          {steps.map((step, index) => {
            const indicatorLabel = formatIndicator(step.indicator);
            const fobpTriggered = step.fobp_triggered === true;

            return (
              <article
                key={`${scheme}-step-${index}`}
                data-step-index={index}
                className="rounded-lg border border-[#E4DFD3] bg-[#FDFCF9] p-2.5 text-[11px] tabular-nums shadow-[0_1px_2px_rgba(17,17,16,0.03)]"
              >
                {/* Row Header: Step #, Position, Channel (+ PI), FOBP status */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#E4DFD3] pb-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-[#F6F4EF] px-1.5 py-0.5 text-[10px] font-semibold text-[#111110]">
                      #{index + 1}
                    </span>
                    <span className="font-medium text-[#111110]">
                      Row {step.row + 1}, Col {step.columns[0] + 1}–{step.columns[1] + 1}
                    </span>
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${getChannelBadgeClass(step.channel)}`}
                    >
                      {step.channel}
                    </span>
                    {indicatorLabel && (
                      <span className="rounded-full border border-[#9A6B2F]/30 bg-[#9A6B2F]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#9A6B2F]">
                        {indicatorLabel}
                      </span>
                    )}
                  </div>

                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      fobpTriggered
                        ? 'border-[#B45309]/40 bg-[#B45309]/12 text-[#B45309]'
                        : 'border-[#E4DFD3] bg-[#F6F4EF] text-[#6B665C]'
                    }`}
                  >
                    {fobpTriggered ? 'FOBP: Triggered' : 'FOBP: None'}
                  </span>
                </div>

                {/* Before -> After Pixel Values & Difference */}
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-[#E4DFD3] bg-[#F6F4EF]/65 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[9px] font-medium uppercase tracking-wider text-[#6B665C]">
                        Original Pixels
                      </span>
                      {step.rgb_before && (
                        <span className="inline-flex items-center gap-1" aria-hidden="true">
                          <span
                            className="h-3 w-3 rounded-[3px] border border-[#111110]/15"
                            style={{ backgroundColor: formatRgbCss(step.rgb_before[0]) }}
                            title={`P1 RGB(${step.rgb_before[0].join(', ')})`}
                          />
                          <span
                            className="h-3 w-3 rounded-[3px] border border-[#111110]/15"
                            style={{ backgroundColor: formatRgbCss(step.rgb_before[1]) }}
                            title={`P2 RGB(${step.rgb_before[1].join(', ')})`}
                          />
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 font-semibold text-[#111110]">
                      <span>
                        ({step.before[0]}, {step.before[1]})
                      </span>
                      <span className="text-[10px] font-medium text-[#6B665C]">
                        |d| = {step.difference_before}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-md border border-[#E4DFD3] bg-[#F6F4EF]/65 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[9px] font-medium uppercase tracking-wider text-[#6B665C]">
                        Modified Pixels
                      </span>
                      {step.rgb_after && (
                        <span className="inline-flex items-center gap-1" aria-hidden="true">
                          <span
                            className="h-3 w-3 rounded-[3px] border border-[#111110]/15"
                            style={{ backgroundColor: formatRgbCss(step.rgb_after[0]) }}
                            title={`P1' RGB(${step.rgb_after[0].join(', ')})`}
                          />
                          <span
                            className="h-3 w-3 rounded-[3px] border border-[#111110]/15"
                            style={{ backgroundColor: formatRgbCss(step.rgb_after[1]) }}
                            title={`P2' RGB(${step.rgb_after[1].join(', ')})`}
                          />
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 font-semibold text-[#111110]">
                      <span>
                        ({step.after[0]}, {step.after[1]})
                      </span>
                      <span className="text-[10px] font-medium text-[#6B665C]">
                        |d&apos;| = {step.difference_after}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Range, Bits, Payload, FREM */}
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md border border-[#E4DFD3]/80 bg-[#FDFCF9] px-2 py-1.5 text-[10px]">
                  <div>
                    <span className="text-[#6B665C]">Range: </span>
                    <span className="font-semibold text-[#111110]">
                      [{step.range[0]}, {step.range[1]}]
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B665C]">Embedded: </span>
                    <span className="font-semibold text-[#111110]">t = {step.bits} bits</span>
                  </div>
                  <div className="truncate">
                    <span className="text-[#6B665C]">Payload: </span>
                    <span className="font-semibold text-[#9A6B2F]">
                      {step.payload_bits} ({step.payload_value})
                    </span>
                  </div>
                  <div className="truncate">
                    <span className="text-[#6B665C]">FREM </span>
                    <span className="font-semibold text-[#111110]">
                      {step.frem_before} → {step.frem_after} (mod 2^{step.bits})
                    </span>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Final Entry — Completion / Overflow / Failure Summary */}
          {status === 'completed' && result && (
            <div className="rounded-lg border border-[#15803D]/35 bg-[#15803D]/[0.06] p-2.5 text-[11px] tabular-nums">
              <div className="flex items-center justify-between gap-2 border-b border-[#15803D]/20 pb-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#15803D]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Final Summary · Completed</span>
                </span>
                <span className="font-semibold text-[#111110]">
                  {result.elapsed_ms !== null ? `${formatMetric(result.elapsed_ms, 1)} ms` : '—'}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div>
                  <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">PSNR Total</dt>
                  <dd className="font-semibold text-[#111110]">
                    {psnrTotal !== null ? `${formatMetric(psnrTotal, 2)} dB` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">PSNR R / G / B</dt>
                  <dd className="font-medium text-[#111110]">
                    {result.psnr
                      ? `${formatMetric(psnrR, 1)} / ${formatMetric(psnrG, 1)} / ${formatMetric(psnrB, 1)}`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">SSIM RGB / Y</dt>
                  <dd className="font-semibold text-[#111110]">
                    {formatMetric(result.ssim?.ssim_rgb, 4)} / {formatMetric(result.ssim?.ssim_y, 4)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">Total FOBP</dt>
                  <dd className="font-semibold text-[#111110]">
                    {fobpTotal !== null ? fobpTotal.toLocaleString() : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {status === 'overflow' && (
            <div className="rounded-lg border border-[#B45309]/35 bg-[#B45309]/[0.07] p-2.5 text-[11px] tabular-nums">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#B45309]">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Final Summary · Capacity Overflow</span>
              </div>
              <p className="mt-1 text-[#111110]">
                {result?.error ?? errorMessage ?? 'Payload exceeds maximum embedding capacity.'}
              </p>
            </div>
          )}

          {status === 'failed' && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-[11px] text-rose-950 tabular-nums">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-800">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Final Summary · Embedding Failed</span>
              </div>
              <p className="mt-1">
                {result?.error ?? errorMessage ?? 'Unexpected error while embedding.'}
              </p>
            </div>
          )}
        </div>

        {/* Floating "↓ Latest" snap-back pill when user scrolls up */}
        {!isPinnedToBottom && (
          <button
            type="button"
            onClick={handleSnapToLatest}
            className="absolute right-4 bottom-3 z-10 inline-flex items-center gap-1 rounded-full border border-[#9A6B2F] bg-[#111110] px-3 py-1 text-[11px] font-medium text-[#FDFCF9] shadow-md transition-colors hover:bg-[#9A6B2F]"
          >
            <ArrowDown className="h-3 w-3" />
            <span>Latest</span>
          </button>
        )}
      </div>
    </section>
  );
}
