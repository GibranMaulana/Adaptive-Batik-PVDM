"""Request and response schemas for the demo API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SchemeName = Literal["scheme1", "scheme2", "scheme3"]
EmbedStatus = Literal["ok", "overflow", "failed"]


class CapacitySummary(BaseModel):
    capacity_bits: int
    capacity_bytes: int
    max_payload_bytes: int
    bpp: float
    per_channel_bits: dict[str, int] | None = None


class SampleSummary(BaseModel):
    motif: str
    filename: str
    width: int
    height: int
    capacities: dict[SchemeName, CapacitySummary]


class SampleCatalogResponse(BaseModel):
    count: int
    samples: list[SampleSummary]


class EmbedRequest(BaseModel):
    motif: str = Field(min_length=1)
    filename: str = Field(min_length=1)
    message: str


class SchemeEmbedResult(BaseModel):
    scheme: SchemeName
    status: EmbedStatus
    error: str | None = None
    elapsed_ms: float | None = None
    capacity: CapacitySummary | None = None
    embed_stats: dict[str, object] | None = None
    psnr: dict[str, float] | None = None
    ssim: dict[str, float] | None = None
    stego_png_base64: str | None = None
    heatmap_png_base64: str | None = None


class EmbedResponse(BaseModel):
    motif: str
    filename: str
    payload_bytes: int
    results: list[SchemeEmbedResult]


class ExtractionCandidate(BaseModel):
    scheme: SchemeName
    valid: bool
    reason: str | None = None
    message: str | None = None
    extracted_bytes: int | None = None
    extracted_bits: int | None = None


class ExtractResponse(BaseModel):
    selected_scheme: SchemeName | None = None
    auto_detected: bool
    ambiguous: bool = False
    candidates: list[ExtractionCandidate]
