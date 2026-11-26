import type { SchemeEmbedResult, SchemeName } from '../api/types';

const utf8Encoder = new TextEncoder();

export const SAMPLE_MESSAGE =
  'Batik Parang — Adaptive HVS-Asymmetric PVDM Secret Payload (UTF-8 verified).';

export const SCHEME_META: Record<
  SchemeName,
  { shortLabel: string; fullName: string; badge: string }
> = {
  scheme1: {
    shortLabel: 'Scheme 1',
    fullName: 'Scheme 1: Modified Pixel Indicator',
    badge: 'Baseline MPI',
  },
  scheme2: {
    shortLabel: 'Scheme 2',
    fullName: 'Scheme 2: Symmetric 6-Level PVDM',
    badge: 'Symmetric PVDM',
  },
  scheme3: {
    shortLabel: 'Scheme 3',
    fullName: 'Scheme 3: Proposed HVS-Asymmetric PVDM',
    badge: 'Proposed HVS',
  },
};

export const ALL_SCHEMES: SchemeName[] = ['scheme1', 'scheme2', 'scheme3'];

export function utf8ByteLength(text: string): number {
  return utf8Encoder.encode(text).length;
}

/**
 * Generate deterministic UTF-8 text whose encoded byte length equals `targetBytes`.
 */
export function generateDeterministicPayload(targetBytes: number): string {
  if (targetBytes <= 0) {
    return '';
  }

  const lineChunk =
    'BATIK-PVDM-PAYLOAD|MOTIF:PARANG-KAWUNG-MEGAMENDUNG|HVS-RGB-VERIFICATION|0123456789ABCDEF\n';
  const chunkLen = lineChunk.length; // Pure ASCII, 1 char === 1 UTF-8 byte
  const repeats = Math.floor(targetBytes / chunkLen);
  const remainder = targetBytes % chunkLen;

  let result = lineChunk.repeat(repeats);
  if (remainder > 0) {
    result += lineChunk.slice(0, remainder);
  }
  return result;
}

export function formatBytes(bytes: number): string {
  return `${bytes.toLocaleString()} B`;
}

export function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function formatMetric(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  if (!Number.isFinite(value)) {
    return '∞';
  }
  return value.toFixed(digits);
}

export function getPsnrTotal(
  psnr: Record<string, number | null> | null | undefined,
): number | null {
  if (!psnr) return null;
  const raw = psnr.psnr_total !== undefined ? psnr.psnr_total : psnr.psnr_rgb;
  if (typeof raw === 'number') return raw;
  if (
    (raw === null || raw === undefined) &&
    (psnr.mse_total === 0 || psnr.mse_rgb === 0)
  ) {
    return Infinity;
  }
  return null;
}

export function getPsnrChannel(
  psnr: Record<string, number | null> | null | undefined,
  channel: 'r' | 'g' | 'b',
): number | null {
  if (!psnr) return null;
  const raw = psnr[`psnr_${channel}`];
  if (typeof raw === 'number') return raw;
  if ((raw === null || raw === undefined) && psnr[`mse_${channel}`] === 0) {
    return Infinity;
  }
  return null;
}

export function getFobpCount(embedStats: Record<string, unknown> | null | undefined): number | null {
  if (!embedStats) return null;
  if (typeof embedStats.fobp_count === 'number') return embedStats.fobp_count;
  if (typeof embedStats.fobp_total === 'number') return embedStats.fobp_total;

  const perChannel = getFobpPerChannel(embedStats);
  if (perChannel) {
    return Object.values(perChannel).reduce((sum, val) => sum + val, 0);
  }
  return null;
}

export function getFobpPerChannel(
  embedStats: Record<string, unknown> | null | undefined,
): Record<string, number> | null {
  if (!embedStats || !embedStats.fobp_per_channel) return null;
  const raw = embedStats.fobp_per_channel;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number') {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function getStegoFilename(motif: string, result: SchemeEmbedResult): string {
  return `${motif}_${result.scheme}_stego.png`;
}
