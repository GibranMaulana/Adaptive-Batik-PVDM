"""
test_schemes.py
===============
Integration tests for Scheme 1 (Modified Pixel Indicator) and
Scheme 2 (Symmetric RGB PVDM) on real 512×512 Batik cover images.

Critical acceptance criteria for Phase 1:
    BER (Bit Error Rate) = 0%  — extracted payload must be bit-perfect.

Test groups
-----------
1. Smoke tests    — single image, tiny payload (synthetic 1×1 and 4×4)
2. Scheme 1 BER   — real Batik image, various payload sizes
3. Scheme 2 BER   — real Batik image, various payload sizes
4. Capacity check — extracted capacity matches expected formula
5. Stego PNG I/O  — save stego to disk, reload, re-extract (lossless PNG)
6. Cross-motif    — one image from each of Parang, Kawung, Megamendung
"""

import os
import sys
import pathlib
import tempfile
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from PIL import Image
import numpy as np

from src.pvdm_rgb_batik import (
    scheme1_embed, scheme1_extract,
    scheme2_embed, scheme2_extract,
)
from src.pvdm_core import RANGE_TABLE_RED

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

REPO_ROOT   = pathlib.Path(__file__).resolve().parent.parent
DATA_ROOT   = REPO_ROOT / "data" / "batik_512"
PARANG_DIR  = DATA_ROOT / "parang"
KAWUNG_DIR  = DATA_ROOT / "kawung"
MEGAMENDUNG_DIR = DATA_ROOT / "megamendung"


def _first_image(directory: pathlib.Path) -> pathlib.Path:
    pngs = sorted(directory.glob("*.png"))
    if not pngs:
        pytest.skip(f"No PNG images found in {directory}")
    return pngs[0]


def _make_payload(n_bytes: int) -> bytes:
    """Return deterministic pseudo-random bytes of length n_bytes."""
    rng = np.random.default_rng(seed=42)
    return bytes(rng.integers(0, 256, size=n_bytes, dtype=np.uint8))


def _ber(original: bytes, extracted: bytes) -> float:
    """Bit Error Rate between two byte sequences (0.0 means perfect)."""
    if len(original) != len(extracted):
        return 1.0
    errors = 0
    total  = len(original) * 8
    for a, b in zip(original, extracted):
        diff    = a ^ b
        errors += bin(diff).count('1')
    return errors / total if total > 0 else 0.0


def _synthetic_image(h: int = 64, w: int = 64) -> Image.Image:
    """Create a small synthetic RGB image for fast smoke tests."""
    rng  = np.random.default_rng(seed=0)
    arr  = rng.integers(0, 256, (h, w, 3), dtype=np.uint8)
    return Image.fromarray(arr, mode="RGB")


# ---------------------------------------------------------------------------
# 1. Smoke tests (synthetic small images)
# ---------------------------------------------------------------------------

class TestSmoke:
    IMG = _synthetic_image(64, 64)

    def test_scheme2_smoke_tiny_payload(self):
        payload = b"Hi"
        stego, stats = scheme2_embed(self.IMG, payload)
        recovered, _ = scheme2_extract(stego)
        assert recovered == payload
        assert _ber(payload, recovered) == 0.0

    def test_scheme1_smoke_tiny_payload(self):
        payload = b"Hi"
        stego, stats = scheme1_embed(self.IMG, payload)
        recovered, _ = scheme1_extract(stego)
        assert recovered == payload
        assert _ber(payload, recovered) == 0.0

    def test_scheme2_smoke_empty_payload(self):
        stego, _  = scheme2_embed(self.IMG, b"")
        recovered, _ = scheme2_extract(stego)
        assert recovered == b""

    def test_scheme1_smoke_empty_payload(self):
        stego, _  = scheme1_embed(self.IMG, b"")
        recovered, _ = scheme1_extract(stego)
        assert recovered == b""

    def test_scheme2_cover_not_modified_in_place(self):
        """Embedding must not alter the original cover numpy array."""
        arr   = np.array(self.IMG, dtype=np.uint8)
        orig  = arr.copy()
        scheme2_embed(arr, b"test")
        assert np.array_equal(arr, orig), "Cover image was mutated!"

    def test_scheme1_cover_not_modified_in_place(self):
        arr  = np.array(self.IMG, dtype=np.uint8)
        orig = arr.copy()
        scheme1_embed(arr, b"test")
        assert np.array_equal(arr, orig), "Cover image was mutated!"

    def test_scheme2_stego_has_same_shape(self):
        stego, _ = scheme2_embed(self.IMG, b"hello")
        arr = np.array(stego)
        assert arr.shape == (64, 64, 3)

    def test_scheme1_stego_has_same_shape(self):
        stego, _ = scheme1_embed(self.IMG, b"hello")
        arr = np.array(stego)
        assert arr.shape == (64, 64, 3)

    def test_scheme2_overflow_raises(self):
        """Payload too large for the image must raise ValueError."""
        payload = b"X" * 100_000
        with pytest.raises(ValueError, match="exceeds capacity"):
            scheme2_embed(self.IMG, payload)

    def test_scheme1_overflow_raises(self):
        payload = b"X" * 100_000
        with pytest.raises(ValueError, match="exceeds capacity"):
            scheme1_embed(self.IMG, payload)


# ---------------------------------------------------------------------------
# 2. Scheme 2 — BER=0% on real Batik images at multiple payload sizes
# ---------------------------------------------------------------------------

class TestScheme2BER:
    @pytest.fixture(scope="class")
    def parang_img(self):
        path = _first_image(PARANG_DIR)
        return Image.open(path).convert("RGB")

    @pytest.mark.parametrize("n_bytes", [10, 100, 1_000, 10_000])
    def test_ber_zero_parang(self, parang_img, n_bytes):
        payload = _make_payload(n_bytes)
        stego, stats = scheme2_embed(parang_img, payload)
        assert stats["payload_bits"] <= stats["capacity_bits"], "Over capacity!"
        recovered, _ = scheme2_extract(stego)
        assert recovered == payload, (
            f"Scheme 2 BER≠0 on Parang {n_bytes}B: "
            f"ber={_ber(payload, recovered):.6f}"
        )

    def test_capacity_reported_correctly(self, parang_img):
        """stats['capacity_bits'] must be >= payload bits for a known payload."""
        payload = _make_payload(1_000)
        _, stats = scheme2_embed(parang_img, payload)
        assert stats["capacity_bits"] > stats["payload_bits"]


# ---------------------------------------------------------------------------
# 3. Scheme 1 — BER=0% on real Batik images at multiple payload sizes
# ---------------------------------------------------------------------------

class TestScheme1BER:
    @pytest.fixture(scope="class")
    def parang_img(self):
        path = _first_image(PARANG_DIR)
        return Image.open(path).convert("RGB")

    @pytest.mark.parametrize("n_bytes", [10, 100, 500])
    def test_ber_zero_parang(self, parang_img, n_bytes):
        payload = _make_payload(n_bytes)
        stego, stats = scheme1_embed(parang_img, payload)
        assert stats["payload_bits"] <= stats["capacity_bits"]
        recovered, _ = scheme1_extract(stego)
        assert recovered == payload, (
            f"Scheme 1 BER≠0 on Parang {n_bytes}B: "
            f"ber={_ber(payload, recovered):.6f}"
        )


# ---------------------------------------------------------------------------
# 4. PNG lossless round-trip (save → reload → extract)
# ---------------------------------------------------------------------------

class TestPNGRoundTrip:
    @pytest.fixture(scope="class")
    def kawung_img(self):
        path = _first_image(KAWUNG_DIR)
        return Image.open(path).convert("RGB")

    def test_scheme2_png_save_reload(self, kawung_img):
        """Stego saved as lossless PNG must yield same extraction."""
        payload = _make_payload(500)
        stego, _ = scheme2_embed(kawung_img, payload)
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            tmp_path = f.name
        try:
            stego.save(tmp_path, format="PNG")
            reloaded = Image.open(tmp_path).convert("RGB")
            recovered, _ = scheme2_extract(reloaded)
            assert recovered == payload, "PNG save/reload broke Scheme 2 extraction!"
        finally:
            os.unlink(tmp_path)

    def test_scheme1_png_save_reload(self, kawung_img):
        payload = _make_payload(100)
        stego, _ = scheme1_embed(kawung_img, payload)
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            tmp_path = f.name
        try:
            stego.save(tmp_path, format="PNG")
            reloaded = Image.open(tmp_path).convert("RGB")
            recovered, _ = scheme1_extract(reloaded)
            assert recovered == payload, "PNG save/reload broke Scheme 1 extraction!"
        finally:
            os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# 5. Cross-motif BER=0% (Parang, Kawung, Megamendung)
# ---------------------------------------------------------------------------

class TestCrossMotif:
    PAYLOAD = _make_payload(1_000)

    @pytest.mark.parametrize("motif_dir,label", [
        (PARANG_DIR,       "Parang"),
        (KAWUNG_DIR,       "Kawung"),
        (MEGAMENDUNG_DIR,  "Megamendung"),
    ])
    def test_scheme2_ber_zero_cross_motif(self, motif_dir, label):
        path  = _first_image(motif_dir)
        cover = Image.open(path).convert("RGB")
        stego, stats = scheme2_embed(cover, self.PAYLOAD)
        recovered, _ = scheme2_extract(stego)
        assert recovered == self.PAYLOAD, (
            f"Scheme 2 BER≠0 on {label}: ber={_ber(self.PAYLOAD, recovered):.6f}"
        )

    @pytest.mark.parametrize("motif_dir,label", [
        (PARANG_DIR,       "Parang"),
        (KAWUNG_DIR,       "Kawung"),
        (MEGAMENDUNG_DIR,  "Megamendung"),
    ])
    def test_scheme1_ber_zero_cross_motif(self, motif_dir, label):
        path  = _first_image(motif_dir)
        cover = Image.open(path).convert("RGB")
        payload = _make_payload(100)  # Scheme 1 has lower capacity
        stego, stats = scheme1_embed(cover, payload)
        recovered, _ = scheme1_extract(stego)
        assert recovered == payload, (
            f"Scheme 1 BER≠0 on {label}: ber={_ber(payload, recovered):.6f}"
        )
