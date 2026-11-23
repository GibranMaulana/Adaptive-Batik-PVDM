"""Shared Pydantic v2 API contract models for the Adaptive Batik PVDM demo.

These schemas define the Phase 0 scaffold contract shared between the FastAPI
backend (Issue #13) and the React + TypeScript frontend (Issue #14).
"""

from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response for ``GET /api/health``."""

    status: str
    phase: str
    branch: str


class SampleCapacity(BaseModel):
    """Maximum payload capacity (in bytes) for each PVDM scheme on a cover image."""

    scheme1_bytes: int
    scheme2_bytes: int
    scheme3_bytes: int


class SampleItem(BaseModel):
    """Metadata and per-scheme capacity summary for a Batik cover sample."""

    id: str
    motif: str
    filename: str
    image_url: str
    featured: bool
    capacity: SampleCapacity


class EmbedRequest(BaseModel):
    """Request payload for ``POST /api/embed``."""

    image_id: str
    message_text: str


class SchemeMetrics(BaseModel):
    """Per-scheme imperceptibility, capacity, FOBP, and timing telemetry."""

    psnr_total: float
    psnr_r: float
    psnr_g: float
    psnr_b: float
    ssim_rgb: float
    ssim_y: float
    capacity_used_bytes: int
    capacity_max_bytes: int
    capacity_used_pct: float
    fobp_count: int
    elapsed_ms: float


class SchemeEmbedResult(BaseModel):
    """Embedding output and telemetry for a single PVDM scheme."""

    scheme: str
    status: str
    error: str | None = None
    stego_png_data_url: str | None = None
    diff_heatmap_data_url: str | None = None
    download_filename: str | None = None
    metrics: SchemeMetrics | None = None


class EmbedResponse(BaseModel):
    """Aggregated 3-scheme embedding comparison response."""

    image_id: str
    message_bytes: int
    schemes: dict[str, SchemeEmbedResult]


class SchemeExtractResult(BaseModel):
    """Blind extraction attempt result for a single PVDM scheme."""

    scheme: str
    is_valid_utf8: bool
    matched: bool
    extracted_text: str | None = None
    extracted_bytes: int = 0
    error: str | None = None
    elapsed_ms: float = 0.0


class ExtractResponse(BaseModel):
    """Aggregated blind extraction response across all three PVDM schemes."""

    detected_scheme: str | None
    results: dict[str, SchemeExtractResult]


__all__ = [
    "EmbedRequest",
    "EmbedResponse",
    "ExtractResponse",
    "HealthResponse",
    "SampleCapacity",
    "SampleItem",
    "SchemeEmbedResult",
    "SchemeExtractResult",
    "SchemeMetrics",
]
