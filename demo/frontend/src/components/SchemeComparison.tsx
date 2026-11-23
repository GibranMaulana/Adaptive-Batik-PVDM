import { BarChart3 } from 'lucide-react';

export function SchemeComparison() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            3. 3-Scheme PVDM Comparison &amp; HVS Telemetry — Scaffold for Issue #14
          </h2>
          <p className="text-sm text-slate-500">
            Placeholder for side-by-side Scheme 1/2/3 stego outputs, difference heatmaps, PSNR/SSIM, and FOBP metrics.
          </p>
        </div>
      </div>
    </section>
  );
}
