export interface HealthResponse {
  status: string;
  phase: string;
  branch: string;
}

export interface SampleCapacity {
  scheme1_bytes: number;
  scheme2_bytes: number;
  scheme3_bytes: number;
}

export interface SampleItem {
  id: string;
  motif: string;
  filename: string;
  image_url: string;
  featured: boolean;
  capacity: SampleCapacity;
}

export interface EmbedRequest {
  image_id: string;
  message_text: string;
}

export interface SchemeMetrics {
  psnr_total: number;
  psnr_r: number;
  psnr_g: number;
  psnr_b: number;
  ssim_rgb: number;
  ssim_y: number;
  capacity_used_bytes: number;
  capacity_max_bytes: number;
  capacity_used_pct: number;
  fobp_count: number;
  elapsed_ms: number;
}

export interface SchemeEmbedResult {
  scheme: string;
  status: string;
  error: string | null;
  stego_png_data_url: string | null;
  diff_heatmap_data_url: string | null;
  download_filename: string | null;
  metrics: SchemeMetrics | null;
}

export interface EmbedResponse {
  image_id: string;
  message_bytes: number;
  schemes: Record<string, SchemeEmbedResult>;
}

export interface SchemeExtractResult {
  scheme: string;
  is_valid_utf8: boolean;
  matched: boolean;
  extracted_text: string | null;
  extracted_bytes: number;
  error: string | null;
  elapsed_ms: number;
}

export interface ExtractResponse {
  detected_scheme: string | null;
  results: Record<string, SchemeExtractResult>;
}
