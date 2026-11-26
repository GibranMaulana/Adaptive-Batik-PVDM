import type { RefObject } from 'react';
import { AlertCircle, ArrowRight, Download, Eye, LayoutGrid, Layers } from 'lucide-react';
import { base64PngToFile, base64ToPngDataUrl, downloadBase64Png } from '../../api/client';
import type { EmbedResponse, SchemeEmbedResult, SchemeName } from '../../api/types';
import {
  ALL_SCHEMES,
  formatBytes,
  formatMetric,
  getFobpCount,
  getPsnrChannel,
  getPsnrTotal,
  getStegoFilename,
} from '../../utils/payload';
import type { GalleryViewMode } from './SchemeResultCard';

interface StegoFocusPaneProps {
  embedResult: EmbedResponse;
  focusedScheme: SchemeName;
  viewMode: GalleryViewMode;
  focusMediaRef: RefObject<HTMLDivElement | null>;
  onSwitchScheme: (scheme: SchemeName) => void;
  onShowAll: () => void;
  onChangeViewMode: (mode: GalleryViewMode) => void;
  onExtractFile: (file: File) => void;
}

const FOCUS_SCHEME_META: Record<
  SchemeName,
  { code: string; title: string; subtitle: string }
> = {
  scheme1: {
    code: '01',
    title: '01 · Modified Pixel Indicator',
    subtitle: 'Baseline MPI · Channel-Indicator LSB/PVD',
  },
  scheme2: {
    code: '02',
    title: '02 · Symmetric 6-Level PVDM',
    subtitle: 'Uniform RGB Modulus · Non-HVS Range Table',
  },
  scheme3: {
    code: '03',
    title: '03 · Proposed HVS-Asymmetric PVDM',
    subtitle: 'Perceptual Luminance-Weighted RGB Allocation',
  },
};

function FocusStatusSeal({ status }: { status: SchemeEmbedResult['status'] }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#15803D]/30 bg-[#15803D]/10 px-2.5 py-0.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-[#15803D]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
        Embedded
      </span>
    );
  }
  if (status === 'overflow') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#B45309]/35 bg-[#B45309]/10 px-2.5 py-0.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-[#B45309]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#B45309]" />
        Overflow
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-700/30 bg-rose-50 px-2.5 py-0.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-rose-800">
      Failed
    </span>
  );
}

export function StegoFocusPane({
  embedResult,
  focusedScheme,
  viewMode,
  focusMediaRef,
  onSwitchScheme,
  onShowAll,
  onChangeViewMode,
  onExtractFile,
}: StegoFocusPaneProps) {
  const result =
    embedResult.results.find((item) => item.scheme === focusedScheme) ?? embedResult.results[0];
  if (!result) return null;

  const meta = FOCUS_SCHEME_META[result.scheme];
  const isProposed = result.scheme === 'scheme3';
  const isOk = result.status === 'ok';
  const activeBase64 = viewMode === 'stego' ? result.stego_png_base64 : result.heatmap_png_base64;

  const psnrTotal = getPsnrTotal(result.psnr);
  const psnrR = getPsnrChannel(result.psnr, 'r');
  const psnrG = getPsnrChannel(result.psnr, 'g');
  const psnrB = getPsnrChannel(result.psnr, 'b');
  const fobp = getFobpCount(result.embed_stats);

  const handleExtractClick = () => {
    if (!result.stego_png_base64) return;
    const file = base64PngToFile(
      result.stego_png_base64,
      getStegoFilename(embedResult.motif, result),
    );
    onExtractFile(file);
  };

  return (
    <section
      aria-label="Focused stego inspection"
      className="flex h-full min-h-0 flex-col gap-3 overflow-visible p-4 sm:p-5"
    >
      {/* Top Bar: Quick Scheme Switcher + All 3 + Stego/Heatmap Toggle */}
      <div className="focus-top-bar flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#FDFCF9] p-0.5"
          role="group"
          aria-label="Switch stego scheme"
        >
          {ALL_SCHEMES.map((scheme) => {
            const active = scheme === result.scheme;
            return (
              <button
                key={scheme}
                type="button"
                onClick={() => onSwitchScheme(scheme)}
                className={`rounded-full px-3 py-1 font-mono-tabular text-xs font-semibold transition-colors ${
                  active
                    ? scheme === 'scheme3'
                      ? 'bg-[#9A6B2F] text-[#FDFCF9]'
                      : 'bg-[#111110] text-[#FDFCF9]'
                    : 'text-[#6B665C] hover:text-[#111110]'
                }`}
              >
                {FOCUS_SCHEME_META[scheme].code}
              </button>
            );
          })}
          <span className="mx-0.5 h-3.5 w-px bg-[#E4DFD3]" aria-hidden="true" />
          <button
            type="button"
            onClick={onShowAll}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-[#6B665C] transition-colors hover:bg-[#F6F4EF] hover:text-[#111110]"
          >
            <LayoutGrid className="h-3 w-3" />
            <span>All 3</span>
          </button>
        </div>

        <div
          className="inline-flex rounded-full border border-[#E4DFD3] bg-[#FDFCF9] p-0.5"
          role="group"
          aria-label="Stego comparison view mode"
        >
          <button
            type="button"
            onClick={() => onChangeViewMode('stego')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'stego'
                ? 'bg-[#111110] text-[#FDFCF9]'
                : 'text-[#6B665C] hover:text-[#111110]'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Stego</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('heatmap')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'heatmap'
                ? 'bg-[#111110] text-[#FDFCF9]'
                : 'text-[#6B665C] hover:text-[#111110]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>×20 Heatmap</span>
          </button>
        </div>
      </div>

      {/* Center: Large Focused Image or Overflow Card */}
      <div className="focus-swap-content flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            ref={focusMediaRef}
            data-flip-id={`stego-${result.scheme}`}
            className={`flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border p-3 sm:p-4 ${
              isProposed
                ? 'border-[#9A6B2F]/45 bg-[#FDFCF9]'
                : 'border-[#E4DFD3] bg-[#FDFCF9]'
            }`}
          >
            {isOk ? (
              <>
                <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
                  {activeBase64 ? (
                    <img
                      src={base64ToPngDataUrl(activeBase64)}
                      alt={`${meta.title} ${viewMode === 'stego' ? 'stego PNG' : '×20 difference heatmap'}`}
                      className="h-full max-h-full w-full max-w-full rounded-lg object-contain"
                    />
                  ) : (
                    <span className="text-xs text-[#6B665C]">Image unavailable</span>
                  )}
                </div>

                {viewMode === 'heatmap' && embedResult.payload_bytes < 1024 && (
                  <p className="mt-2 shrink-0 rounded-md border border-[#E4DFD3] bg-[#F6F4EF] px-3 py-1 text-[11px] text-[#6B665C]">
                    Sub-1 KB payload ({formatBytes(embedResult.payload_bytes)}) — only top pixel rows
                    were modified, leaving the rest of the difference map black.
                  </p>
                )}
              </>
            ) : (
              <div className="w-full max-w-md space-y-3">
                <div
                  className={`rounded-xl border p-4 ${
                    result.status === 'overflow'
                      ? 'border-[#B45309]/35 bg-[#B45309]/[0.06] text-[#111110]'
                      : 'border-rose-300 bg-rose-50 text-rose-950'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#B45309]">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      {result.status === 'overflow'
                        ? 'Payload Exceeds Scheme Capacity'
                        : 'Embedding Failed'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#6B665C]">
                    {result.error ?? 'No stego image was produced for this scheme.'}
                  </p>
                </div>

                {result.capacity && (
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#E4DFD3] bg-[#F6F4EF] p-3 font-mono-tabular text-[11px] sm:grid-cols-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#6B665C]">
                        Payload
                      </div>
                      <div className="mt-0.5 font-semibold text-[#B45309]">
                        {formatBytes(embedResult.payload_bytes)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#6B665C]">
                        Max Cap
                      </div>
                      <div className="mt-0.5 font-semibold text-[#111110]">
                        {formatBytes(result.capacity.max_payload_bytes)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#6B665C]">
                        Total Bits
                      </div>
                      <div className="mt-0.5 text-[#111110]">
                        {result.capacity.capacity_bits.toLocaleString()} b
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#6B665C]">Rate</div>
                      <div className="mt-0.5 text-[#111110]">{result.capacity.bpp.toFixed(3)} bpp</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Details Panel */}
        <div className="shrink-0 space-y-2.5 rounded-2xl border border-[#E4DFD3] bg-[#FDFCF9] p-3.5 sm:p-4">
          <div className="focus-detail-stagger flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-editorial text-xl leading-none tracking-tight text-[#111110]">
                  {meta.title}
                </h2>
                {isProposed && (
                  <span className="rounded-full border border-[#9A6B2F]/40 bg-[#9A6B2F]/10 px-2 py-0.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A6B2F]">
                    Proposed
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-[#6B665C]">{meta.subtitle}</p>
            </div>
            <FocusStatusSeal status={result.status} />
          </div>

          <dl className="focus-detail-stagger grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-[#E4DFD3] bg-[#F6F4EF]/80 px-3.5 py-2.5 font-mono-tabular text-[11px] sm:grid-cols-5">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[#6B665C]">PSNR Total</dt>
              <dd className="mt-0.5 font-semibold text-[#111110]">
                {psnrTotal !== null ? `${formatMetric(psnrTotal, 2)} dB` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[#6B665C]">
                PSNR R / G / B
              </dt>
              <dd className="mt-0.5 text-[#111110]">
                {result.psnr
                  ? `${formatMetric(psnrR, 1)} / ${formatMetric(psnrG, 1)} / ${formatMetric(psnrB, 1)}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[#6B665C]">SSIM RGB / Y</dt>
              <dd className="mt-0.5 font-semibold text-[#111110]">
                {formatMetric(result.ssim?.ssim_rgb, 4)} / {formatMetric(result.ssim?.ssim_y, 4)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[#6B665C]">FOBP</dt>
              <dd className="mt-0.5 font-semibold text-[#111110]">
                {fobp !== null ? fobp.toLocaleString() : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[#6B665C]">Time (ms)</dt>
              <dd className="mt-0.5 text-[#111110]">
                {result.elapsed_ms !== null ? `${formatMetric(result.elapsed_ms, 1)} ms` : '—'}
              </dd>
            </div>
          </dl>

          <div className="focus-detail-stagger flex items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                result.stego_png_base64 &&
                downloadBase64Png(
                  result.stego_png_base64,
                  getStegoFilename(embedResult.motif, result),
                )
              }
              disabled={!result.stego_png_base64}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E4DFD3] bg-[#F6F4EF] px-3 py-2 text-xs font-medium text-[#111110] transition-colors hover:border-[#111110] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PNG</span>
            </button>
            <button
              type="button"
              onClick={handleExtractClick}
              disabled={!result.stego_png_base64}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isProposed
                  ? 'bg-[#9A6B2F] text-[#FDFCF9] hover:bg-[#825823]'
                  : 'bg-[#111110] text-[#FDFCF9] hover:bg-[#2A2926]'
              }`}
            >
              <span>Extract</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
