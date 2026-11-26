import type {
  EmbedRequest,
  EmbedResponse,
  ExtractResponse,
  HealthResponse,
  SampleCatalogResponse,
  SchemeName,
} from './types';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === 'string' && data.detail.trim().length > 0) {
      return data.detail;
    }
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item) => {
          if (item && typeof item === 'object' && 'msg' in item) {
            return String((item as { msg: unknown }).msg);
          }
          return JSON.stringify(item);
        })
        .join('; ');
    }
  } catch {
    // Ignore JSON parse failure and fall back to status text.
  }
  return `Request failed with HTTP ${response.status}${response.statusText ? ` (${response.statusText})` : ''}`;
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>('/api/health');
}

export async function fetchSamples(): Promise<SampleCatalogResponse> {
  return requestJson<SampleCatalogResponse>('/api/samples');
}

export async function embedPayload(payload: EmbedRequest): Promise<EmbedResponse> {
  return requestJson<EmbedResponse>('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function extractStego(
  file: File,
  scheme?: SchemeName | null,
): Promise<ExtractResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (scheme) {
    formData.append('scheme', scheme);
  }
  return requestJson<ExtractResponse>('/api/extract', {
    method: 'POST',
    body: formData,
  });
}

export function base64ToPngDataUrl(base64: string): string {
  return `data:image/png;base64,${base64}`;
}

export function base64PngToBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'image/png' });
}

export function base64PngToFile(base64: string, filename: string): File {
  const blob = base64PngToBlob(base64);
  return new File([blob], filename, { type: 'image/png' });
}

export function downloadBase64Png(base64: string, filename: string): void {
  const blob = base64PngToBlob(base64);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
