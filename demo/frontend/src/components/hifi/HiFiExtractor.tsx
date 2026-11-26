import { useCallback, useEffect, useRef, useState } from 'react';
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
import { extractStego } from '../../api/client';
import type { ExtractResponse, ExtractionCandidate, SchemeName } from '../../api/types';
import { ALL_SCHEMES, SCHEME_META, formatBytes } from '../../utils/payload';

export interface HiFiPreloadExtract {
  file: File;
  requestId: number;
}

interface HiFiExtractorProps {
  preloadRequest: HiFiPreloadExtract | null;
}

type SchemeMode = 'auto' | SchemeName;

export function HiFiExtractor({ preloadRequest }: HiFiExtractorProps) {
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
  const [previewState, setPreviewState] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    if (!selectedFile) return;
    let active = true;
    const objectUrl = URL.createObjectURL(selectedFile);
    queueMicrotask(() => {
      if (active) {
        setPreviewState({ file: selectedFile, url: objectUrl });
      }
    });
    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const previewUrl =
    selectedFile && previewState?.file === selectedFile ? previewState.url : null;

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
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="rounded-2xl border border-[#E4DFD3] bg-[#FDFCF9] p-5 shadow-[0_18px_50px_-32px_rgba(17,17,16,0.22)] sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E4DFD3] pb-5">
          <div>
            <div className="font-mono-tabular text-[10px] uppercase tracking-[0.18em] text-[#9A6B2F]">
              Blind Recovery · Cover-Free Stego Decode
            </div>
            <h1 className="font-editorial mt-1 text-3xl tracking-tight text-[#111110] sm:text-4xl">
              Extract Secret Payload
            </h1>
            <p className="mt-1 text-xs text-[#6B665C]">
              Drop any lossless stego PNG to auto-detect Schemes 1–3 via 32-bit length header &amp;
              strict UTF-8 verification.
            </p>
          </div>

          <div
            className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[#E4DFD3] bg-[#F6F4EF] p-1"
            role="group"
            aria-label="Extraction scheme mode"
          >
            <button
              type="button"
              onClick={() => handleModeChange('auto')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                schemeMode === 'auto'
                  ? 'bg-[#111110] text-[#FDFCF9]'
                  : 'text-[#6B665C] hover:text-[#111110]'
              }`}
            >
              Auto-Detect
            </button>
            {ALL_SCHEMES.map((scheme) => (
              <button
                key={scheme}
                type="button"
                onClick={() => handleModeChange(scheme)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  schemeMode === scheme
                    ? 'bg-[#111110] text-[#FDFCF9]'
                    : 'text-[#6B665C] hover:text-[#111110]'
                }`}
              >
                {SCHEME_META[scheme].shortLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
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
            className={`md:col-span-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors ${
              isDragging
                ? 'border-[#9A6B2F] bg-[#9A6B2F]/[0.06]'
                : 'border-[#D5CEBE] bg-[#F6F4EF]/70 hover:border-[#9A6B2F]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,image/png"
              onChange={handleInputChange}
              className="hidden"
            />
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E4DFD3] bg-[#FDFCF9] text-[#9A6B2F]">
              <Upload className="h-4 w-4" />
            </div>
            <p className="mt-3 text-sm font-medium text-[#111110]">
              Drop a lossless stego PNG here, or click to browse
            </p>
            <p className="mt-1 font-mono-tabular text-[11px] text-[#6B665C]">
              24-bit RGB PNG required · JPEG / re-compressed files are rejected
            </p>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-[#E4DFD3] bg-[#F6F4EF]/75 p-4">
            {selectedFile ? (
              <>
                <div className="flex items-start gap-3">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={selectedFile.name}
                      className="h-16 w-16 shrink-0 rounded-lg border border-[#E4DFD3] bg-[#FDFCF9] object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[#E4DFD3] bg-[#FDFCF9]">
                      <FileImage className="h-5 w-5 text-[#6B665C]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-mono-tabular text-[10px] uppercase tracking-wider text-[#6B665C]">
                      Loaded Specimen
                    </div>
                    <div className="mt-0.5 truncate font-mono-tabular text-xs font-medium text-[#111110]">
                      {selectedFile.name}
                    </div>
                    <div className="mt-0.5 font-mono-tabular text-[11px] text-[#6B665C]">
                      {formatBytes(selectedFile.size)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void runExtraction(selectedFile, schemeMode)}
                  disabled={isExtracting}
                  className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#111110] px-3 py-2 text-xs font-medium text-[#FDFCF9] transition-colors hover:bg-[#2A2926] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Extracting…</span>
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
              <div className="flex h-full flex-col items-center justify-center py-4 text-center text-xs text-[#6B665C]">
                <FileImage className="h-5 w-5 text-[#9A6B2F]/70" />
                <span className="mt-2 font-medium text-[#111110]">No PNG loaded</span>
                <span className="mt-0.5 text-[11px]">
                  Upload a file or use &ldquo;Extract →&rdquo; after embedding.
                </span>
              </div>
            )}
          </div>
        </div>

        {isExtracting && (
          <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-[#E4DFD3] bg-[#F6F4EF] px-4 py-4 text-xs text-[#111110]">
            <Loader2 className="h-4 w-4 animate-spin text-[#9A6B2F]" />
            <span>
              Running blind extraction (
              {schemeMode === 'auto'
                ? 'probing Schemes 1, 2, 3'
                : SCHEME_META[schemeMode].shortLabel}
              )…
            </span>
          </div>
        )}

        {!isExtracting && extractError && (
          <div className="mt-5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3.5 text-xs text-rose-900">
            <div className="flex items-center gap-2 font-semibold">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>Extraction Failed</span>
            </div>
            <p className="mt-1 font-mono-tabular">{extractError}</p>
          </div>
        )}

        {!isExtracting && extractResult && (
          <div className="mt-6 space-y-5 border-t border-[#E4DFD3] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {extractResult.selected_scheme ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#15803D]/35 bg-[#15803D]/10 px-3 py-1 text-xs font-semibold text-[#15803D]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Detected: {SCHEME_META[extractResult.selected_scheme].fullName}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B45309]/35 bg-[#B45309]/10 px-3 py-1 text-xs font-semibold text-[#B45309]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    No Valid Payload Detected
                  </span>
                )}

                {extractResult.auto_detected && (
                  <span className="rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-2.5 py-0.5 font-mono-tabular text-[11px] text-[#6B665C]">
                    auto-detected
                  </span>
                )}

                {extractResult.ambiguous && (
                  <span className="rounded-full border border-[#B45309]/35 bg-[#B45309]/10 px-2.5 py-0.5 font-mono-tabular text-[11px] text-[#B45309]">
                    ambiguous candidates
                  </span>
                )}
              </div>

              {selectedCandidate && (
                <div className="font-mono-tabular text-xs text-[#6B665C]">
                  Recovered:{' '}
                  <strong className="text-[#111110]">
                    {selectedCandidate.extracted_bytes !== null
                      ? formatBytes(selectedCandidate.extracted_bytes)
                      : '—'}
                  </strong>
                  {selectedCandidate.extracted_bits !== null && (
                    <span> ({selectedCandidate.extracted_bits.toLocaleString()} bits)</span>
                  )}
                </div>
              )}
            </div>

            {selectedCandidate && (
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="hifi-extracted-message"
                    className="text-xs font-semibold uppercase tracking-wider text-[#6B665C]"
                  >
                    Recovered UTF-8 Secret Message
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E4DFD3] bg-[#F6F4EF] px-3 py-1 text-xs font-medium text-[#111110] transition-colors hover:border-[#111110]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#15803D]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  id="hifi-extracted-message"
                  readOnly
                  rows={5}
                  value={recoveredText}
                  className="mt-2 w-full rounded-xl border border-[#E4DFD3] bg-[#F6F4EF]/75 p-3.5 font-mono-tabular text-xs leading-relaxed text-[#111110] focus:outline-none"
                />
              </div>
            )}

            <div>
              <h3 className="font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B665C]">
                Candidate Probe Breakdown
              </h3>
              <div className="mt-2.5 grid grid-cols-1 gap-3 md:grid-cols-3">
                {ALL_SCHEMES.map((scheme) => {
                  const candidate = candidateMap.get(scheme);
                  const meta = SCHEME_META[scheme];
                  const isWinner = extractResult.selected_scheme === scheme;

                  return (
                    <div
                      key={scheme}
                      className={`rounded-xl border p-3.5 text-xs ${
                        isWinner
                          ? 'border-[#15803D]/50 bg-[#15803D]/[0.04]'
                          : 'border-[#E4DFD3] bg-[#F6F4EF]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#111110]">{meta.shortLabel}</span>
                        {!candidate ? (
                          <span className="rounded-full border border-[#E4DFD3] bg-[#FDFCF9] px-2 py-0.5 font-mono-tabular text-[10px] text-[#6B665C]">
                            SKIPPED
                          </span>
                        ) : candidate.valid ? (
                          <span className="rounded-full border border-[#15803D]/35 bg-[#15803D]/10 px-2 py-0.5 font-mono-tabular text-[10px] font-semibold text-[#15803D]">
                            VALID
                          </span>
                        ) : (
                          <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 font-mono-tabular text-[10px] font-semibold text-rose-800">
                            INVALID
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#6B665C]">{meta.fullName}</div>

                      {!candidate ? (
                        <p className="mt-2 text-[11px] text-[#6B665C]">
                          Manual {SCHEME_META[schemeMode as SchemeName]?.shortLabel ?? ''} mode.
                        </p>
                      ) : candidate.valid ? (
                        <div className="mt-2 space-y-1 font-mono-tabular text-[11px] text-[#111110]">
                          <div>
                            {candidate.extracted_bytes ?? 0} B · {candidate.extracted_bits ?? 0} bits
                          </div>
                          <div className="truncate rounded border border-[#E4DFD3] bg-[#FDFCF9] px-2 py-1 text-[10px] text-[#6B665C]">
                            {candidate.message ?? ''}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 font-mono-tabular text-[11px] text-rose-800">
                          {candidate.reason ?? 'Header or UTF-8 check failed.'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
