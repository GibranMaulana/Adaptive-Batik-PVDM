import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import type { SampleSummary } from '../../api/types';

interface TopSampleSliderProps {
  samples: SampleSummary[];
  selectedSampleKey: string;
  samplesLoading: boolean;
  samplesError: string | null;
  disabled?: boolean;
  onSelectSample: (sample: SampleSummary) => void;
  onRetry: () => void;
}

export function TopSampleSlider({
  samples,
  selectedSampleKey,
  samplesLoading,
  samplesError,
  disabled = false,
  onSelectSample,
  onRetry,
}: TopSampleSliderProps) {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!selectedSampleKey) return;
    const activeThumb = thumbRefs.current.get(selectedSampleKey);
    activeThumb?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [selectedSampleKey]);

  const handleScrollSlider = (direction: -1 | 1) => {
    sliderRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  return (
    <div className="compose-top-slider w-full shrink-0 px-4 pb-2 sm:px-6">
      {samplesLoading ? (
        <div className="flex items-center justify-center gap-2 py-2">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={idx}
              className="h-11 w-11 shrink-0 motion-safe:animate-pulse rounded-lg border border-[#E4DFD3] bg-[#FDFCF9]"
            />
          ))}
        </div>
      ) : samplesError ? (
        <div className="mx-auto flex max-w-[560px] items-center justify-between gap-3 rounded-xl border border-[#B45309]/35 bg-[#B45309]/[0.06] px-3.5 py-2 text-xs text-[#111110]">
          <span className="truncate">{samplesError}</span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#FDFCF9] px-2.5 py-1 font-medium hover:border-[#111110]"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      ) : (
        <div className="flex w-full items-center gap-2">
          <button
            type="button"
            aria-label="Scroll samples left"
            onClick={() => handleScrollSlider(-1)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E4DFD3] bg-[#FDFCF9] text-[#6B665C] transition-colors hover:border-[#9A6B2F] hover:text-[#111110]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            ref={sliderRef}
            role="listbox"
            aria-label="Batik cover samples"
            className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto scroll-smooth px-1.5 py-2"
          >
            {samples.map((sample) => {
              const key = `${sample.motif}/${sample.filename}`;
              const selected = key === selectedSampleKey;
              return (
                <button
                  key={key}
                  ref={(el) => {
                    if (el) {
                      thumbRefs.current.set(key, el);
                    } else {
                      thumbRefs.current.delete(key);
                    }
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={`Select ${sample.filename}`}
                  title={`${sample.motif} · ${sample.filename}`}
                  disabled={disabled}
                  onClick={() => onSelectSample(sample)}
                  className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#FDFCF9] transition-all duration-200 focus:outline-none disabled:cursor-not-allowed ${
                    selected
                      ? 'scale-105 ring-2 ring-[#9A6B2F] ring-offset-2 ring-offset-[#F6F4EF]'
                      : 'opacity-80 ring-1 ring-[#E4DFD3] hover:opacity-100 hover:ring-[#9A6B2F]/60'
                  }`}
                >
                  <img
                    src={sample.image_url}
                    alt={`${sample.motif} ${sample.filename}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Scroll samples right"
            onClick={() => handleScrollSlider(1)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E4DFD3] bg-[#FDFCF9] text-[#6B665C] transition-colors hover:border-[#9A6B2F] hover:text-[#111110]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
