import { BatikGallery } from './components/BatikGallery';
import { PayloadComposer } from './components/PayloadComposer';
import { SchemeComparison } from './components/SchemeComparison';
import { BlindExtractor } from './components/BlindExtractor';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Adaptive Batik PVDM — Interactive Demo Workbench (Phase 0 Scaffold)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Phase 0 React + TypeScript + Tailwind CSS v4 frontend shell for Issues #13 &amp; #14.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <BatikGallery />
        <PayloadComposer />
        <SchemeComparison />
        <BlindExtractor />
      </main>
    </div>
  );
}

export default App;
