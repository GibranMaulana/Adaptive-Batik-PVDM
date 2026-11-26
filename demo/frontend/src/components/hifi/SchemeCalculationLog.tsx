import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ChevronRight } from 'lucide-react';
import type { CalculationStep, RowTraceEntry, SchemeLiveState, SchemeName } from '../../api/types';
import {
  formatBytes,
  formatMetric,
  getFobpCount,
  getPsnrTotal,
} from '../../utils/payload';
import { LiveStatusBadge } from './FourImageComparison';

interface SchemeCalculationLogProps {
  state: SchemeLiveState;
}

const LOG_PANEL_TITLES: Record<SchemeName, string> = {
  scheme1: '01 · MPI',
  scheme2: '02 · Symmetric',
  scheme3: '03 · Proposed HVS',
};

function getChannelBadgeClass(channel: CalculationStep['channel']): string {
  if (channel === 'R') return 'border-[#B45309]/30 bg-[#B45309]/10 text-[#B45309]';
  if (channel === 'G') return 'border-[#15803D]/30 bg-[#15803D]/10 text-[#15803D]';
  return 'border-[#2563EB]/30 bg-[#2563EB]/10 text-[#2563EB]';
}

function formatRgbCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function formatRowNumber(rowZeroBased: number): string {
  return `Row ${String(rowZeroBased + 1).padStart(3, '0')}`;
}

function SampleStepCard({ step }: { step: CalculationStep }) {
  const indicatorLabel =
    step.indicator !== undefined && step.indicator !== null
      ? `PI ${step.indicator.toString(2).padStart(2, '0')}`
      : null;
  const fobpTriggered = step.fobp_triggered === true;

  return (
    <div className="rounded-md border border-[#E4DFD3] bg-[#FDFCF9] p-2 text-[11px] tabular-nums">
      {/* Row/Col, Channel + PI, FOBP */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#E4DFD3]/80 pb-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-[#111110]">
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
          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
            fobpTriggered
              ? 'border-[#B45309]/40 bg-[#B45309]/12 text-[#B45309]'
              : 'border-[#E4DFD3] bg-[#F6F4EF] text-[#6B665C]'
          }`}
        >
          {fobpTriggered ? 'FOBP: Triggered' : 'FOBP: None'}
        </span>
      </div>

      {/* Original (Px, Py) + RGB swatch vs Modified (P'x, P'y) + RGB swatch */}
      <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <div className="rounded border border-[#E4DFD3]/80 bg-[#F6F4EF]/65 px-2 py-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-medium uppercase tracking-wider text-[#6B665C]">
              Original (Px, Py)
            </span>
            {step.rgb_before && (
              <span className="inline-flex items-center gap-1" aria-hidden="true">
                <span
                  className="h-2.5 w-2.5 rounded-[2px] border border-[#111110]/15"
                  style={{ backgroundColor: formatRgbCss(step.rgb_before[0]) }}
                  title={`Px RGB(${step.rgb_before[0].join(', ')})`}
                />
                <span
                  className="h-2.5 w-2.5 rounded-[2px] border border-[#111110]/15"
                  style={{ backgroundColor: formatRgbCss(step.rgb_before[1]) }}
                  title={`Py RGB(${step.rgb_before[1].join(', ')})`}
                />
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#111110]">
            <span>
              ({step.before[0]}, {step.before[1]})
            </span>
            <span className="text-[10px] font-medium text-[#6B665C]">
              |d| = {step.difference_before}
            </span>
          </div>
        </div>

        <div className="rounded border border-[#E4DFD3]/80 bg-[#F6F4EF]/65 px-2 py-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-medium uppercase tracking-wider text-[#6B665C]">
              Modified (P&apos;x, P&apos;y)
            </span>
            {step.rgb_after && (
              <span className="inline-flex items-center gap-1" aria-hidden="true">
                <span
                  className="h-2.5 w-2.5 rounded-[2px] border border-[#111110]/15"
                  style={{ backgroundColor: formatRgbCss(step.rgb_after[0]) }}
                  title={`P'x RGB(${step.rgb_after[0].join(', ')})`}
                />
                <span
                  className="h-2.5 w-2.5 rounded-[2px] border border-[#111110]/15"
                  style={{ backgroundColor: formatRgbCss(step.rgb_after[1]) }}
                  title={`P'y RGB(${step.rgb_after[1].join(', ')})`}
                />
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#111110]">
            <span>
              ({step.after[0]}, {step.after[1]})
            </span>
            <span className="text-[10px] font-medium text-[#6B665C]">
              |d&apos;| = {step.difference_after}
            </span>
          </div>
        </div>
      </div>

      {/* Range, t bits, Payload, FREM */}
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 px-0.5 text-[10px]">
        <div>
          <span className="text-[#6B665C]">Range: </span>
          <span className="font-semibold text-[#111110]">
            [{step.range[0]}, {step.range[1]}]
          </span>
        </div>
        <div>
          <span className="text-[#6B665C]">t bits: </span>
          <span className="font-semibold text-[#111110]">{step.bits} b</span>
        </div>
        <div className="truncate">
          <span className="text-[#6B665C]">Payload: </span>
          <span className="font-semibold text-[#9A6B2F]">
            {step.payload_bits} ({step.payload_value})
          </span>
        </div>
        <div className="truncate">
          <span className="text-[#6B665C]">FREM: </span>
          <span className="font-semibold text-[#111110]">
            {step.frem_before} → {step.frem_after} (mod 2^{step.bits})
          </span>
        </div>
      </div>
    </div>
  );
}

interface RowLedgerItemProps {
  entry: RowTraceEntry;
  expanded: boolean;
  onToggle: (row: number) => void;
}

function RowLedgerItem({ entry, expanded, onToggle }: RowLedgerItemProps) {
  const hasFobp = entry.fobp_count > 0;

  return (
    <div className="border-b border-[#E4DFD3]/70 last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(entry.row)}
        aria-expanded={expanded}
        className={`flex min-h-[34px] w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors tabular-nums hover:bg-[#FDFCF9] ${
          expanded ? 'bg-[#FDFCF9]' : ''
        }`}
      >
        <span className="w-[56px] shrink-0 font-semibold text-[#111110]">
          {formatRowNumber(entry.row)}
        </span>
        <span className="w-[54px] shrink-0 text-[#111110]">{entry.bits_embedded} b</span>
        <span className="w-[44px] shrink-0 text-[#6B665C]">{entry.channels.join('·')}</span>
        <span className="min-w-0 flex-1 truncate text-[#6B665C]">
          |d| {entry.avg_diff.toFixed(1)}
        </span>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            hasFobp
              ? 'border border-[#B45309]/35 bg-[#B45309]/10 font-semibold text-[#B45309]'
              : 'text-[#6B665C]'
          }`}
        >
          FOBP {entry.fobp_count}
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 text-[#6B665C] transition-transform duration-150 ${
            expanded ? 'rotate-90 text-[#9A6B2F]' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="space-y-1.5 border-t border-[#E4DFD3]/70 bg-[#F6F4EF]/85 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#6B665C] tabular-nums">
            <span>{entry.pairs_processed.toLocaleString()} pairs processed</span>
            <span>
              Cumulative {entry.cumulative_bits.toLocaleString()} /{' '}
              {entry.total_payload_bits.toLocaleString()} b
            </span>
          </div>

          {entry.sample_steps.length > 0 ? (
            <div className="space-y-1.5">
              {entry.sample_steps.map((step, idx) => (
                <SampleStepCard
                  key={`row-${entry.row}-step-${idx}-${step.columns[0]}-${step.channel}`}
                  step={step}
                />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[#6B665C]">
              No sample pixel-pair steps recorded for this row.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function SchemeCalculationLog({ state }: SchemeCalculationLogProps) {
  const { scheme, status, analysis, rows, result, errorMessage } = state;

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isPinnedToBottomRef = useRef(true);

  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());

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

  // Smart auto-scroll while pinned near bottom
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !isPinnedToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [rows.length, analysis, result, status]);

  const handleToggleRow = (rowIndex: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const handleSnapToLatest = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isPinnedToBottomRef.current = true;
    setIsPinnedToBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const title = LOG_PANEL_TITLES[scheme];
  const isProposed = scheme === 'scheme3';

  const psnrTotal = getPsnrTotal(result?.psnr);
  const fobpTotal = getFobpCount(result?.embed_stats);

  return (
    <section
      aria-label={`${title} calculation log`}
      className={`results-log-enter relative flex flex-col overflow-hidden rounded-xl border bg-[#FDFCF9] ${
        isProposed ? 'border-[#9A6B2F]/75 ring-1 ring-[#9A6B2F]/15' : 'border-[#E4DFD3]'
      }`}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-[#E4DFD3] bg-[#FDFCF9] px-3.5 py-2.5">
        <h3
          className={`truncate text-xs font-semibold tracking-tight ${
            isProposed ? 'text-[#9A6B2F]' : 'text-[#111110]'
          }`}
        >
          {title}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2 py-0.5 text-[10px] font-medium text-[#6B665C] tabular-nums">
            {rows.length} rows
          </span>
          <LiveStatusBadge status={status} />
        </div>
      </header>

      {/* Scrollable Ledger */}
      <div className="relative">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-[320px] overflow-y-auto bg-[#F6F4EF]/45 gallery-scroll sm:h-[360px]"
        >
          {/* Entry 0 — Initial Image Analysis (1 compact line) */}
          <div className="border-b border-[#E4DFD3] bg-[#FDFCF9]/90 px-3 py-2 text-[11px] text-[#6B665C] tabular-nums">
            {analysis ? (
              <p className="truncate">
                <span className="font-medium text-[#111110]">
                  {analysis.width}×{analysis.height}
                </span>
                {' · '}
                <span>Cap {formatBytes(analysis.capacity.max_payload_bytes)}</span>
                {' · '}
                <span>
                  Payload {formatBytes(analysis.payload_bytes)} (
                  {analysis.required_bits.toLocaleString()} b)
                </span>
              </p>
            ) : (
              <p>Analyzing cover image…</p>
            )}
          </div>

          {/* Uncapped Row Entries (Row 1 through final row) */}
          {rows.map((entry) => (
            <RowLedgerItem
              key={`${scheme}-row-${entry.row}`}
              entry={entry}
              expanded={expandedRows.has(entry.row)}
              onToggle={handleToggleRow}
            />
          ))}

          {/* Final Entry — 1 compact summary line */}
          {status === 'completed' && result && (
            <div className="border-t border-[#15803D]/25 bg-[#15803D]/[0.06] px-3 py-2 text-[11px] font-medium text-[#15803D] tabular-nums">
              Completed in{' '}
              {result.elapsed_ms !== null ? `${formatMetric(result.elapsed_ms, 1)} ms` : '—'}
              {' · '}
              {rows.length} rows
              {' · '}
              PSNR {psnrTotal !== null ? `${formatMetric(psnrTotal, 2)} dB` : '—'}
              {' · '}
              FOBP {fobpTotal !== null ? fobpTotal.toLocaleString() : '—'}
            </div>
          )}

          {status === 'overflow' && (
            <div className="border-t border-[#B45309]/30 bg-[#B45309]/[0.07] px-3 py-2 text-[11px] font-medium text-[#B45309] tabular-nums">
              Overflow ·{' '}
              {result?.error ?? errorMessage ?? 'Payload exceeds maximum embedding capacity.'}
            </div>
          )}

          {status === 'failed' && (
            <div className="border-t border-rose-300 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-800 tabular-nums">
              Failed · {result?.error ?? errorMessage ?? 'Unexpected error while embedding.'}
            </div>
          )}
        </div>

        {/* Subtle "↓ Latest" pill when user scrolls up */}
        {!isPinnedToBottom && (
          <button
            type="button"
            onClick={handleSnapToLatest}
            className="absolute right-3 bottom-3 z-10 inline-flex items-center gap-1 rounded-full border border-[#9A6B2F] bg-[#111110] px-2.5 py-1 text-[11px] font-medium text-[#FDFCF9] shadow-md transition-colors hover:bg-[#9A6B2F]"
          >
            <ArrowDown className="h-3 w-3" />
            <span>Latest</span>
          </button>
        )}
      </div>
    </section>
  );
}
