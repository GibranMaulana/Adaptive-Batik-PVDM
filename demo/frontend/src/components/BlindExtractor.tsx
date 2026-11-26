import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileImage,
  Loader2,
  ScanSearch,
  Upload,
  XCircle,
} from 'lucide-react';
import { extractStego } from '../api/client';
import type { ExtractResponse, ExtractionCandidate, SchemeName } from '../api/types';
import { ALL_SCHEMES, SCHEME_META, formatBytes } from '../utils/payload';

export interface PreloadedExtractFile {
  file: File;
  requestId: number;
}

interface BlindExtractorProps {
  preloadRequest: PreloadedExtractFile | null;
}

type SchemeMode = 'auto' | SchemeName;

export function BlindExtractor({ preloadRequest }: BlindExtractorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requestSeqRef = useRef(0);

  const [selectedFile, setSelectedFile] = useState<File | null>(
    () => preloadRequest?.file ?? null,
  );
  const [schemeMode, setSchemeMode] = useState<SchemeMode>('auto');
  const [isDragging, setIsDragging] = useState(false);

  const [isExtracting, setIsExtracting] = useState(() => Boolean(preloadRequest));
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractResult, setExtractResult] = useState<ExtractResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const runExtraction = useCallback(async (file: File, mode: SchemeMode) => {
    const seq = ++requestSeqRef.current;
    setIsExtracting(true);
    setExtractError(null);
    setExtractResult(null);
    setCopied(false);

    try {
      const response = await extractStego(file, mode === 'auto' ? null : mode);
      if (requestSeqRef.current !== seq) return;
      setExtractResult(response);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setExtractError(err instanceof Error ? err.message : 'Extraction failed.');
    } finally {
      if (requestSeqRef.current === seq) {
        setIsExtracting(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!preloadRequest) return;
    let active = true;
    const seq = ++requestSeqRef.current;

    extractStego(preloadRequest.file, null)
      .then((response) => {
        if (!active || requestSeqRef.current !== seq) return;
        setExtractResult(response);
        setExtractError(null);
      })
      .catch((err) => {
        if (!active || requestSeqRef.current !== seq) return;
        setExtractError(err instanceof Error ? err.message : 'Extraction failed.');
      })
      .finally(() => {
        if (active && requestSeqRef.current === seq) {
          setIsExtracting(false);
        }
      });

    return () => {
      active = false;
    };
  }, [preloadRequest]);

  const handleFilePicked = (file: File) => {
    setSelectedFile(file);
    void runExtraction(file, schemeMode);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFilePicked(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFilePicked(file);
    }
  };

  const handleModeChange = (nextMode: SchemeMode) => {
    setSchemeMode(nextMode);
    if (selectedFile) {
      void runExtraction(selectedFile, nextMode);
    }
  };

  const selectedCandidate: ExtractionCandidate | null = extractResult
    ? (extractResult.candidates.find(
        (c) => c.scheme === extractResult.selected_scheme && c.valid,
      ) ??
      extractResult.candidates.find((c) => c.valid) ??
      null)
    : null;

  const recoveredText = selectedCandidate?.message ?? '';

  const handleCopy = async () => {
    if (!recoveredText) return;
    try {
      await navigator.clipboard.writeText(recoveredText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be unavailable in non-HTTPS contexts.
    }
  };

  const candidateMap = new Map<SchemeName, ExtractionCandidate>(
    (extractResult?.candidates ?? []).map((c) => [c.scheme, c]),
  );

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-slate-300 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 items-center rounded border border-slate-300 bg-slate-100 px-1.5 font-mono text-[11px] font-semibold text-slate-700">
                BLIND EXTRACTOR
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Reverse / Blind Stego PNG Extraction
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Upload any lossless stego PNG without a cover image. Auto-detect probes Schemes 1, 2,
              and 3 using 32-bit length-header + strict UTF-8 validation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-600">Mode:</span>
            <button
              type="button"
              onClick={() => handleModeChange('auto')}
              className={`rounded border px-2.5 py-1 text-xs font-medium ${
                schemeMode === 'auto'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Auto-Detect (All 3 Schemes)
            </button>
            {ALL_SCHEMES.map((scheme) => (
              <button
                key={scheme}
                type="button"
                onClick={() => handleModeChange(scheme)}
                className={`rounded border px-2.5 py-1 text-xs font-medium ${
                  schemeMode === scheme
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {SCHEME_META[scheme].shortLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`md:col-span-2 flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed p-6 text-center transition-colors ${
              isDragging
                ? 'border-slate-900 bg-slate-100'
                : 'border-slate-300 bg-slate-50 hover:border-slate-500'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,image/png"
              onChange={handleInputChange}
              className="hidden"
            />
            <Upload className="h-6 w-6 text-slate-600" />
            <p className="mt-2 text-xs font-semibold text-slate-800">
              Drop a stego PNG here, or click to browse
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              Accepts lossless .png files (24-bit RGB). JPEG/re-compressed files are rejected.
            </p>
          </div>

          <div className="flex flex-col justify-between rounded border border-slate-200 bg-slate-50 p-3">
            {selectedFile ? (
              <>
                <div className="flex items-start gap-2.5">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={selectedFile.name}
                      className="h-16 w-16 shrink-0 rounded border border-slate-300 bg-white object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-slate-300 bg-white">
                      <FileImage className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Loaded PNG
                    </div>
                    <div className="truncate font-mono text-xs font-semibold text-slate-900">
                      {selectedFile.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-600">
                      {formatBytes(selectedFile.size)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runExtraction(selectedFile, schemeMode)}
                  disabled={isExtracting}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <ScanSearch className="h-3.5 w-3.5" />
                      <span>Re-run Extraction</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center py-4 text-center text-xs text-slate-500">
                <FileImage className="h-5 w-5 text-slate-400" />
                <span className="mt-1.5">No PNG loaded yet</span>
                <span className="mt-0.5 text-[11px]">
                  Or click &ldquo;Test in Extractor →&rdquo; from Tab 1
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isExtracting && (
        <div className="rounded-md border border-slate-300 bg-white p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Running blind extraction ({schemeMode === 'auto' ? 'probing Schemes 1, 2, 3' : SCHEME_META[schemeMode].shortLabel})...
            </span>
          </div>
        </div>
      )}

      {!isExtracting && extractError && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-xs text-rose-900">
          <div className="flex items-center gap-2 font-semibold">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Extraction Failed</span>
          </div>
          <p className="mt-1 font-mono">{extractError}</p>
        </div>
      )}

      {!isExtracting && extractResult && (
        <div className="space-y-4 rounded-md border border-slate-300 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {extractResult.selected_scheme ? (
                <span className="inline-flex items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Detected: {SCHEME_META[extractResult.selected_scheme].fullName}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  No Single Scheme Selected
                </span>
              )}

              {extractResult.auto_detected && (
                <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700">
                  auto_detected
                </span>
              )}

              {extractResult.ambiguous && (
                <span className="rounded border border-amber-300 bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
                  ambiguous (multiple valid candidates)
                </span>
              )}
            </div>

            {selectedCandidate && (
              <div className="font-mono text-xs text-slate-700">
                Recovered:{' '}
                <strong>
                  {selectedCandidate.extracted_bytes !== null
                    ? formatBytes(selectedCandidate.extracted_bytes)
                    : '—'}
                </strong>
                {selectedCandidate.extracted_bits !== null && (
                  <span className="text-slate-500">
                    {' '}
                    ({selectedCandidate.extracted_bits.toLocaleString()} bits)
                  </span>
                )}
              </div>
            )}
          </div>

          {selectedCandidate && (
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="extracted-message-output"
                  className="text-xs font-semibold text-slate-800"
                >
                  Recovered UTF-8 Secret Message
                </label>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-700" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                id="extracted-message-output"
                readOnly
                rows={6}
                value={recoveredText}
                className="mt-1.5 w-full rounded border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 focus:outline-none"
              />
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Candidate Probe Breakdown
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
              {ALL_SCHEMES.map((scheme) => {
                const candidate = candidateMap.get(scheme);
                const meta = SCHEME_META[scheme];
                const isWinner = extractResult.selected_scheme === scheme;

                return (
                  <div
                    key={scheme}
                    className={`rounded border p-3 text-xs ${
                      isWinner
                        ? 'border-emerald-400 bg-emerald-50/40'
                        : candidate?.valid
                          ? 'border-slate-300 bg-white'
                          : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{meta.shortLabel}</span>
                      {!candidate ? (
                        <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                          NOT TESTED
                        </span>
                      ) : candidate.valid ? (
                        <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                          VALID
                        </span>
                      ) : (
                        <span className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-800">
                          INVALID
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{meta.fullName}</div>

                    {!candidate ? (
                      <p className="mt-2 text-[11px] text-slate-500">
                        Skipped (manual {SCHEME_META[schemeMode as SchemeName]?.shortLabel ?? ''} mode).
                      </p>
                    ) : candidate.valid ? (
                      <div className="mt-2 space-y-1 font-mono text-[11px] text-slate-700">
                        <div>
                          Bytes: <strong>{candidate.extracted_bytes ?? 0}</strong> · Bits:{' '}
                          <strong>{candidate.extracted_bits ?? 0}</strong>
                        </div>
                        <div className="truncate rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600">
                          {candidate.message ?? ''}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 font-mono text-[11px] text-rose-800">
                        {candidate.reason ?? 'Header or UTF-8 validation failed.'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
