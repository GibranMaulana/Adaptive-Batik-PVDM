"""Service layer stub for the Adaptive Batik PVDM interactive demo backend.

Verifies Python path connectivity to the core ``src`` package and declares the
service interfaces to be implemented in Issue #13 (DEMO PHASE 1).
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import src.evaluation_metrics as evaluation_metrics  # noqa: E402, F401
import src.pvdm_core as pvdm_core  # noqa: E402, F401
import src.pvdm_rgb_batik as pvdm_rgb_batik  # noqa: E402, F401
from demo.backend.schemas import (  # noqa: E402
    EmbedResponse,
    ExtractResponse,
    SampleItem,
)

_PENDING_ISSUE_13_MSG = "Pending Issue #13 (DEMO PHASE 1)"


def list_batik_samples() -> list[SampleItem]:
    """Return available Batik cover images and their per-scheme capacities."""
    raise NotImplementedError(_PENDING_ISSUE_13_MSG)


def run_three_scheme_embed(
    image_id: str = "",
    message_text: str = "",
) -> EmbedResponse:
    """Embed a UTF-8 message across Scheme 1, Scheme 2, and Scheme 3."""
    raise NotImplementedError(_PENDING_ISSUE_13_MSG)


def run_blind_extract(
    image_bytes: bytes = b"",
    filename: str | None = None,
) -> ExtractResponse:
    """Attempt blind stego extraction across Scheme 1, Scheme 2, and Scheme 3."""
    raise NotImplementedError(_PENDING_ISSUE_13_MSG)


__all__ = [
    "REPO_ROOT",
    "evaluation_metrics",
    "list_batik_samples",
    "pvdm_core",
    "pvdm_rgb_batik",
    "run_blind_extract",
    "run_three_scheme_embed",
]
