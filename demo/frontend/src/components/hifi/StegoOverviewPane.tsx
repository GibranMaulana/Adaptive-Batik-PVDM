import { AlertCircle, ArrowRight } from 'lucide-react';
import { base64ToPngDataUrl } from '../../api/client';
import type { EmbedResponse, SchemeEmbedResult, SchemeName } from '../../api/types';
import { ALL_SCHEMES, formatBytes } from '../../utils/payload';

interface StegoOverviewPaneProps {
  embedResult: EmbedResponse | null;
  isEmbedding: boolean;
  onSelectScheme: (scheme: SchemeName, tileEl: HTMLElement | null) => void;
}

const OVERVIEW_PILLS: Record<SchemeName, string> = {
  scheme1: '01 · Scheme 1',
  scheme2: '02 · Scheme 2',
  scheme3: '03 · Proposed HVS',
};

export function StegoOverviewPane({
  embedResult,
  isEmbedding,
  onSelectScheme,
}: StegoOverviewPaneProps) {
  const resultMap = new Map<SchemeName, SchemeEmbedResult>();
  if (embedResult) {
    for (const item of embedResult.results) {
      resultMap.set(item.scheme, item);
    }
  }

  return (
    <section
      aria-label="Stego overview gallery"
      className="flex h-full min-h-0 flex-col overflow-visible p-4 sm:p-5"
    >
      <div className="grid min-h-0 flex-1 grid-rows-3 gap-3">
        {ALL_SCHEMES.map((scheme) => {
          const result = resultMap.get(scheme) ?? null;
          const isProposed = scheme === 'scheme3';
          const isLoading = !result || isEmbedding;
          const isOverflow = result?.status === 'overflow';
          const isFailed = result?.status === 'failed';
          const isOk = result?.status === 'ok' && Boolean(result.stego_png_base64);

          return (
            <button
              key={scheme}
              type="button"
              disabled={isLoading}
              onClick={(e) => {
                if (!result) return;
                const mediaEl = e.currentTarget.querySelector<HTMLElement>(
                  `[data-flip-id="stego-${scheme}"]`,
                );
                onSelectScheme(scheme, mediaEl);
              }}
              className={`stego-overview-slot group relative flex min-h-0 w-full items-center justify-center overflow-visible rounded-2xl border p-3 text-left transition-colors focus:outline-none disabled:cursor-wait ${
                isProposed
                  ? 'border-[#9A6B2F]/45 bg-[#FDFCF9] hover:border-[#9A6B2F] hover:shadow-[0_12px_32px_-20px_rgba(154,107,47,0.45)]'
                  : 'border-[#E4DFD3] bg-[#FDFCF9] hover:border-[#9A6B2F]/75 hover:shadow-[0_12px_28px_-22px_rgba(17,17,16,0.22)]'
              } ${!isLoading ? 'cursor-pointer' : ''}`}
            >
              {/* Subtle top-left pill label */}
              <span
                className={`absolute top-2.5 left-3 z-10 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono-tabular text-[10px] font-semibold tracking-wide ${
                  isProposed
                    ? 'border-[#9A6B2F]/40 bg-[#FDFCF9]/95 text-[#9A6B2F]'
                    : 'border-[#E4DFD3] bg-[#FDFCF9]/95 text-[#6B665C]'
                }`}
              >
                {OVERVIEW_PILLS[scheme]}
              </span>

              {/* Hover inspect badge */}
              {!isLoading && (
                <span className="pointer-events-none absolute top-2.5 right-3 z-10 inline-flex items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#FDFCF9]/95 px-2.5 py-0.5 text-[10px] font-medium text-[#111110] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span>Inspect</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              )}

              {/* Slot body */}
              <div
                data-flip-id={`stego-${scheme}`}
                className="flex h-full w-full min-h-0 items-center justify-center"
              >
                {isLoading ? (
                  <div className="flex aspect-square h-full max-h-full items-center justify-center rounded-xl border border-[#E4DFD3] bg-[#F6F4EF] motion-safe:animate-pulse">
                    <div className="h-2 w-12 rounded-full bg-[#E4DFD3]" />
                  </div>
                ) : isOk && result?.stego_png_base64 ? (
                  <img
                    src={base64ToPngDataUrl(result.stego_png_base64)}
                    alt={`${OVERVIEW_PILLS[scheme]} stego output`}
                    className="stego-reveal-image h-full max-h-full w-full max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 px-6 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider ${
                        isOverflow
                          ? 'border-[#B45309]/35 bg-[#B45309]/10 text-[#B45309]'
                          : 'border-rose-300 bg-rose-50 text-rose-800'
                      }`}
                    >
                      <AlertCircle className="h-3 w-3" />
                      <span>{isOverflow ? 'Capacity Overflow' : isFailed ? 'Failed' : 'Unavailable'}</span>
                    </span>
                    {result?.capacity && embedResult && (
                      <span className="font-mono-tabular text-[11px] text-[#6B665C]">
                        Payload {formatBytes(embedResult.payload_bytes)} exceeds max{' '}
                        {formatBytes(result.capacity.max_payload_bytes)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
