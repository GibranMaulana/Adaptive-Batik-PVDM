import { AlertCircle, ArrowRight, Download } from 'lucide-react';
import { base64PngToFile, base64ToPngDataUrl, downloadBase64Png } from '../../api/client';
import type { SchemeEmbedResult, SchemeName } from '../../api/types';
import {
  formatBytes,
  formatMetric,
  getFobpCount,
  getPsnrChannel,
  getPsnrTotal,
  getStegoFilename,
} from '../../utils/payload';

export type GalleryViewMode = 'stego' | 'heatmap';

interface SchemeResultCardProps {
  motif: string;
  payloadBytes: number;
  result: SchemeEmbedResult;
  viewMode: GalleryViewMode;
  onExtractFile: (file: File) => void;
}

const EDITORIAL_SCHEME_TITLES: Record<
  SchemeName,
  { index: string; title: string; subtitle: string }
> = {
  scheme1: {
    index: '01',
    title: '01 · Modified Pixel Indicator',
    subtitle: 'Baseline MPI · Channel-Indicator LSB/PVD',
  },
  scheme2: {
    index: '02',
    title: '02 · Symmetric 6-Level PVDM',
    subtitle: 'Uniform RGB Modulus · Non-HVS Range Table',
  },
  scheme3: {
    index: '03',
    title: '03 · Proposed HVS-Asymmetric PVDM',
    subtitle: 'Perceptual Luminance-Weighted RGB Allocation',
  },
};

function StatusSeal({ status }: { status: SchemeEmbedResult['status'] }) {
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

export function SchemeResultCard({
  motif,
  payloadBytes,
  result,
  viewMode,
  onExtractFile,
}: SchemeResultCardProps) {
  const isProposed = result.scheme === 'scheme3';
  const meta = EDITORIAL_SCHEME_TITLES[result.scheme];
  const isOk = result.status === 'ok';
  const activeBase64 = viewMode === 'stego' ? result.stego_png_base64 : result.heatmap_png_base64;

  const psnrTotal = getPsnrTotal(result.psnr);
  const psnrR = getPsnrChannel(result.psnr, 'r');
  const psnrG = getPsnrChannel(result.psnr, 'g');
  const psnrB = getPsnrChannel(result.psnr, 'b');
  const fobp = getFobpCount(result.embed_stats);

  const handleExtractClick = () => {
    if (!result.stego_png_base64) return;
    const file = base64PngToFile(result.stego_png_base64, getStegoFilename(motif, result));
    onExtractFile(file);
  };

  return (
    <article
      className={`scheme-stagger-card rounded-xl border p-4 transition-colors sm:p-5 ${
        isProposed
          ? 'border-[#9A6B2F] bg-[#FDFCF9] shadow-[0_10px_30px_-18px_rgba(154,107,47,0.35)] ring-1 ring-[#9A6B2F]/25'
          : 'border-[#E4DFD3] bg-[#FDFCF9]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E4DFD3] pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-editorial text-xl tracking-tight text-[#111110] sm:text-2xl">
              {meta.title}
            </h3>
            {isProposed && (
              <span className="rounded-full border border-[#9A6B2F]/40 bg-[#9A6B2F]/10 px-2 py-0.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9A6B2F]">
                Proposed
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[#6B665C]">{meta.subtitle}</p>
        </div>
        <StatusSeal status={result.status} />
      </div>

      {!isOk && (
        <div className="mt-4 space-y-3">
          <div
            className={`rounded-lg border p-4 ${
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
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF] p-3 font-mono-tabular text-[11px] sm:grid-cols-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#6B665C]">Payload</div>
                <div className="mt-0.5 font-semibold text-[#B45309]">
                  {formatBytes(payloadBytes)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#6B665C]">Max Cap</div>
                <div className="mt-0.5 font-semibold text-[#111110]">
                  {formatBytes(result.capacity.max_payload_bytes)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#6B665C]">Total Bits</div>
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

      {isOk && (
        <>
          <div className="mt-4 overflow-hidden rounded-lg border border-[#E4DFD3] bg-[#F6F4EF]">
            {activeBase64 ? (
              <img
                src={base64ToPngDataUrl(activeBase64)}
                alt={`${meta.title} ${viewMode === 'stego' ? 'stego PNG' : '×20 difference heatmap'}`}
                className="aspect-square max-h-[340px] w-full object-contain"
              />
            ) : (
              <div className="flex aspect-square max-h-[300px] items-center justify-center text-xs text-[#6B665C]">
                Image unavailable
              </div>
            )}
          </div>

          {viewMode === 'heatmap' && payloadBytes < 1024 && (
            <p className="mt-2 rounded-md border border-[#E4DFD3] bg-[#F6F4EF] px-3 py-1.5 text-[11px] text-[#6B665C]">
              Sub-1 KB payload ({formatBytes(payloadBytes)}) — only the top row(s) of pixels were
              modified, so the rest of the difference map remains black.
            </p>
          )}

          <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF]/75 px-3.5 py-2.5 font-mono-tabular text-[11px] sm:grid-cols-5">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[#6B665C]">PSNR Total</dt>
              <dd className="mt-0.5 font-semibold text-[#111110]">
                {psnrTotal !== null ? `${formatMetric(psnrTotal, 2)} dB` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-[#6B665C]">R / G / B</dt>
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
              <dt className="text-[10px] uppercase tracking-wider text-[#6B665C]">Time</dt>
              <dd className="mt-0.5 text-[#111110]">
                {result.elapsed_ms !== null ? `${formatMetric(result.elapsed_ms, 1)} ms` : '—'}
              </dd>
            </div>
          </dl>

          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                result.stego_png_base64 &&
                downloadBase64Png(result.stego_png_base64, getStegoFilename(motif, result))
              }
              disabled={!result.stego_png_base64}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E4DFD3] bg-[#F6F4EF] px-3 py-2 text-xs font-medium text-[#111110] transition-colors hover:border-[#111110] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PNG</span>
            </button>
            <button
              type="button"
              onClick={handleExtractClick}
              disabled={!result.stego_png_base64}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isProposed
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
    </article>
  );
}
