import { Image } from 'lucide-react';

export function BatikGallery() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <Image className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            1. Batik Cover Sample Gallery — Scaffold for Issue #14
          </h2>
          <p className="text-sm text-slate-500">
            Placeholder for curated Batik cover sample selection and per-scheme capacity display.
          </p>
        </div>
      </div>
    </section>
  );
}
