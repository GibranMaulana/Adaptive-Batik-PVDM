"""Service layer: dataset access, PVDM execution, image serialization, and detection."""

from __future__ import annotations

import base64
import io
import json
import time
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image

from src.evaluation_metrics import compute_psnr, compute_ssim
from src.pvdm_rgb_batik import (
    scheme1_capacity,
    scheme1_embed,
    scheme1_extract,
    scheme2_capacity,
    scheme2_embed,
    scheme2_extract,
    scheme3_capacity,
    scheme3_embed,
    scheme3_extract,
)

from demo.backend.schemas import CapacitySummary, ExtractionCandidate, SchemeEmbedResult


REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = REPO_ROOT / "data" / "batik_512"
MANIFEST_PATH = DATA_ROOT / "manifest.json"

_SCHEMES: dict[str, tuple[Callable, Callable, Callable]] = {
    "scheme1": (scheme1_embed, scheme1_extract, scheme1_capacity),
    "scheme2": (scheme2_embed, scheme2_extract, scheme2_capacity),
    "scheme3": (scheme3_embed, scheme3_extract, scheme3_capacity),
}


def _capacity_summary(capacity: dict) -> CapacitySummary:
    return CapacitySummary(
        capacity_bits=int(capacity["capacity_bits"]),
        capacity_bytes=int(capacity["capacity_bytes"]),
        max_payload_bytes=int(capacity["max_payload_bytes"]),
        bpp=float(capacity["bpp"]),
        per_channel_bits=capacity.get("per_channel_bits"),
    )


def list_samples() -> list[dict]:
    """Return all curated cover images and their embedding capacities."""
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    samples: list[dict] = []
    for motif, details in manifest["motifs"].items():
        for sample in details["samples"]:
            filename = sample["filename"]
            image = load_sample(motif, filename)
            samples.append(
                {
                    "motif": motif,
                    "filename": filename,
                    "width": image.width,
                    "height": image.height,
                    "capacities": {
                        name: _capacity_summary(capacity_fn(image))
                        for name, (_, _, capacity_fn) in _SCHEMES.items()
                    },
                }
            )
    return samples


def sample_path(motif: str, filename: str) -> Path:
    """Resolve a dataset sample while rejecting path traversal and unknown motifs."""
    if motif not in {"parang", "kawung", "megamendung"}:
        raise FileNotFoundError("Unknown motif.")
    if Path(filename).name != filename or not filename.endswith(".png"):
        raise FileNotFoundError("Invalid sample filename.")
    path = DATA_ROOT / motif / filename
    if not path.is_file():
        raise FileNotFoundError("Sample image not found.")
    return path


def load_sample(motif: str, filename: str) -> Image.Image:
    with Image.open(sample_path(motif, filename)) as image:
        return image.convert("RGB")


def png_base64(image: Image.Image) -> str:
    """Encode a lossless 24-bit RGB PNG for JSON transport."""
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def difference_heatmap(cover: Image.Image, stego: Image.Image) -> Image.Image:
    """Return |cover-stego| × 20, saturated at 255, as an RGB image."""
    cover_array = np.asarray(cover.convert("RGB"), dtype=np.int16)
    stego_array = np.asarray(stego.convert("RGB"), dtype=np.int16)
    heatmap = np.clip(np.abs(cover_array - stego_array) * 20, 0, 255).astype(np.uint8)
    return Image.fromarray(heatmap, mode="RGB")


def embed_all(cover: Image.Image, payload: bytes) -> list[SchemeEmbedResult]:
    """Run all schemes independently so one overflow never aborts the others."""
    results: list[SchemeEmbedResult] = []
    for name, (embed_fn, _, capacity_fn) in _SCHEMES.items():
        capacity = _capacity_summary(capacity_fn(cover))
        required_bits = (len(payload) + 4) * 8
        if required_bits > capacity.capacity_bits:
            results.append(
                SchemeEmbedResult(
                    scheme=name,
                    status="overflow",
                    error=(
                        f"Payload + 32-bit header requires {required_bits} bits; "
                        f"{name} capacity is {capacity.capacity_bits} bits "
                        f"({capacity.max_payload_bytes} payload bytes maximum)."
                    ),
                    capacity=capacity,
                )
            )
            continue

        started = time.perf_counter()
        try:
            stego, embed_stats = embed_fn(cover, payload)
            elapsed_ms = (time.perf_counter() - started) * 1000
            results.append(
                SchemeEmbedResult(
                    scheme=name,
                    status="ok",
                    elapsed_ms=round(elapsed_ms, 3),
                    capacity=capacity,
                    embed_stats=embed_stats,
                    psnr=compute_psnr(cover, stego),
                    ssim=compute_ssim(cover, stego),
                    stego_png_base64=png_base64(stego),
                    heatmap_png_base64=png_base64(difference_heatmap(cover, stego)),
                )
            )
        except Exception as exc:  # Each scheme reports failure independently.
            results.append(
                SchemeEmbedResult(
                    scheme=name,
                    status="failed",
                    error=str(exc),
                    capacity=capacity,
                )
            )
    return results


def load_uploaded_png(raw_png: bytes) -> Image.Image:
    """Decode and normalize an uploaded stego image to RGB, rejecting non-PNG files."""
    try:
        with Image.open(io.BytesIO(raw_png)) as image:
            if image.format != "PNG":
                raise ValueError("Only lossless PNG stego images are accepted.")
            return image.convert("RGB")
    except (OSError, ValueError) as exc:
        raise ValueError(f"Invalid PNG upload: {exc}") from exc


def _extract_candidate(name: str, image: Image.Image) -> ExtractionCandidate:
    _, extract_fn, _ = _SCHEMES[name]
    try:
        payload, stats = extract_fn(image)
        message = payload.decode("utf-8", errors="strict")
        return ExtractionCandidate(
            scheme=name,
            valid=True,
            message=message,
            extracted_bytes=len(payload),
            extracted_bits=int(stats.get("extracted_bits", 0)),
        )
    except (UnicodeDecodeError, ValueError, OverflowError) as exc:
        return ExtractionCandidate(scheme=name, valid=False, reason=str(exc))


def extract_candidates(image: Image.Image, requested_scheme: str | None = None) -> tuple[list[ExtractionCandidate], str | None, bool]:
    """Try all schemes, accepting only a coherent length header and strict UTF-8 payload."""
    names = [requested_scheme] if requested_scheme else list(_SCHEMES)
    candidates = [_extract_candidate(name, image) for name in names]
    valid = [candidate for candidate in candidates if candidate.valid]

    if requested_scheme:
        return candidates, requested_scheme if valid else None, False
    if len(valid) == 1:
        return candidates, valid[0].scheme, False
    return candidates, None, len(valid) > 1
