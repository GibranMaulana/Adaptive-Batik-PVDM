"""Phase 2 acceptance: blind extraction, HVS boundaries, and capacity limits."""
import io

import numpy as np
import pytest
from PIL import Image

from src.pvdm_core import (
    RANGE_TABLE_RED, RANGE_TABLE_GREEN_HVS, RANGE_TABLE_BLUE_HVS, find_range,
)
from src.pvdm_rgb_batik import (
    _safe_embed, scheme2_embed, scheme3_capacity, scheme3_embed, scheme3_extract,
)


@pytest.mark.parametrize('table', [RANGE_TABLE_RED, RANGE_TABLE_GREEN_HVS, RANGE_TABLE_BLUE_HVS])
def test_all_range_boundaries_and_remainders(table):
    # Every boundary in both orientations, at dark and bright endpoints.
    for entry in table:
        for d in {entry.low, entry.high}:
            for px, py in {(0, d), (d, 0), (255, 255-d), (255-d, 255)}:
                for b in range(2 ** entry.bits):
                    nx, ny, _ = _safe_embed(px, py, b, entry, [0])
                    assert 0 <= nx <= 255 and 0 <= ny <= 255
                    assert find_range(abs(nx-ny), table) == entry
                    assert (nx + ny) % (2 ** entry.bits) == b


@pytest.mark.parametrize('shape', [(16, 16, 3), (17, 19, 3)])
@pytest.mark.parametrize('value', [0, 128, 255, None])
def test_full_capacity_and_png_roundtrip(shape, value):
    rng = np.random.default_rng(42)
    cover = (rng.integers(0, 256, shape, dtype=np.uint8) if value is None
             else np.full(shape, value, dtype=np.uint8))
    original = cover.copy()
    capacity = scheme3_capacity(cover)
    payload = rng.bytes(capacity['max_payload_bytes'])
    stego, stats = scheme3_embed(cover, payload)
    assert stats['capacity_bits'] == capacity['capacity_bits']
    assert sum(stats['capacity_bits_by_channel'].values()) == stats['capacity_bits']
    assert stats['payload_bits'] == 32 + 8 * len(payload)
    assert np.array_equal(cover, original)
    if shape[1] % 2:
        np.testing.assert_array_equal(np.asarray(stego)[:, -1], cover[:, -1])
    stream = io.BytesIO()
    stego.save(stream, format='PNG')
    stream.seek(0)
    with Image.open(stream) as reloaded:
        recovered, extraction = scheme3_extract(reloaded)
    assert recovered == payload
    assert extraction['extracted_bits'] == stats['payload_bits']
    with pytest.raises(ValueError, match='exceeds capacity'):
        scheme3_embed(cover, payload + b'x')


@pytest.mark.parametrize('payload', [b'', b'a', b'\x00\xff\x80', bytes(range(256))])
def test_partial_payload(payload):
    cover = np.random.default_rng(7).integers(0, 256, (32, 33, 3), dtype=np.uint8)
    stego, _ = scheme3_embed(cover, payload)
    assert scheme3_extract(stego)[0] == payload


def test_hvs_capacity_has_no_indicator_reservation():
    cover = np.full((16, 16, 3), 128, dtype=np.uint8)
    stats = scheme3_capacity(cover)
    # Each spatial pair carries R=3, G=2, B=4 bits even when R LSB=00.
    assert stats['capacity_bits_by_channel'] == {'R': 384, 'G': 256, 'B': 512}
    assert stats['capacity_bits'] == 1152
    assert stats['max_payload_bytes'] == 140


def test_green_quality_on_smooth_cover():
    cover = np.full((64, 64, 3), 128, dtype=np.uint8)
    payload = np.random.default_rng(42).bytes(1024)
    sym, _ = scheme2_embed(cover, payload)
    hvs, _ = scheme3_embed(cover, payload)
    mse_sym = np.mean((np.asarray(sym)[:, :, 1].astype(float) - 128) ** 2)
    mse_hvs = np.mean((np.asarray(hvs)[:, :, 1].astype(float) - 128) ** 2)
    assert mse_hvs < mse_sym


def test_cover_too_small_for_header():
    with pytest.raises(ValueError, match='exceeds capacity'):
        scheme3_embed(np.zeros((1, 2, 3), dtype=np.uint8), b'')
    with pytest.raises(ValueError):
        scheme3_extract(np.zeros((1, 2, 3), dtype=np.uint8))
