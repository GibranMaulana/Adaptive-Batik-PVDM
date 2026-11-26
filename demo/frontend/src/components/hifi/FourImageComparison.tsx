import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Download,
  FastForward,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import { base64PngToFile, base64ToPngDataUrl, downloadBase64Png } from '../../api/client';
import type { LiveSchemeStatus, SchemeLiveState, SchemeName } from '../../api/types';
import {
  ALL_SCHEMES,
  formatBytes,
  formatMetric,
  getFobpCount,
  getPsnrChannel,
  getPsnrTotal,
  getStegoFilename,
} from '../../utils/payload';
import { PixelRasterCanvas } from './PixelRasterCanvas';

export type ComparisonViewMode = 'stego' | 'heatmap';

interface FourImageComparisonProps {
  coverImageUrl: string;
  motif: string;
  filename: string;
  width: number;
  height: number;
  payloadBytes: number;
  viewMode: ComparisonViewMode;
  schemes: Record<SchemeName, SchemeLiveState>;
  hasPendingPacing: boolean;
  onBackToCompose: () => void;
  onChangeViewMode: (mode: ComparisonViewMode) => void;
  onSkipPacing: () => void;
  onExtractFile: (file: File) => void;
}

const CARD_META: Record<SchemeName, { label: string; isProposed?: boolean }> = {
  scheme1: { label: '01 · MPI' },
  scheme2: { label: '02 · Symmetric' },
  scheme3: { label: '03 · Proposed HVS', isProposed: true },
};

export function LiveStatusBadge({ status }: { status: LiveSchemeStatus }) {
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#9A6B2F]/35 bg-[#9A6B2F]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#9A6B2F] tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full bg-[#9A6B2F] motion-safe:animate-pulse" />
        Processing
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#15803D]/30 bg-[#15803D]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#15803D] tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
        Completed
      </span>
    );
  }
  if (status === 'overflow') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B45309]/35 bg-[#B45309]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#B45309] tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full bg-[#B45309]" />
        Overflow
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-700/30 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-rose-800 tabular-nums">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-700" />
      Failed
    </span>
  );
}

interface SchemeComparisonCardProps {
  state: SchemeLiveState;
  coverImageUrl: string;
  motif: string;
  width: number;
  height: number;
  payloadBytes: number;
  viewMode: ComparisonViewMode;
  onExtractFile: (file: File) => void;
}

function SchemeComparisonCard({
  state,
  coverImageUrl,
  motif,
  width,
  height,
  payloadBytes,
  viewMode,
  onExtractFile,
}: SchemeComparisonCardProps) {
  const [metricsOpen, setMetricsOpen] = useState(false);

  const meta = CARD_META[state.scheme];
  const { status, analysis, rows, result, pendingStegoBase64, errorMessage } = state;

  const lastRowEntry = rows.length > 0 ? rows[rows.length - 1] : null;
  const lastLoggedRow = lastRowEntry ? lastRowEntry.row : -1;
  const rowProgress =
    rows.length > 0 ? Math.min(1, (lastLoggedRow + 1) / Math.max(1, height)) : 0;

  const activeBase64 =
    viewMode === 'stego' ? result?.stego_png_base64 ?? null : result?.heatmap_png_base64 ?? null;

  const psnrTotal = getPsnrTotal(result?.psnr);
  const psnrR = getPsnrChannel(result?.psnr, 'r');
  const psnrG = getPsnrChannel(result?.psnr, 'g');
  const psnrB = getPsnrChannel(result?.psnr, 'b');
  const fobp = getFobpCount(result?.embed_stats);
  const effectiveCapacity = result?.capacity ?? analysis?.capacity ?? null;

  const handleExtractClick = () => {
    if (!result?.stego_png_base64) return;
    const file = base64PngToFile(result.stego_png_base64, getStegoFilename(motif, result));
    onExtractFile(file);
  };

  const headlinePsnr =
    status === 'completed' && psnrTotal !== null
      ? `PSNR ${formatMetric(psnrTotal, 2)} dB`
      : status === 'overflow'
        ? 'Overflow'
        : status === 'failed'
          ? 'Failed'
          : 'PSNR —';

  const headlineRow =
    rows.length > 0
      ? `Row ${lastLoggedRow + 1} / ${height}`
      : status === 'overflow'
        ? 'Overflow'
        : status === 'failed'
          ? 'Failed'
          : `Row 0 / ${height}`;

  return (
    <article
      className={`results-card-enter flex flex-col justify-between rounded-xl border bg-[#FDFCF9] p-3.5 transition-colors ${
        meta.isProposed
          ? 'border-[#9A6B2F]/75 shadow-[0_12px_28px_-22px_rgba(154,107,47,0.42)] ring-1 ring-[#9A6B2F]/15'
          : 'border-[#E4DFD3]'
      }`}
    >
      <div>
        {/* Clean top bar */}
        <div className="flex items-center justify-between gap-2 pb-2.5">
          <h3
            className={`truncate text-xs font-semibold tracking-tight ${
              meta.isProposed ? 'text-[#9A6B2F]' : 'text-[#111110]'
            }`}
          >
            {meta.label}
          </h3>
          <LiveStatusBadge status={status} />
        </div>

        {/* Image / Row-Synced Canvas Frame */}
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-[#E4DFD3] bg-[#F6F4EF]">
          {status === 'processing' && (
            <PixelRasterCanvas
              coverImageUrl={coverImageUrl}
              stegoBase64={pendingStegoBase64}
              width={width}
              height={height}
              progress={rowProgress}
              showCursor={rows.length > 0}
              coverBackdropOpacity={0.28}
              rowScanlineOnly
              alt={`${meta.label} row-synced stego canvas`}
            />
          )}

          {status === 'completed' &&
            (activeBase64 ? (
              <img
                src={base64ToPngDataUrl(activeBase64)}
                alt={`${meta.label} ${viewMode === 'stego' ? 'stego PNG' : '×20 difference heatmap'}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-[#6B665C]">
                Image unavailable
              </div>
            ))}

          {(status === 'overflow' || status === 'failed') && (
            <div
              className={`flex h-full w-full flex-col justify-between p-4 ${
                status === 'overflow'
                  ? 'bg-[#B45309]/[0.05] text-[#111110]'
                  : 'bg-rose-50/70 text-rose-950'
              }`}
            >
              <div>
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    status === 'overflow'
                      ? 'border-[#B45309]/35 bg-[#B45309]/10 text-[#B45309]'
                      : 'border-rose-300 bg-rose-100/70 text-rose-800'
                  }`}
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {status === 'overflow' ? 'Payload Exceeds Capacity' : 'Embedding Failed'}
                  </span>
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-[#6B665C]">
                  {result?.error ??
                    errorMessage ??
                    'No stego image could be produced for this scheme.'}
                </p>
              </div>

              {effectiveCapacity && (
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#E4DFD3] bg-[#FDFCF9] p-2.5 text-[11px] tabular-nums">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#6B665C]">
                      Payload
                    </div>
                    <div className="font-semibold text-[#B45309]">
                      {formatBytes(payloadBytes)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#6B665C]">
                      Max Cap
                    </div>
                    <div className="font-semibold text-[#111110]">
                      {formatBytes(effectiveCapacity.max_payload_bytes)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="mt-3 border-t border-[#E4DFD3] pt-2.5">
        {/* 2 clean headline stats */}
        <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
          <span
            className={`font-semibold ${
              status === 'overflow'
                ? 'text-[#B45309]'
                : status === 'failed'
                  ? 'text-rose-800'
                  : 'text-[#111110]'
            }`}
          >
            {headlinePsnr}
          </span>
          <span className="text-[#6B665C]">{headlineRow}</span>
        </div>

        {/* Compact pill actions */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              result?.stego_png_base64 &&
              downloadBase64Png(result.stego_png_base64, getStegoFilename(motif, result))
            }
            disabled={status !== 'completed' || !result?.stego_png_base64}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF] px-2 py-1.5 text-[11px] font-medium text-[#111110] transition-colors hover:border-[#111110] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Download className="h-3 w-3 shrink-0" />
            <span>Download</span>
          </button>

          <button
            type="button"
            onClick={handleExtractClick}
            disabled={status !== 'completed' || !result?.stego_png_base64}
            className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              meta.isProposed
                ? 'bg-[#9A6B2F] text-[#FDFCF9] hover:bg-[#825823]'
                : 'bg-[#111110] text-[#FDFCF9] hover:bg-[#2A2926]'
            }`}
          >
            <span>Extract</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setMetricsOpen((prev) => !prev)}
            disabled={status !== 'completed' || !result}
            aria-expanded={metricsOpen}
            className={`inline-flex items-center justify-center gap-0.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              metricsOpen
                ? 'border-[#9A6B2F] bg-[#9A6B2F]/10 text-[#9A6B2F]'
                : 'border-[#E4DFD3] bg-[#FDFCF9] text-[#6B665C] hover:border-[#111110] hover:text-[#111110]'
            }`}
          >
            <span>Metrics</span>
            <ChevronDown
              className={`h-3 w-3 shrink-0 transition-transform duration-150 ${
                metricsOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* Expandable Metrics Drawer */}
        {metricsOpen && result && (
          <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF]/85 px-2.5 py-2 text-[11px] tabular-nums">
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
              <dd className="font-medium text-[#111110]">
                {formatMetric(result.ssim?.ssim_rgb, 4)} / {formatMetric(result.ssim?.ssim_y, 4)}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">FOBP</dt>
              <dd className="font-semibold text-[#111110]">
                {fobp !== null ? fobp.toLocaleString() : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">Time</dt>
              <dd className="font-medium text-[#111110]">
                {result.elapsed_ms !== null ? `${formatMetric(result.elapsed_ms, 1)} ms` : '—'}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </article>
  );
}

export function FourImageComparison({
  coverImageUrl,
  motif,
  filename,
  width,
  height,
  payloadBytes,
  viewMode,
  schemes,
  hasPendingPacing,
  onBackToCompose,
  onChangeViewMode,
  onSkipPacing,
  onExtractFile,
}: FourImageComparisonProps) {
  return (
    <section aria-label="4-Image Stego Comparison">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 0 — Original Cover */}
        <article className="results-card-enter flex flex-col justify-between rounded-xl border border-[#E4DFD3] bg-[#FDFCF9] p-3.5">
          <div>
            <div className="flex items-center justify-between gap-2 pb-2.5">
              <div className="min-w-0">
                <h2 className="truncate text-xs font-semibold tracking-tight text-[#111110]">
                  00 · Original Cover
                </h2>
              </div>

              <button
                type="button"
                onClick={onBackToCompose}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2.5 py-0.5 text-[11px] font-medium text-[#111110] transition-colors hover:border-[#111110]"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>New Embed</span>
              </button>
            </div>

            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-[#E4DFD3] bg-[#F6F4EF]">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt={`Original cover ${motif} ${filename}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="h-full w-full motion-safe:animate-pulse bg-[#EFECE3]" />
              )}
            </div>
          </div>

          <div className="mt-3 border-t border-[#E4DFD3] pt-2.5">
            <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
              <span className="truncate font-semibold text-[#111110]">{filename}</span>
              <span className="shrink-0 text-[#6B665C]">{formatBytes(payloadBytes)}</span>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5">
              <div
                className="grid flex-1 grid-cols-2 gap-1 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF] p-0.5"
                role="group"
                aria-label="Comparison visual mode"
              >
                <button
                  type="button"
                  onClick={() => onChangeViewMode('stego')}
                  aria-pressed={viewMode === 'stego'}
                  className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    viewMode === 'stego'
                      ? 'bg-[#111110] text-[#FDFCF9]'
                      : 'text-[#6B665C] hover:text-[#111110]'
                  }`}
                >
                  <ImageIcon className="h-3 w-3 shrink-0" />
                  <span>Stego</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeViewMode('heatmap')}
                  aria-pressed={viewMode === 'heatmap'}
                  className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    viewMode === 'heatmap'
                      ? 'bg-[#9A6B2F] text-[#FDFCF9]'
                      : 'text-[#6B665C] hover:text-[#111110]'
                  }`}
                >
                  <Layers className="h-3 w-3 shrink-0" />
                  <span>×20 Heatmap</span>
                </button>
              </div>

              {hasPendingPacing && (
                <button
                  type="button"
                  onClick={onSkipPacing}
                  className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-[#9A6B2F]/40 bg-[#9A6B2F]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#9A6B2F] transition-colors hover:bg-[#9A6B2F] hover:text-[#FDFCF9]"
                >
                  <FastForward className="h-3 w-3 shrink-0" />
                  <span>Finish Now</span>
                </button>
              )}
            </div>
          </div>
        </article>

        {/* Cards 1–3 — Scheme 1, Scheme 2, Scheme 3 */}
        {ALL_SCHEMES.map((schemeName) => (
          <SchemeComparisonCard
            key={schemeName}
            state={schemes[schemeName]}
            coverImageUrl={coverImageUrl}
            motif={motif}
            width={width}
            height={height}
            payloadBytes={payloadBytes}
            viewMode={viewMode}
            onExtractFile={onExtractFile}
          />
        ))}
      </div>
    </section>
  );
}
