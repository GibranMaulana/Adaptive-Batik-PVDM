import { ScanSearch } from 'lucide-react';

export function BlindExtractor() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
          <ScanSearch className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            4. Reverse / Blind Stego PNG Extractor — Scaffold for Issue #14
          </h2>
          <p className="text-sm text-slate-500">
            Placeholder for uploading a stego PNG and running blind extraction across Schemes 1, 2, and 3.
          </p>
        </div>
      </div>
    </section>
  );
}
