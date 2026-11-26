import { AlertTriangle, Loader2, Play } from 'lucide-react';
import type { SampleSummary, SchemeName } from '../api/types';
import {
  ALL_SCHEMES,
  SAMPLE_MESSAGE,
  SCHEME_META,
  formatBytes,
  generateDeterministicPayload,
  utf8ByteLength,
} from '../utils/payload';

interface PayloadComposerProps {
  selectedSample: SampleSummary | null;
  message: string;
  onChangeMessage: (value: string) => void;
  onEmbed: () => void;
  isEmbedding: boolean;
  embedError: string | null;
}

const PRESETS: { label: string; build: () => string }[] = [
  { label: 'Sample Text', build: () => SAMPLE_MESSAGE },
  { label: '1 KB', build: () => generateDeterministicPayload(1024) },
  { label: '10 KB', build: () => generateDeterministicPayload(10 * 1024) },
  { label: '50 KB (Stress Test)', build: () => generateDeterministicPayload(50 * 1024) },
];

export function PayloadComposer({
  selectedSample,
  message,
  onChangeMessage,
  onEmbed,
  isEmbedding,
  embedError,
}: PayloadComposerProps) {
  const payloadBytes = utf8ByteLength(message);

  const scheme1Max = selectedSample?.capacities.scheme1.max_payload_bytes ?? null;
  const scheme1Overflow = scheme1Max !== null && payloadBytes > scheme1Max;

  return (
    <section className="rounded-md border border-slate-300 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded border border-slate-300 bg-slate-100 px-1.5 font-mono text-[11px] font-semibold text-slate-700">
              STEP 2
            </span>
            <h2 className="text-base font-semibold text-slate-900">
              Compose Secret UTF-8 Payload
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Enter custom UTF-8 text or load a deterministic byte-exact payload preset.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChangeMessage(preset.build())}
              disabled={isEmbedding}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="secret-payload-input" className="font-medium text-slate-700">
            Secret Message (UTF-8)
          </label>
          <span className="font-mono text-slate-700">
            Payload size: <strong>{formatBytes(payloadBytes)}</strong> (
            {(payloadBytes / 1024).toFixed(2)} KB)
          </span>
        </div>

        <textarea
          id="secret-payload-input"
          rows={4}
          value={message}
          onChange={(e) => onChangeMessage(e.target.value)}
          placeholder="Type secret UTF-8 text here or pick a preset above..."
          className="mt-1.5 w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
        />
      </div>

      {selectedSample && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ALL_SCHEMES.map((scheme: SchemeName) => {
            const cap = selectedSample.capacities[scheme];
            const maxBytes = cap.max_payload_bytes;
            const overflow = payloadBytes > maxBytes;
            const pct = maxBytes > 0 ? Math.min(100, (payloadBytes / maxBytes) * 100) : 100;

            return (
              <div
                key={scheme}
                className={`rounded border px-3 py-2 text-xs ${
                  overflow
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    {SCHEME_META[scheme].shortLabel}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                      overflow
                        ? 'border border-amber-300 bg-amber-100 text-amber-900'
                        : 'border border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {overflow ? 'OVERFLOW' : `${pct.toFixed(1)}%`}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-slate-600">
                  <span>
                    {formatBytes(payloadBytes)} / {formatBytes(maxBytes)}
                  </span>
                  <span>{cap.bpp.toFixed(2)} bpp</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full ${overflow ? 'bg-amber-600' : 'bg-slate-800'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {scheme1Overflow && (
        <div className="mt-3 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <span>
            <strong>Scheme 1 Capacity Overflow:</strong> Payload ({formatBytes(payloadBytes)})
            exceeds Scheme 1 max capacity ({formatBytes(scheme1Max)}). Scheme 1 will report an
            overflow error, while <strong>Scheme 2 &amp; Scheme 3 will still embed</strong>{' '}
            independently.
          </span>
        </div>
      )}

      {embedError && (
        <div className="mt-3 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <strong>Embed request failed:</strong> {embedError}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <div className="font-mono text-xs text-slate-500">
          {selectedSample
            ? `Cover: ${selectedSample.motif}/${selectedSample.filename}`
            : 'No cover image selected'}
        </div>

        <button
          type="button"
          onClick={onEmbed}
          disabled={!selectedSample || isEmbedding}
          className="inline-flex items-center gap-2 rounded border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-600"
        >
          {isEmbedding ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Embedding Across All 3 Schemes...</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              <span>Embed Across All 3 Schemes</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}
