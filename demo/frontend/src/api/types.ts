export type MotifName = 'parang' | 'kawung' | 'megamendung';

export type SchemeName = 'scheme1' | 'scheme2' | 'scheme3';

export type EmbedStatus = 'ok' | 'overflow' | 'failed';

export interface HealthResponse {
  status: string;
  phase: string;
  branch: string;
}

export interface CapacitySummary {
  capacity_bits: number;
  capacity_bytes: number;
  max_payload_bytes: number;
  bpp: number;
  per_channel_bits: Record<string, number> | null;
}

export interface SampleSummary {
  motif: MotifName;
  filename: string;
  width: number;
  height: number;
  featured: boolean;
  image_url: string;
  capacities: Record<SchemeName, CapacitySummary>;
}

export interface SampleCatalogResponse {
  count: number;
  samples: SampleSummary[];
}

export interface EmbedRequest {
  motif: string;
  filename: string;
  message: string;
}

export interface SchemeEmbedResult {
  scheme: SchemeName;
  status: EmbedStatus;
  error: string | null;
  elapsed_ms: number | null;
  capacity: CapacitySummary | null;
  embed_stats: Record<string, unknown> | null;
  psnr: Record<string, number | null> | null;
  ssim: Record<string, number | null> | null;
  stego_png_base64: string | null;
  heatmap_png_base64: string | null;
  calculation_trace: CalculationTrace | null;
}

export interface CalculationStep {
  row: number;
  columns: [number, number];
  channel: 'R' | 'G' | 'B';
  before: [number, number];
  after: [number, number];
  rgb_before?: [[number, number, number], [number, number, number]];
  rgb_after?: [[number, number, number], [number, number, number]];
  difference_before: number;
  difference_after: number;
  range: [number, number];
  bits: number;
  payload_bits: string;
  payload_value: number;
  frem_before: number;
  frem_after: number;
  indicator?: number;
  fobp_triggered?: boolean;
}

export interface RowTraceEntry {
  row: number;
  pairs_processed: number;
  bits_embedded: number;
  cumulative_bits: number;
  total_payload_bits: number;
  avg_diff: number;
  fobp_count: number;
  channels: Array<'R' | 'G' | 'B'>;
  sample_steps: CalculationStep[];
}

export interface SchemeAnalysis {
  width: number;
  height: number;
  payload_bytes: number;
  required_bits: number;
  capacity: CapacitySummary;
}

export type EmbedStreamEvent =
  | {
      type: 'scheme_start';
      scheme: SchemeName;
      width: number;
      height: number;
      payload_bytes: number;
      required_bits: number;
      capacity: CapacitySummary;
    }
  | {
      type: 'scheme_row';
      scheme: SchemeName;
      row_index: number;
      total_rows: number;
      row: RowTraceEntry;
    }
  | {
      type: 'scheme_result';
      scheme: SchemeName;
      result: SchemeEmbedResult;
    }
  | {
      type: 'done';
      motif: string;
      filename: string;
      payload_bytes: number;
    };

export type LiveSchemeStatus = 'processing' | 'completed' | 'overflow' | 'failed';

export interface SchemeLiveState {
  scheme: SchemeName;
  status: LiveSchemeStatus;
  analysis: SchemeAnalysis | null;
  rows: RowTraceEntry[];
  totalRows: number;
  result: SchemeEmbedResult | null;
  pendingStegoBase64: string | null;
  errorMessage: string | null;
}

export interface CalculationTrace {
  kind: 'observed_engine_output';
  payload_bits: number;
  displayed_steps: number;
  steps: CalculationStep[];
}

export interface EmbedResponse {
  motif: string;
  filename: string;
  payload_bytes: number;
  results: SchemeEmbedResult[];
}

export interface ExtractionCandidate {
  scheme: SchemeName;
  valid: boolean;
  reason: string | null;
  message: string | null;
  extracted_bytes: number | null;
  extracted_bits: number | null;
}

export interface ExtractResponse {
  selected_scheme: SchemeName | null;
  auto_detected: boolean;
  ambiguous: boolean;
  candidates: ExtractionCandidate[];
}
