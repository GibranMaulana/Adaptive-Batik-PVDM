import { useState } from 'react';
import { AlertCircle, ArrowRight, Download, Eye, Layers } from 'lucide-react';
import { base64PngToFile, base64ToPngDataUrl, downloadBase64Png } from '../api/client';
import type { EmbedResponse, SchemeEmbedResult } from '../api/types';
import {
  SCHEME_META,
  formatBytes,
  formatMetric,
  getFobpCount,
  getFobpPerChannel,
  getPsnrChannel,
  getPsnrTotal,
  getStegoFilename,
} from '../utils/payload';

interface SchemeComparisonProps {
  embedResult: EmbedResponse | null;
  isEmbedding: boolean;
  onTestInExtractor: (file: File) => void;
}

type ViewMode = 'stego' | 'heatmap';

function StatusBadge({ status }: { status: SchemeEmbedResult['status'] }) {
  if (status === 'ok') {
    return (
      <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-emerald-800">
        ok
      </span>
    );
  }
  if (status === 'overflow') {
    return (
      <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-amber-900">
        overflow
      </span>
    );
  }
  return (
    <span className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-rose-800">
      failed
    </span>
  );
}

export function SchemeComparison({
  embedResult,
  isEmbedding,
  onTestInExtractor,
}: SchemeComparisonProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('stego');

  const handleTestInExtractor = (motif: string, result: SchemeEmbedResult) => {
    if (!result.stego_png_base64) return;
    const filename = getStegoFilename(motif, result);
    const file = base64PngToFile(result.stego_png_base64, filename);
    onTestInExtractor(file);
  };

  return (
    <section className="rounded-md border border-slate-300 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded border border-slate-300 bg-slate-100 px-1.5 font-mono text-[11px] font-semibold text-slate-700">
              STEP 3
            </span>
            <h2 className="text-base font-semibold text-slate-900">
              3-Scheme PVDM Comparison &amp; HVS Telemetry
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Side-by-side PSNR, SSIM, FOBP, and visual distortion comparison across Schemes 1, 2,
            and 3.
          </p>
        </div>

        <div
          className="inline-flex rounded border border-slate-300 bg-slate-100 p-0.5"
          role="group"
          aria-label="Image view mode"
        >
          <button
            type="button"
            onClick={() => setViewMode('stego')}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
              viewMode === 'stego'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Stego Image
          </button>
          <button
            type="button"
            onClick={() => setViewMode('heatmap')}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
              viewMode === 'heatmap'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            ×20 Diff Heatmap
          </button>
        </div>
      </div>

      {isEmbedding && (
        <div className="mt-4 space-y-3">
          <div className="h-24 animate-pulse rounded border border-slate-200 bg-slate-100" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="h-72 animate-pulse rounded border border-slate-200 bg-slate-100"
              />
            ))}
          </div>
        </div>
      )}

      {!isEmbedding && !embedResult && (
        <div className="mt-4 rounded border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
          Select a cover sample and click <strong>Embed Across All 3 Schemes</strong> above to view
          PSNR, SSIM, FOBP metrics, stego images, and ×20 difference heatmaps.
        </div>
      )}

      {!isEmbedding && embedResult && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
            <span>
              Target: <strong>{embedResult.motif}/{embedResult.filename}</strong>
            </span>
            <span>
              Embedded Payload: <strong>{formatBytes(embedResult.payload_bytes)}</strong>
            </span>
          </div>

          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Scheme</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">PSNR Total</th>
                  <th className="px-3 py-2 font-semibold">PSNR R / G / B</th>
                  <th className="px-3 py-2 font-semibold">SSIM RGB</th>
                  <th className="px-3 py-2 font-semibold">SSIM Y</th>
                  <th className="px-3 py-2 font-semibold">FOBP</th>
                  <th className="px-3 py-2 font-semibold">Time (ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-xs">
                {embedResult.results.map((res) => {
                  const psnrTotal = getPsnrTotal(res.psnr);
                  const fobp = getFobpCount(res.embed_stats);
                  return (
                    <tr key={res.scheme} className="bg-white">
                      <td className="px-3 py-2 font-sans font-medium text-slate-900">
                        {SCHEME_META[res.scheme].fullName}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={res.status} />
                      </td>
                      <td className="px-3 py-2 text-slate-900">
                        {psnrTotal !== null ? `${formatMetric(psnrTotal, 2)} dB` : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {res.psnr
                          ? `${formatMetric(getPsnrChannel(res.psnr, 'r'), 2)} / ${formatMetric(getPsnrChannel(res.psnr, 'g'), 2)} / ${formatMetric(getPsnrChannel(res.psnr, 'b'), 2)}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-900">
                        {formatMetric(res.ssim?.ssim_rgb, 4)}
                      </td>
                      <td className="px-3 py-2 text-slate-900">
                        {formatMetric(res.ssim?.ssim_y, 4)}
                      </td>
                      <td className="px-3 py-2 text-slate-900">
                        {fobp !== null ? fobp.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {res.elapsed_ms !== null ? formatMetric(res.elapsed_ms, 1) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {embedResult.results.map((res) => {
              const meta = SCHEME_META[res.scheme];
              const isOk = res.status === 'ok';
              const activeBase64 =
                viewMode === 'stego' ? res.stego_png_base64 : res.heatmap_png_base64;
              const psnrTotal = getPsnrTotal(res.psnr);
              const fobp = getFobpCount(res.embed_stats);
              const fobpChannels = getFobpPerChannel(res.embed_stats);

              return (
                <div
                  key={res.scheme}
                  className="flex flex-col rounded border border-slate-300 bg-white p-3.5"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2.5">
                    <div>
                      <div className="font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {meta.badge}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">{meta.fullName}</h3>
                    </div>
                    <StatusBadge status={res.status} />
                  </div>

                  {!isOk && (
                    <div className="mt-3 flex flex-1 flex-col justify-between gap-3">
                      <div
                        className={`rounded border p-3 text-xs ${
                          res.status === 'overflow'
                            ? 'border-amber-300 bg-amber-50 text-amber-950'
                            : 'border-rose-300 bg-rose-50 text-rose-950'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>
                            {res.status === 'overflow'
                              ? 'Capacity Exceeded'
                              : 'Embedding Failed'}
                          </span>
                        </div>
                        <p className="mt-1.5 leading-relaxed">
                          {res.error ?? 'No image generated for this scheme.'}
                        </p>
                      </div>

                      {res.capacity && (
                        <div className="rounded border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-700">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Max payload:</span>
                            <span>{formatBytes(res.capacity.max_payload_bytes)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Capacity bits:</span>
                            <span>{res.capacity.capacity_bits.toLocaleString()} bits</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Rate:</span>
                            <span>{res.capacity.bpp.toFixed(3)} bpp</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isOk && (
                    <>
                      <div className="mt-3 overflow-hidden rounded border border-slate-200 bg-slate-100">
                        {activeBase64 ? (
                          <img
                            src={base64ToPngDataUrl(activeBase64)}
                            alt={`${meta.fullName} ${viewMode}`}
                            className="aspect-square w-full object-contain"
                          />
                        ) : (
                          <div className="flex aspect-square items-center justify-center text-xs text-slate-500">
                            Image unavailable
                          </div>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-slate-500">
                        <span>
                          View: {viewMode === 'stego' ? 'Lossless Stego PNG' : '|Cover - Stego| × 20'}
                        </span>
                        {res.elapsed_ms !== null && <span>{formatMetric(res.elapsed_ms, 1)} ms</span>}
                      </div>

                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-200 pt-2.5 font-mono text-[11px]">
                        <div>
                          <dt className="text-slate-500">PSNR Total</dt>
                          <dd className="font-semibold text-slate-900">
                            {psnrTotal !== null ? `${formatMetric(psnrTotal, 2)} dB` : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">SSIM RGB / Y</dt>
                          <dd className="font-semibold text-slate-900">
                            {formatMetric(res.ssim?.ssim_rgb, 4)} / {formatMetric(res.ssim?.ssim_y, 4)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">FOBP (Fall-Off)</dt>
                          <dd className="font-semibold text-slate-900">
                            {fobp !== null ? fobp.toLocaleString() : '—'}
                            {fobpChannels && (
                              <span className="ml-1 font-normal text-slate-500">
                                ({Object.entries(fobpChannels)
                                  .map(([ch, val]) => `${ch}:${val}`)
                                  .join(' ')})
                              </span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Max Capacity</dt>
                          <dd className="text-slate-800">
                            {res.capacity
                              ? `${formatBytes(res.capacity.max_payload_bytes)} (${res.capacity.bpp.toFixed(2)} bpp)`
                              : '—'}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                        <button
                          type="button"
                          onClick={() =>
                            res.stego_png_base64 &&
                            downloadBase64Png(
                              res.stego_png_base64,
                              getStegoFilename(embedResult.motif, res),
                            )
                          }
                          disabled={!res.stego_png_base64}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download Stego PNG
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestInExtractor(embedResult.motif, res)}
                          disabled={!res.stego_png_base64}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-slate-900 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span>Test in Extractor</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
