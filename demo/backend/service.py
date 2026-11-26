"""Service layer: dataset access, PVDM execution, image serialization, and detection."""

from __future__ import annotations

import asyncio
import base64
import concurrent.futures
import functools
import io
import json
import math
import sys
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Callable

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from demo.backend.schemas import (  # noqa: E402
    CapacitySummary,
    ExtractionCandidate,
    SampleSummary,
    SchemeEmbedResult,
)
from demo.backend.trace import build_calculation_trace, build_row_trace  # noqa: E402
from src.evaluation_metrics import compute_psnr, compute_ssim  # noqa: E402
from src.pvdm_rgb_batik import (  # noqa: E402
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


DATA_ROOT = REPO_ROOT / "data" / "batik_512"
MANIFEST_PATH = DATA_ROOT / "manifest.json"

FEATURED_SAMPLES: set[tuple[str, str]] = {
    ("parang", "parang_01.png"),
    ("kawung", "kawung_01.png"),
    ("megamendung", "megamendung_01.png"),
}

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


@functools.lru_cache(maxsize=1)
def _list_samples_cached() -> tuple[SampleSummary, ...]:
    """Compute and cache all curated cover images and their embedding capacities."""
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    samples: list[SampleSummary] = []
    for motif, details in manifest["motifs"].items():
        for sample in details["samples"]:
            filename = sample["filename"]
            image = load_sample(motif, filename)
            samples.append(
                SampleSummary(
                    motif=motif,
                    filename=filename,
                    width=image.width,
                    height=image.height,
                    featured=(motif, filename) in FEATURED_SAMPLES,
                    image_url=f"/api/samples/{motif}/{filename}",
                    capacities={
                        name: _capacity_summary(capacity_fn(image))
                        for name, (_, _, capacity_fn) in _SCHEMES.items()
                    },
                )
            )
    return tuple(samples)


def list_samples() -> list[SampleSummary]:
    """Return all curated cover images and their embedding capacities."""
    return list(_list_samples_cached())


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


def _sanitize_json(value: object) -> object:
    """Convert non-finite floats (inf/-inf/nan) to None for RFC 8259 JSON compliance."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {key: _sanitize_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_sanitize_json(item) for item in value]
    return value


def _ndjson_line(payload: dict[str, object]) -> str:
    return json.dumps(_sanitize_json(payload), allow_nan=False) + "\n"


def _scheme_capacity(name: str, cover: Image.Image) -> CapacitySummary:
    _, _, capacity_fn = _SCHEMES[name]
    return _capacity_summary(capacity_fn(cover))


def _embed_single_scheme_with_trace(
    name: str,
    cover: Image.Image,
    payload: bytes,
    capacity: CapacitySummary | None = None,
    *,
    include_row_trace: bool = False,
) -> tuple[SchemeEmbedResult, list[dict[str, object]]]:
    """Run a single PVDM scheme independently and optionally build uncapped row trace."""
    embed_fn, _, capacity_fn = _SCHEMES[name]
    resolved_capacity = (
        capacity if capacity is not None else _capacity_summary(capacity_fn(cover))
    )
    required_bits = (len(payload) + 4) * 8
    if required_bits > resolved_capacity.capacity_bits:
        return (
            SchemeEmbedResult(
                scheme=name,
                status="overflow",
                error=(
                    f"Payload + 32-bit header requires {required_bits} bits; "
                    f"{name} capacity is {resolved_capacity.capacity_bits} bits "
                    f"({resolved_capacity.max_payload_bytes} payload bytes maximum)."
                ),
                capacity=resolved_capacity,
            ),
            [],
        )

    started = time.perf_counter()
    try:
        stego, embed_stats = embed_fn(cover, payload)
        elapsed_ms = (time.perf_counter() - started) * 1000
        rows = (
            build_row_trace(name, cover, stego, payload) if include_row_trace else []
        )
        return (
            SchemeEmbedResult(
                scheme=name,
                status="ok",
                elapsed_ms=round(elapsed_ms, 3),
                capacity=resolved_capacity,
                embed_stats=embed_stats,
                psnr=compute_psnr(cover, stego),
                ssim=compute_ssim(cover, stego),
                stego_png_base64=png_base64(stego),
                heatmap_png_base64=png_base64(difference_heatmap(cover, stego)),
                calculation_trace=build_calculation_trace(name, cover, stego, payload),
            ),
            rows,
        )
    except Exception as exc:  # Each scheme reports failure independently.
        return (
            SchemeEmbedResult(
                scheme=name,
                status="failed",
                error=str(exc),
                capacity=resolved_capacity,
            ),
            [],
        )


def embed_single_scheme(
    name: str,
    cover: Image.Image,
    payload: bytes,
    capacity: CapacitySummary | None = None,
) -> SchemeEmbedResult:
    """Run a single PVDM scheme independently so overflows/failures remain isolated."""
    result, _ = _embed_single_scheme_with_trace(
        name, cover, payload, capacity, include_row_trace=False
    )
    return result


def embed_all(cover: Image.Image, payload: bytes) -> list[SchemeEmbedResult]:
    """Run all schemes concurrently while preserving [scheme1, scheme2, scheme3] order."""
    scheme_names = list(_SCHEMES)
    cover_copies = {name: cover.copy() for name in scheme_names}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            name: executor.submit(embed_single_scheme, name, cover_copies[name], payload)
            for name in scheme_names
        }
        return [futures[name].result() for name in scheme_names]


async def embed_stream(
    cover: Image.Image,
    payload: bytes,
    motif: str,
    filename: str,
) -> AsyncIterator[str]:
    """Stream real-time NDJSON events while all 3 schemes execute concurrently."""
    scheme_names = list(_SCHEMES)
    required_bits = (len(payload) + 4) * 8
    cover_copies = {name: cover.copy() for name in scheme_names}

    capacity_list = await asyncio.gather(
        *(
            asyncio.to_thread(_scheme_capacity, name, cover_copies[name])
            for name in scheme_names
        )
    )
    capacities = dict(zip(scheme_names, capacity_list))

    queue: asyncio.Queue[dict[str, object] | None] = asyncio.Queue()

    async def _run_scheme(name: str, capacity: CapacitySummary) -> None:
        try:
            try:
                result, rows = await asyncio.to_thread(
                    _embed_single_scheme_with_trace,
                    name,
                    cover_copies[name],
                    payload,
                    capacity,
                    include_row_trace=True,
                )
            except Exception as exc:
                result = SchemeEmbedResult(
                    scheme=name,
                    status="failed",
                    error=str(exc),
                    capacity=capacity,
                )
                rows = []

            if result.status == "ok" and rows:
                total_rows = len(rows)
                for row_index, row_data in enumerate(rows):
                    queue.put_nowait(
                        {
                            "type": "scheme_row",
                            "scheme": name,
                            "row_index": row_index,
                            "total_rows": total_rows,
                            "row": row_data,
                        }
                    )

            queue.put_nowait(
                {
                    "type": "scheme_result",
                    "scheme": name,
                    "result": result.model_dump(),
                }
            )
        finally:
            queue.put_nowait(None)

    tasks = [
        asyncio.create_task(_run_scheme(name, capacities[name]))
        for name in scheme_names
    ]

    try:
        for name in scheme_names:
            yield _ndjson_line(
                {
                    "type": "scheme_start",
                    "scheme": name,
                    "width": cover.width,
                    "height": cover.height,
                    "payload_bytes": len(payload),
                    "required_bits": required_bits,
                    "capacity": capacities[name].model_dump(),
                }
            )

        completed = 0
        while completed < len(tasks):
            event = await queue.get()
            if event is None:
                completed += 1
                continue
            yield _ndjson_line(event)

        await asyncio.gather(*tasks)

        yield _ndjson_line(
            {
                "type": "done",
                "motif": motif,
                "filename": filename,
                "payload_bytes": len(payload),
            }
        )
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


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


def extract_candidates(
    image: Image.Image, requested_scheme: str | None = None
) -> tuple[list[ExtractionCandidate], str | None, bool]:
    """Try all schemes, accepting only a coherent length header and strict UTF-8 payload."""
    names = [requested_scheme] if requested_scheme else list(_SCHEMES)
    candidates = [_extract_candidate(name, image) for name in names]
    valid = [candidate for candidate in candidates if candidate.valid]

    if requested_scheme:
        return candidates, requested_scheme if valid else None, False
    if len(valid) == 1:
        return candidates, valid[0].scheme, False
    return candidates, None, len(valid) > 1
