import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { MotifName, SampleSummary } from '../../api/types';
import { formatKb } from '../../utils/payload';

interface SpecimenModalProps {
  open: boolean;
  samples: SampleSummary[];
  selectedSample: SampleSummary | null;
  onSelect: (sample: SampleSummary) => void;
  onClose: () => void;
}

type MotifFilter = 'all' | MotifName;

const MOTIF_TABS: { value: MotifFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'parang', label: 'Parang' },
  { value: 'kawung', label: 'Kawung' },
  { value: 'megamendung', label: 'Megamendung' },
];

export function SpecimenModal({
  open,
  samples,
  selectedSample,
  onSelect,
  onClose,
}: SpecimenModalProps) {
  const [motifFilter, setMotifFilter] = useState<MotifFilter>('all');

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const filteredSamples = useMemo(() => {
    if (motifFilter === 'all') return samples;
    return samples.filter((s) => s.motif === motifFilter);
  }, [samples, motifFilter]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111110]/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="specimen-archive-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#E4DFD3] bg-[#FDFCF9] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4DFD3] px-5 py-4">
          <div>
            <div className="font-mono-tabular text-[10px] uppercase tracking-[0.18em] text-[#9A6B2F]">
              Specimen Archive · 512 × 512 RGB PNG
            </div>
            <h2
              id="specimen-archive-title"
              className="font-editorial text-2xl leading-tight text-[#111110]"
            >
              All {samples.length || 45} Batik Cover Specimens
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close specimen archive"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E4DFD3] bg-[#F6F4EF] text-[#6B665C] transition-colors hover:border-[#111110] hover:text-[#111110]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4DFD3] bg-[#F6F4EF]/60 px-5 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Motif filter">
            {MOTIF_TABS.map((tab) => {
              const active = motifFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMotifFilter(tab.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#111110] text-[#FDFCF9]'
                      : 'border border-[#E4DFD3] bg-[#FDFCF9] text-[#6B665C] hover:border-[#9A6B2F] hover:text-[#111110]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <span className="font-mono-tabular text-[11px] text-[#6B665C]">
            {filteredSamples.length} of {samples.length} plates
          </span>
        </div>

        <div className="gallery-scroll flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {filteredSamples.map((sample) => {
              const selected =
                selectedSample?.motif === sample.motif &&
                selectedSample?.filename === sample.filename;
              return (
                <button
                  key={`${sample.motif}/${sample.filename}`}
                  type="button"
                  onClick={() => {
                    onSelect(sample);
                    onClose();
                  }}
                  className={`group relative flex flex-col rounded-lg border p-2 text-left transition-all ${
                    selected
                      ? 'border-[#9A6B2F] bg-[#F6F4EF] ring-1 ring-[#9A6B2F]'
                      : 'border-[#E4DFD3] bg-[#FDFCF9] hover:border-[#9A6B2F]/70'
                  }`}
                >
                  <div className="relative overflow-hidden rounded-md border border-[#E4DFD3] bg-[#F6F4EF]">
                    <img
                      src={sample.image_url}
                      alt={`${sample.motif} ${sample.filename}`}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#111110] text-[#FDFCF9]">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="mt-2 truncate font-mono-tabular text-[11px] font-medium text-[#111110]">
                    {sample.filename}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between font-mono-tabular text-[10px] text-[#6B665C]">
                    <span className="capitalize">{sample.motif}</span>
                    <span className="text-[#9A6B2F]">
                      {formatKb(sample.capacities.scheme3.max_payload_bytes)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
