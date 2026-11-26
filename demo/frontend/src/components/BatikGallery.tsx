import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Grid2x2, RefreshCw } from 'lucide-react';
import type { MotifName, SampleSummary } from '../api/types';
import { formatKb } from '../utils/payload';

interface BatikGalleryProps {
  samples: SampleSummary[];
  selectedSample: SampleSummary | null;
  onSelectSample: (sample: SampleSummary) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

type MotifFilter = 'all' | MotifName;

const MOTIF_FILTERS: { value: MotifFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'parang', label: 'Parang' },
  { value: 'kawung', label: 'Kawung' },
  { value: 'megamendung', label: 'Megamendung' },
];

const FEATURED_FILENAMES = new Set(['parang_01.png', 'kawung_01.png', 'megamendung_01.png']);

function isFeaturedSample(sample: SampleSummary): boolean {
  return sample.featured || FEATURED_FILENAMES.has(sample.filename);
}

export function BatikGallery({
  samples,
  selectedSample,
  onSelectSample,
  loading,
  error,
  onRetry,
}: BatikGalleryProps) {
  const [showCatalog, setShowCatalog] = useState(false);
  const [motifFilter, setMotifFilter] = useState<MotifFilter>('all');

  const featuredSamples = useMemo(
    () => samples.filter((sample) => isFeaturedSample(sample)),
    [samples],
  );

  const filteredSamples = useMemo(() => {
    if (motifFilter === 'all') return samples;
    return samples.filter((sample) => sample.motif === motifFilter);
  }, [samples, motifFilter]);

  const isSelectedFeatured = selectedSample ? isFeaturedSample(selectedSample) : false;

  return (
    <section className="rounded-md border border-slate-300 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded border border-slate-300 bg-slate-100 px-1.5 font-mono text-[11px] font-semibold text-slate-700">
              STEP 1
            </span>
            <h2 className="text-base font-semibold text-slate-900">
              Select Batik Cover Image
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Featured 512×512 PNG covers across Parang, Kawung, and Megamendung motifs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCatalog((prev) => !prev)}
          disabled={loading || samples.length === 0}
          className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Grid2x2 className="h-3.5 w-3.5" />
          <span>
            {showCatalog
              ? 'Hide full catalog'
              : `Browse all ${samples.length || 45} samples`}
          </span>
          {showCatalog ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {loading && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="h-44 animate-pulse rounded border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
          <span>Failed to load cover samples: {error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded border border-rose-300 bg-white px-2.5 py-1 font-medium text-rose-800 hover:bg-rose-100"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {!loading && !error && samples.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {featuredSamples.map((sample) => {
              const selected =
                selectedSample?.motif === sample.motif &&
                selectedSample?.filename === sample.filename;
              return (
                <button
                  key={`${sample.motif}/${sample.filename}`}
                  type="button"
                  onClick={() => onSelectSample(sample)}
                  className={`flex items-start gap-3 rounded border p-3 text-left transition-colors ${
                    selected
                      ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <img
                    src={sample.image_url}
                    alt={`${sample.motif} ${sample.filename}`}
                    className="h-20 w-20 shrink-0 rounded border border-slate-200 bg-slate-100 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {sample.motif}
                      </span>
                      {selected && (
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="truncate font-mono text-xs font-semibold text-slate-900">
                      {sample.filename}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {sample.width}×{sample.height} px
                    </div>
                    <div className="mt-2 space-y-0.5 border-t border-slate-200 pt-1.5 font-mono text-[11px] text-slate-700">
                      <div className="flex justify-between">
                        <span className="text-slate-500">S1 max:</span>
                        <span>{formatKb(sample.capacities.scheme1.max_payload_bytes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">S2 max:</span>
                        <span>{formatKb(sample.capacities.scheme2.max_payload_bytes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">S3 max:</span>
                        <span className="font-semibold text-slate-900">
                          {formatKb(sample.capacities.scheme3.max_payload_bytes)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedSample && !isSelectedFeatured && !showCatalog && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs">
              <div className="flex items-center gap-2.5">
                <img
                  src={selectedSample.image_url}
                  alt={selectedSample.filename}
                  className="h-8 w-8 rounded border border-slate-300 object-cover"
                />
                <span>
                  Selected from catalog:{' '}
                  <strong className="font-mono">{selectedSample.filename}</strong> (
                  {selectedSample.motif}, {selectedSample.width}×{selectedSample.height})
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-600">
                S1 {formatKb(selectedSample.capacities.scheme1.max_payload_bytes)} · S2{' '}
                {formatKb(selectedSample.capacities.scheme2.max_payload_bytes)} · S3{' '}
                {formatKb(selectedSample.capacities.scheme3.max_payload_bytes)}
              </span>
            </div>
          )}

          {showCatalog && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {MOTIF_FILTERS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setMotifFilter(item.value)}
                      className={`rounded border px-2.5 py-1 text-xs font-medium ${
                        motifFilter === item.value
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <span className="font-mono text-xs text-slate-500">
                  Showing {filteredSamples.length} of {samples.length} images
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {filteredSamples.map((sample) => {
                  const selected =
                    selectedSample?.motif === sample.motif &&
                    selectedSample?.filename === sample.filename;
                  return (
                    <button
                      key={`${sample.motif}/${sample.filename}`}
                      type="button"
                      onClick={() => onSelectSample(sample)}
                      className={`flex flex-col rounded border p-2 text-left transition-colors ${
                        selected
                          ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                          : 'border-slate-200 bg-white hover:border-slate-400'
                      }`}
                    >
                      <img
                        src={sample.image_url}
                        alt={sample.filename}
                        loading="lazy"
                        className="aspect-square w-full rounded border border-slate-200 bg-slate-100 object-cover"
                      />
                      <div className="mt-1.5 truncate font-mono text-[11px] font-medium text-slate-900">
                        {sample.filename}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] text-slate-500">
                        <span className="uppercase">{sample.motif.slice(0, 4)}</span>
                        <span>S3: {formatKb(sample.capacities.scheme3.max_payload_bytes)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
