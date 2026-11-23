import { FileText } from 'lucide-react';

export function PayloadComposer() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            2. Secret Message &amp; Payload Presets — Scaffold for Issue #14
          </h2>
          <p className="text-sm text-slate-500">
            Placeholder for UTF-8 secret message composer, presets, and byte-budget telemetry.
          </p>
        </div>
      </div>
    </section>
  );
}
