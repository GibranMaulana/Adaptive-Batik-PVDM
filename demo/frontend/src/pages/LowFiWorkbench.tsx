import { useCallback, useEffect, useRef, useState } from 'react';
import { embedPayload, fetchHealth, fetchSamples } from '../api/client';
import type { EmbedResponse, HealthResponse, SampleSummary } from '../api/types';
import { BatikGallery } from '../components/BatikGallery';
import { BlindExtractor, type PreloadedExtractFile } from '../components/BlindExtractor';
import { PayloadComposer } from '../components/PayloadComposer';
import { SchemeComparison } from '../components/SchemeComparison';
import { SAMPLE_MESSAGE } from '../utils/payload';

type ActiveTab = 'embed' | 'extract';

function pickDefaultSample(samples: SampleSummary[]): SampleSummary | null {
  if (samples.length === 0) return null;
  return (
    samples.find((s) => s.motif === 'parang' && s.filename === 'parang_01.png') ??
    samples.find((s) => s.featured) ??
    samples[0]
  );
}

export function LowFiWorkbench() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('embed');

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthOffline, setHealthOffline] = useState(false);

  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState<SampleSummary | null>(null);

  const [message, setMessage] = useState<string>(SAMPLE_MESSAGE);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [embedResult, setEmbedResult] = useState<EmbedResponse | null>(null);

  const extractCounterRef = useRef(0);
  const [preloadExtract, setPreloadExtract] = useState<PreloadedExtractFile | null>(null);

  const fetchCatalogAndHealth = useCallback(async () => {
    fetchHealth()
      .then((res) => {
        setHealth(res);
        setHealthOffline(false);
      })
      .catch(() => {
        setHealthOffline(true);
      });

    try {
      const catalog = await fetchSamples();
      setSamples(catalog.samples);
      setSamplesError(null);
      setSelectedSample((current) => {
        if (current) {
          const match = catalog.samples.find(
            (s) => s.motif === current.motif && s.filename === current.filename,
          );
          if (match) return match;
        }
        return pickDefaultSample(catalog.samples);
      });
    } catch (err) {
      setSamplesError(err instanceof Error ? err.message : 'Unable to reach /api/samples.');
    } finally {
      setSamplesLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((res) => {
        if (!active) return;
        setHealth(res);
        setHealthOffline(false);
      })
      .catch(() => {
        if (!active) return;
        setHealthOffline(true);
      });

    fetchSamples()
      .then((catalog) => {
        if (!active) return;
        setSamples(catalog.samples);
        setSamplesError(null);
        setSelectedSample((current) => current ?? pickDefaultSample(catalog.samples));
      })
      .catch((err) => {
        if (!active) return;
        setSamplesError(err instanceof Error ? err.message : 'Unable to reach /api/samples.');
      })
      .finally(() => {
        if (active) {
          setSamplesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleRetrySamples = () => {
    setSamplesLoading(true);
    setSamplesError(null);
    void fetchCatalogAndHealth();
  };

  const handleEmbed = async () => {
    if (!selectedSample) return;
    setIsEmbedding(true);
    setEmbedError(null);

    try {
      const response = await embedPayload({
        motif: selectedSample.motif,
        filename: selectedSample.filename,
        message,
      });
      setEmbedResult(response);
    } catch (err) {
      setEmbedError(err instanceof Error ? err.message : 'Embedding request failed.');
    } finally {
      setIsEmbedding(false);
    }
  };

  const handleTestInExtractor = (file: File) => {
    extractCounterRef.current += 1;
    setPreloadExtract({ file, requestId: extractCounterRef.current });
    setActiveTab('extract');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-300 bg-white">
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                Adaptive Batik PVDM — Interactive Demo
              </h1>
              <p className="text-xs text-slate-600">
                3-Scheme RGB Pixel-Value Difference &amp; Modulus Workbench (HVS-Asymmetric PVDM)
              </p>
            </div>

            <div className="font-mono text-[11px]">
              {health ? (
                <span className="inline-flex items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-900">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  API: {health.status}
                </span>
              ) : healthOffline ? (
                <span className="inline-flex items-center gap-1.5 rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-rose-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                  API: offline
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-slate-600">
                  API: checking...
                </span>
              )}
            </div>
          </div>

          <nav className="-mb-px flex gap-2" aria-label="Workbench tabs">
            <button
              type="button"
              onClick={() => setActiveTab('embed')}
              className={`border-b-2 px-3 py-2 text-xs font-semibold sm:text-sm ${
                activeTab === 'embed'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              1. Embed &amp; Compare
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('extract')}
              className={`border-b-2 px-3 py-2 text-xs font-semibold sm:text-sm ${
                activeTab === 'extract'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              2. Blind Extract
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className={activeTab === 'embed' ? 'space-y-5' : 'hidden'}>
          <BatikGallery
            samples={samples}
            selectedSample={selectedSample}
            onSelectSample={setSelectedSample}
            loading={samplesLoading}
            error={samplesError}
            onRetry={handleRetrySamples}
          />

          <PayloadComposer
            selectedSample={selectedSample}
            message={message}
            onChangeMessage={setMessage}
            onEmbed={() => void handleEmbed()}
            isEmbedding={isEmbedding}
            embedError={embedError}
          />

          <SchemeComparison
            embedResult={embedResult}
            isEmbedding={isEmbedding}
            onTestInExtractor={handleTestInExtractor}
          />
        </div>

        <div className={activeTab === 'extract' ? 'block' : 'hidden'}>
          <BlindExtractor
            key={preloadExtract?.requestId ?? 0}
            preloadRequest={preloadExtract}
          />
        </div>
      </main>
    </div>
  );
}

export default LowFiWorkbench;
