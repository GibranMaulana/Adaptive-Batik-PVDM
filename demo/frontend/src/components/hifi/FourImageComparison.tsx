import { useEffect, useRef } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
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
import { PixelRasterCanvas, type PixelRasterCanvasHandle } from './PixelRasterCanvas';

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

const CARD_META: Record<
  SchemeName,
  { code: string; shortTitle: string; subtitle: string; isProposed?: boolean }
> = {
  scheme1: {
    code: '01 · Scheme 1',
    shortTitle: 'Modified Pixel Indicator',
    subtitle: 'Channel-Indicator PVDM',
  },
  scheme2: {
    code: '02 · Scheme 2',
    shortTitle: 'Symmetric PVDM',
    subtitle: 'Uniform RGB Range Table',
  },
  scheme3: {
    code: '03 · Scheme 3',
    shortTitle: 'Proposed HVS',
    subtitle: 'HVS-Asymmetric PVDM',
    isProposed: true,
  },
};

export function LiveStatusBadge({ status }: { status: LiveSchemeStatus }) {
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#9A6B2F]/35 bg-[#9A6B2F]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#9A6B2F] tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full bg-[#9A6B2F] motion-safe:animate-pulse" />
        Processing
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#15803D]/30 bg-[#15803D]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#15803D] tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
        Completed
      </span>
    );
  }
  if (status === 'overflow') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B45309]/35 bg-[#B45309]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#B45309] tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full bg-[#B45309]" />
        Overflow
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-700/30 bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-800 tabular-nums">
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
  const rasterRef = useRef<PixelRasterCanvasHandle | null>(null);
  const meta = CARD_META[state.scheme];
  const { status, analysis, steps, totalSteps, result, pendingStegoBase64, errorMessage } = state;

  useEffect(() => {
    if (status !== 'processing') return;
    const denominator = Math.max(totalSteps, steps.length, 1);
    const progress =
      steps.length > 0 ? Math.min(0.96, 0.12 + 0.84 * (steps.length / denominator)) : 0.08;
    rasterRef.current?.setProgress(progress, true);
  }, [status, steps.length, totalSteps, pendingStegoBase64]);

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

  return (
    <article
      className={`results-card-enter flex flex-col justify-between rounded-xl border bg-[#FDFCF9] p-3.5 transition-colors ${
        meta.isProposed
          ? 'border-[#9A6B2F] shadow-[0_12px_30px_-20px_rgba(154,107,47,0.38)] ring-1 ring-[#9A6B2F]/20'
          : 'border-[#E4DFD3]'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 pb-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A6B2F] tabular-nums">
                {meta.code}
              </span>
              {meta.isProposed && (
                <span className="rounded-full border border-[#9A6B2F]/35 bg-[#9A6B2F]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#9A6B2F]">
                  Proposed
                </span>
              )}
            </div>
            <h3 className="truncate font-editorial text-lg leading-tight tracking-tight text-[#111110]">
              {meta.shortTitle}
            </h3>
            <p className="truncate text-[11px] text-[#6B665C]">{meta.subtitle}</p>
          </div>

          <LiveStatusBadge status={status} />
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-[#E4DFD3] bg-[#F6F4EF]">
          {status === 'processing' && (
            <>
              <PixelRasterCanvas
                ref={rasterRef}
                coverImageUrl={coverImageUrl}
                stegoBase64={pendingStegoBase64}
                width={width}
                height={height}
                initialProgress={0.08}
                initialShowCursor
                alt={`${meta.shortTitle} streaming raster preview`}
              />
              <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2 rounded-full border border-[#E4DFD3] bg-[#FDFCF9]/95 px-2.5 py-1 text-[10px] font-medium text-[#111110] shadow-xs backdrop-blur-xs tabular-nums">
                <span>
                  {steps.length > 0
                    ? `Step ${steps.length}${totalSteps > 0 ? ` / ${totalSteps}` : ''}`
                    : analysis
                      ? 'Streaming steps…'
                      : 'Analyzing cover…'}
                </span>
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-[#E4DFD3]">
                  <span
                    className="block h-full rounded-full bg-[#9A6B2F] transition-[width] duration-150"
                    style={{
                      width: `${
                        steps.length > 0
                          ? Math.min(100, Math.round((steps.length / Math.max(totalSteps, steps.length)) * 100))
                          : 14
                      }%`,
                    }}
                  />
                </span>
              </div>
            </>
          )}

          {status === 'completed' &&
            (activeBase64 ? (
              <img
                src={base64ToPngDataUrl(activeBase64)}
                alt={`${meta.shortTitle} ${viewMode === 'stego' ? 'stego PNG' : '×20 difference heatmap'}`}
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
                    <div className="text-[10px] uppercase tracking-wider text-[#6B665C]">Payload</div>
                    <div className="font-semibold text-[#B45309]">{formatBytes(payloadBytes)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#6B665C]">Max Cap</div>
                    <div className="font-semibold text-[#111110]">
                      {formatBytes(effectiveCapacity.max_payload_bytes)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {status === 'completed' && viewMode === 'heatmap' && payloadBytes < 1024 && (
          <p className="mt-2 rounded-md border border-[#E4DFD3] bg-[#F6F4EF] px-2.5 py-1 text-[10px] leading-snug text-[#6B665C] tabular-nums">
            Sub-1 KB payload ({formatBytes(payloadBytes)}) — localized to top pixel rows.
          </p>
        )}
      </div>

      <div className="mt-3 pt-2.5 border-t border-[#E4DFD3]">
        {status === 'completed' && result && (
          <>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF]/80 px-2.5 py-2 text-[11px] tabular-nums">
              <div>
                <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">PSNR Total</dt>
                <dd className="font-semibold text-[#111110]">
                  {psnrTotal !== null ? `${formatMetric(psnrTotal, 2)} dB` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">R / G / B</dt>
                <dd className="text-[#111110]">
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
              <div className="flex items-start justify-between gap-2">
                <div>
                  <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">FOBP</dt>
                  <dd className="font-semibold text-[#111110]">
                    {fobp !== null ? fobp.toLocaleString() : '—'}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-[9px] uppercase tracking-wider text-[#6B665C]">Time</dt>
                  <dd className="text-[#111110]">
                    {result.elapsed_ms !== null ? `${formatMetric(result.elapsed_ms, 1)} ms` : '—'}
                  </dd>
                </div>
              </div>
            </dl>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  result.stego_png_base64 &&
                  downloadBase64Png(result.stego_png_base64, getStegoFilename(motif, result))
                }
                disabled={!result.stego_png_base64}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF] px-2.5 py-1.5 text-[11px] font-medium text-[#111110] transition-colors hover:border-[#111110] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download PNG</span>
              </button>
              <button
                type="button"
                onClick={handleExtractClick}
                disabled={!result.stego_png_base64}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  meta.isProposed
                    ? 'bg-[#9A6B2F] text-[#FDFCF9] hover:bg-[#825823]'
                    : 'bg-[#111110] text-[#FDFCF9] hover:bg-[#2A2926]'
                }`}
              >
                <span>Extract</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}

        {status === 'processing' && (
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF]/80 px-2.5 py-2 text-[11px] tabular-nums">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#6B665C]">Logged</div>
              <div className="font-semibold text-[#111110]">{steps.length} steps</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#6B665C]">Max Cap</div>
              <div className="font-semibold text-[#111110]">
                {analysis ? formatBytes(analysis.capacity.max_payload_bytes) : '—'}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#6B665C]">Rate</div>
              <div className="text-[#111110]">
                {analysis ? `${analysis.capacity.bpp.toFixed(2)} bpp` : '—'}
              </div>
            </div>
          </div>
        )}

        {(status === 'overflow' || status === 'failed') && (
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF]/80 px-2.5 py-2 text-[11px] tabular-nums">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#6B665C]">Logged</div>
              <div className="font-semibold text-[#111110]">{steps.length} steps</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#6B665C]">Rate</div>
              <div className="text-[#111110]">
                {effectiveCapacity ? `${effectiveCapacity.bpp.toFixed(3)} bpp` : '—'}
              </div>
            </div>
          </div>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 0 — Original Cover */}
        <article className="results-card-enter flex flex-col justify-between rounded-xl border border-[#E4DFD3] bg-[#FDFCF9] p-3.5">
          <div>
            <div className="flex items-start justify-between gap-2 pb-2.5">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9A6B2F] tabular-nums">
                  00 · Original Cover
                </span>
                <h2 className="truncate font-editorial text-lg leading-tight tracking-tight text-[#111110] capitalize">
                  {motif} / {filename}
                </h2>
                <p className="text-[11px] text-[#6B665C] tabular-nums">
                  {width} × {height} RGB · {formatBytes(payloadBytes)}
                </p>
              </div>

              <button
                type="button"
                onClick={onBackToCompose}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2.5 py-1 text-[11px] font-medium text-[#111110] transition-colors hover:border-[#111110]"
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

          <div className="mt-3 space-y-2 border-t border-[#E4DFD3] pt-2.5">
            <div
              className="grid grid-cols-2 gap-1 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF] p-1"
              role="group"
              aria-label="Comparison visual mode"
            >
              <button
                type="button"
                onClick={() => onChangeViewMode('stego')}
                aria-pressed={viewMode === 'stego'}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  viewMode === 'stego'
                    ? 'bg-[#111110] text-[#FDFCF9]'
                    : 'text-[#6B665C] hover:text-[#111110]'
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Stego Image</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeViewMode('heatmap')}
                aria-pressed={viewMode === 'heatmap'}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  viewMode === 'heatmap'
                    ? 'bg-[#9A6B2F] text-[#FDFCF9]'
                    : 'text-[#6B665C] hover:text-[#111110]'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>×20 Diff Heatmap</span>
              </button>
            </div>

            {hasPendingPacing ? (
              <button
                type="button"
                onClick={onSkipPacing}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#9A6B2F]/35 bg-[#9A6B2F]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#9A6B2F] transition-colors hover:bg-[#9A6B2F] hover:text-[#FDFCF9]"
              >
                <FastForward className="h-3.5 w-3.5" />
                <span>Show all steps immediately</span>
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-[#E4DFD3] bg-[#F6F4EF]/80 px-2.5 py-1.5 text-[11px] text-[#6B665C] tabular-nums">
                <span>Reference Cover</span>
                <span className="font-medium text-[#111110]">Lossless PNG</span>
              </div>
            )}
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
