"""FastAPI application shell for the Adaptive Batik PVDM interactive demo.

Phase 0 scaffold: exposes ``GET /api/health`` and HTTP 501 stub endpoints for
``GET /api/samples``, ``POST /api/embed``, and ``POST /api/extract`` pending
Issue #13 (DEMO PHASE 1).
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI, HTTPException, status  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from demo.backend import service  # noqa: E402, F401
from demo.backend.schemas import (  # noqa: E402
    EmbedResponse,
    ExtractResponse,
    HealthResponse,
    SampleItem,
)

NOT_IMPLEMENTED_DETAIL = (
    "Not implemented yet — tracked in Issue #13 (DEMO PHASE 1)"
)

app = FastAPI(
    title="Adaptive Batik PVDM Demo API",
    version="0.1.0-scaffold",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def get_health() -> HealthResponse:
    """Return scaffold health status."""
    return HealthResponse(status="ok", phase="scaffold", branch="feat/demo")


@app.get("/api/samples", response_model=list[SampleItem], tags=["samples"])
def get_samples() -> list[SampleItem]:
    """Stub endpoint for Batik cover sample catalog (tracked in Issue #13)."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NOT_IMPLEMENTED_DETAIL,
    )


@app.post("/api/embed", response_model=EmbedResponse, tags=["steganography"])
def post_embed() -> EmbedResponse:
    """Stub endpoint for 3-scheme PVDM embedding (tracked in Issue #13)."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NOT_IMPLEMENTED_DETAIL,
    )


@app.post(
    "/api/extract",
    response_model=ExtractResponse,
    tags=["steganography"],
)
def post_extract() -> ExtractResponse:
    """Stub endpoint for blind stego PNG extraction (tracked in Issue #13)."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=NOT_IMPLEMENTED_DETAIL,
    )
