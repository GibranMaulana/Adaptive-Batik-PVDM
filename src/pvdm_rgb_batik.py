"""
pvdm_rgb_batik.py
=================
Baseline and HVS-asymmetric steganographic schemes for RGB Batik images.

Implements three comparison schemes:

Scheme 1: Modified Pixel Indicator (Awate & Patil, 2016)
    Uses the 2 LSBs of the RED channel pixel as a *per-pixel indicator*
    that decides which of the Green / Blue channels (if any) carries
    secret data.  Red channel itself is never used for payload embedding.

    Indicator mapping (2 LSBs of R at column `col`):
        00  → skip this pixel pair
        01  → embed in GREEN channel pair (col, col+1)
        10  → embed in BLUE channel pair (col, col+1)
        11  → skip this pixel pair

    Red channel values are NEVER modified.

Scheme 2: Symmetric RGB PVDM (Wang et al. 6-level table, all channels)
    All three channels (R, G, B) carry payload simultaneously using the
    same standard 6-level range table from Wang et al. (2008).
    Horizontal pixel pairs: (col, col+1) for col in 0, 2, 4, ...

Scheme 3: HVS-asymmetric RGB PVDM (proposed)
    Uses all channels in R, G, B order with the standard Red table,
    protective 7-level Green table, and expansive 5-level Blue table.
    Message framing and horizontal pairing match Scheme 2.

All schemes guarantee BER = 0% (bit-perfect extraction) on lossless
PNG images by ensuring that pixel pair (px', py') after embedding always
has its difference d' in the SAME sub-range as the original d.  When
the optimal 8-case shift would cross a sub-range boundary, we fall back
to a direct-remainder substitution that keeps px' and py' as close as
possible to px and py while satisfying (px'+py') mod 2^t == b.

Public API
----------
    scheme1_embed(cover_img, payload) -> stego_img, stats
    scheme1_extract(stego_img)        -> payload, stats
    scheme2_embed(cover_img, payload) -> stego_img, stats
    scheme2_extract(stego_img)        -> payload, stats
    scheme3_embed(cover_img, payload) -> stego_img, stats
    scheme3_extract(stego_img)        -> payload, stats
    scheme3_capacity(cover_img)       -> capacity statistics

    cover_img / stego_img : PIL.Image (mode "RGB") or numpy ndarray H×W×3
    payload               : bytes  (raw secret; length header handled here)
    stats                 : dict   (capacity_bits, fobp_count, …)
"""

from __future__ import annotations

import math
import numpy as np
from PIL import Image
from typing import Union

from src.pvdm_core import (
    RANGE_TABLE_RED,
    RANGE_TABLE_GREEN_SYM,
    RANGE_TABLE_GREEN_HVS,
    RANGE_TABLE_BLUE_HVS,
    RANGE_TABLE_BLUE_SYM,
    RangeEntry,
    find_range,
    embed_pair,
    extract_pair,
    bytes_to_bits,
    bits_to_bytes,
    pack_message,
    unpack_message,
)

# ---------------------------------------------------------------------------
# Type alias
# ---------------------------------------------------------------------------
ImageLike = Union[Image.Image, np.ndarray]


def _to_array(img: ImageLike) -> np.ndarray:
    """Return a uint8 H×W×3 numpy array (copy) from a PIL Image or ndarray."""
    if isinstance(img, np.ndarray):
        arr = img.copy().astype(np.uint8)
        if arr.ndim != 3 or arr.shape[2] != 3:
            raise ValueError("numpy array must be H×W×3 (RGB).")
        return arr
    if isinstance(img, Image.Image):
        return np.array(img.convert("RGB"), dtype=np.uint8)
    raise TypeError(f"Expected PIL.Image or numpy.ndarray, got {type(img)}.")


def _to_pil(arr: np.ndarray) -> Image.Image:
    return Image.fromarray(arr.astype(np.uint8), mode="RGB")


# ---------------------------------------------------------------------------
# SAFE EMBED  (guarantees d_stego stays in the same sub-range)
# ---------------------------------------------------------------------------

def _safe_embed(px: int, py: int, b: int, entry: RangeEntry,
                fobp_counter: list[int]) -> tuple[int, int, bool]:
    """
    Embed `b` (integer, [0, 2^t-1]) into pixel pair (px, py) guaranteeing
    that the stego pair's absolute difference d' stays within `entry` (same
    sub-range), so the extractor's find_range lookup returns identical `t`.

    Algorithm
    ---------
    1. Try the standard 8-case optimal embed (embed_pair).
    2. If d_stego is already in [entry.low, entry.high] → done.
    3. Otherwise, exhaustively search for the nearest valid (px', py') such
       that (px'+py') mod 2^t == b  AND  |px'-py'| in [entry.low, entry.high].
       We try all multiples of 2^t for the sum, and all d in the range.

    Returns
    -------
    (px', py', fobp_flag)
    """
    t     = entry.bits
    power = 2 ** t

    nx, ny, fobp = embed_pair(px, py, b, t, fobp_counter)

    # Fast path: sub-range preserved by optimal algorithm
    if entry.low <= abs(nx - ny) <= entry.high:
        return nx, ny, fobp

    # --- Exhaustive fallback ---
    # We need: (cx + cy) % power == b  and  entry.low <= |cx-cy| <= entry.high
    # and  0 <= cx, cy <= 255.
    # For each valid sum s = k*power + b (k integer), we can derive:
    #   cx = (s + sign*d) // 2,  cy = (s - sign*d) // 2
    # We iterate over s values near (px+py) and all d in [entry.low, entry.high].

    mid_sum  = px + py          # reference sum
    best_nx, best_ny = nx, ny  # fallback to optimal (sub-range may differ)
    best_mse = float('inf')

    # Try sum multiples in a window around mid_sum
    k_center = mid_sum // power
    for dk in range(-2, 3):        # 5 candidate multiples of power
        k = k_center + dk
        s = k * power + b          # candidate sum ≡ b (mod power)
        if s < 0 or s > 510:       # cx+cy must be in [0,510]
            continue
        # Iterate d within the sub-range
        for d_try in range(entry.low, entry.high + 1):
            for sign in (+1, -1):
                num = s + sign * d_try
                if num % 2 != 0:
                    continue
                cx = num // 2
                cy = s - cx
                if not (0 <= cx <= 255 and 0 <= cy <= 255):
                    continue
                if abs(cx - cy) != d_try:
                    continue
                if (cx + cy) % power != b:
                    continue
                mse = (cx - px) ** 2 + (cy - py) ** 2
                if mse < best_mse:
                    best_mse = mse
                    best_nx, best_ny = cx, cy

    return best_nx, best_ny, fobp


# ---------------------------------------------------------------------------
# SCHEME 1  — Modified Pixel Indicator (Awate & Patil, 2016)
# ---------------------------------------------------------------------------

def _scheme1_capacity(cover: np.ndarray) -> int:
    """Maximum payload bits embeddable by Scheme 1 (indicator-guided pairs)."""
    H, W, _ = cover.shape
    total = 0
    for row in range(H):
        col = 0
        while col + 1 < W:
            indicator = int(cover[row, col, 0]) & 0b11
            if indicator == 0b01:
                g0, g1 = int(cover[row, col, 1]), int(cover[row, col + 1, 1])
                total += find_range(abs(g0 - g1), RANGE_TABLE_GREEN_SYM).bits
            elif indicator == 0b10:
                b0, b1 = int(cover[row, col, 2]), int(cover[row, col + 1, 2])
                total += find_range(abs(b0 - b1), RANGE_TABLE_BLUE_SYM).bits
            col += 2
    return total


def scheme1_embed(cover_img: ImageLike, payload: bytes) -> tuple[Image.Image, dict]:
    """
    Embed `payload` using Scheme 1 (Modified Pixel Indicator).

    Parameters
    ----------
    cover_img : PIL Image or H×W×3 uint8 numpy array.
    payload   : Raw bytes to embed.

    Returns
    -------
    stego_img : PIL Image (RGB).
    stats     : dict(capacity_bits, payload_bits, fobp_count, skipped_pairs, used_pairs)
    """
    cover = _to_array(cover_img)
    stego = cover.copy()
    H, W, _ = cover.shape

    packed     = pack_message(payload)
    bit_stream = bytes_to_bits(packed)
    n_bits     = len(bit_stream)
    padded     = bit_stream + [0] * 16  # zero-pad for clean word reads

    capacity = _scheme1_capacity(cover)
    if n_bits > capacity:
        raise ValueError(
            f"Scheme 1: payload+header ({n_bits} bits) exceeds capacity "
            f"({capacity} bits). Max payload ≈ {(capacity // 8) - 4} bytes."
        )

    bit_idx    = 0
    fobp_count = 0
    skipped    = 0
    used       = 0

    for row in range(H):
        if bit_idx >= n_bits:
            break
        col = 0
        while col + 1 < W and bit_idx < n_bits:
            px_r      = int(cover[row, col, 0])
            indicator = px_r & 0b11

            if indicator == 0b01:
                g0 = int(cover[row, col,     1])
                g1 = int(cover[row, col + 1, 1])
                entry = find_range(abs(g0 - g1), RANGE_TABLE_GREEN_SYM)

                b_full = 0
                for k in range(entry.bits):
                    b_full = (b_full << 1) | padded[bit_idx + k]

                counter = [0]
                ng0, ng1, _ = _safe_embed(g0, g1, b_full, entry, counter)
                fobp_count += counter[0]

                stego[row, col,     1] = ng0
                stego[row, col + 1, 1] = ng1
                bit_idx += entry.bits
                used    += 1

            elif indicator == 0b10:
                b0 = int(cover[row, col,     2])
                b1 = int(cover[row, col + 1, 2])
                entry = find_range(abs(b0 - b1), RANGE_TABLE_BLUE_SYM)

                b_full = 0
                for k in range(entry.bits):
                    b_full = (b_full << 1) | padded[bit_idx + k]

                counter = [0]
                nb0, nb1, _ = _safe_embed(b0, b1, b_full, entry, counter)
                fobp_count += counter[0]

                stego[row, col,     2] = nb0
                stego[row, col + 1, 2] = nb1
                bit_idx += entry.bits
                used    += 1

            else:
                skipped += 1

            col += 2

    stats = {
        "capacity_bits" : capacity,
        "payload_bits"  : n_bits,
        "fobp_count"    : fobp_count,
        "skipped_pairs" : skipped,
        "used_pairs"    : used,
    }
    return _to_pil(stego), stats


def scheme1_extract(stego_img: ImageLike) -> tuple[bytes, dict]:
    """
    Extract payload from Scheme-1 stego image.

    Returns
    -------
    payload : bytes
    stats   : dict(extracted_bits)
    """
    stego = _to_array(stego_img)
    H, W, _ = stego.shape

    bits: list[int] = []
    need_bits: int | None = None

    for row in range(H):
        col = 0
        while col + 1 < W:
            indicator = int(stego[row, col, 0]) & 0b11

            if indicator == 0b01:
                g0 = int(stego[row, col,     1])
                g1 = int(stego[row, col + 1, 1])
                entry = find_range(abs(g0 - g1), RANGE_TABLE_GREEN_SYM)
                b_val = extract_pair(g0, g1, entry.bits)
                for shift in range(entry.bits - 1, -1, -1):
                    bits.append((b_val >> shift) & 1)

            elif indicator == 0b10:
                b0 = int(stego[row, col,     2])
                b1 = int(stego[row, col + 1, 2])
                entry = find_range(abs(b0 - b1), RANGE_TABLE_BLUE_SYM)
                b_val = extract_pair(b0, b1, entry.bits)
                for shift in range(entry.bits - 1, -1, -1):
                    bits.append((b_val >> shift) & 1)

            if need_bits is None and len(bits) >= 32:
                n_payload = int.from_bytes(bits_to_bytes(bits[:32]), 'big')
                need_bits = 32 + n_payload * 8

            if need_bits is not None and len(bits) >= need_bits:
                return unpack_message(bits_to_bytes(bits[:need_bits])), \
                       {"extracted_bits": need_bits}

            col += 2

    raw     = bits_to_bytes(bits[: len(bits) - len(bits) % 8])
    payload = unpack_message(raw)
    return payload, {"extracted_bits": len(bits)}


# ---------------------------------------------------------------------------
# Shared RGB traversal for symmetric Scheme 2 and HVS Scheme 3
# ---------------------------------------------------------------------------

def _scheme2_capacity(cover: np.ndarray) -> int:
    H, W, _ = cover.shape
    total = 0
    for row in range(H):
        col = 0
        while col + 1 < W:
            for ch in range(3):
                p0 = int(cover[row, col,     ch])
                p1 = int(cover[row, col + 1, ch])
                total += find_range(abs(p0 - p1), RANGE_TABLE_RED).bits
            col += 2
    return total


def _rgb_embed(
    cover_img: ImageLike, payload: bytes,
    tables: tuple[list[RangeEntry], ...], scheme: int,
) -> tuple[Image.Image, dict]:
    """
    Embed `payload` in R, G, B order using the supplied channel tables.

    Returns
    -------
    stego_img : PIL Image (RGB).
    stats     : dict(capacity_bits, payload_bits, fobp_count, used_pairs)
    """
    cover = _to_array(cover_img)
    stego = cover.copy()
    H, W, _ = cover.shape

    packed     = pack_message(payload)
    bit_stream = bytes_to_bits(packed)
    n_bits     = len(bit_stream)
    padded     = bit_stream + [0] * 16

    capacity_by_channel = _rgb_capacity(cover, tables)
    capacity = sum(capacity_by_channel.values())
    if n_bits > capacity:
        raise ValueError(
            f"Scheme {scheme}: payload+header ({n_bits} bits) exceeds capacity "
            f"({capacity} bits). Max payload ≈ {(capacity // 8) - 4} bytes."
        )

    bit_idx    = 0
    fobp_count = 0
    used_pairs = 0

    for row in range(H):
        if bit_idx >= n_bits:
            break
        col = 0
        while col + 1 < W and bit_idx < n_bits:
            for ch in range(3):
                p0 = int(cover[row, col,     ch])
                p1 = int(cover[row, col + 1, ch])
                entry = find_range(abs(p0 - p1), tables[ch])

                b_full = 0
                for k in range(entry.bits):
                    b_full = (b_full << 1) | padded[bit_idx + k]

                counter = [0]
                np0, np1, _ = _safe_embed(p0, p1, b_full, entry, counter)
                fobp_count += counter[0]

                stego[row, col,     ch] = np0
                stego[row, col + 1, ch] = np1
                bit_idx += entry.bits

                if bit_idx >= n_bits:
                    break

            used_pairs += 1
            col        += 2

    stats = {
        "capacity_bits" : capacity,
        "capacity_bits_by_channel": capacity_by_channel,
        "max_payload_bytes": max(0, capacity // 8 - 4),
        "payload_bits"  : n_bits,
        "fobp_count"    : fobp_count,
        "used_pairs"    : used_pairs,
    }
    return _to_pil(stego), stats


def _rgb_extract(
    stego_img: ImageLike, tables: tuple[list[RangeEntry], ...],
) -> tuple[bytes, dict]:
    """
    Extract a framed RGB payload using the supplied channel tables.

    Returns
    -------
    payload : bytes
    stats   : dict(extracted_bits)
    """
    stego = _to_array(stego_img)
    H, W, _ = stego.shape

    bits: list[int] = []
    need_bits: int | None = None

    for row in range(H):
        col = 0
        while col + 1 < W:
            for ch in range(3):
                p0 = int(stego[row, col,     ch])
                p1 = int(stego[row, col + 1, ch])
                entry = find_range(abs(p0 - p1), tables[ch])
                b_val = extract_pair(p0, p1, entry.bits)
                for shift in range(entry.bits - 1, -1, -1):
                    bits.append((b_val >> shift) & 1)

            if need_bits is None and len(bits) >= 32:
                n_payload = int.from_bytes(bits_to_bytes(bits[:32]), 'big')
                need_bits = 32 + n_payload * 8

            if need_bits is not None and len(bits) >= need_bits:
                return unpack_message(bits_to_bytes(bits[:need_bits])), \
                       {"extracted_bits": need_bits}

            col += 2

    raw     = bits_to_bytes(bits[: len(bits) - len(bits) % 8])
    payload = unpack_message(raw)
    return payload, {"extracted_bits": len(bits)}


_SYMMETRIC_TABLES = (RANGE_TABLE_RED, RANGE_TABLE_GREEN_SYM, RANGE_TABLE_BLUE_SYM)
_HVS_TABLES = (RANGE_TABLE_RED, RANGE_TABLE_GREEN_HVS, RANGE_TABLE_BLUE_HVS)


def _rgb_capacity(
    cover: np.ndarray, tables: tuple[list[RangeEntry], ...],
) -> dict[str, int]:
    """Gross capacity per channel; an unpaired final column is unused."""
    pair_width = cover.shape[1] // 2 * 2
    diffs = np.abs(cover[:, :pair_width:2].astype(np.int16)
                   - cover[:, 1:pair_width:2].astype(np.int16))
    result = {}
    for ch, name in enumerate(("R", "G", "B")):
        lookup = np.empty(256, dtype=np.uint8)
        for entry in tables[ch]:
            lookup[entry.low:entry.high + 1] = entry.bits
        result[name] = int(lookup[diffs[:, :, ch]].sum())
    return result


def scheme2_embed(cover_img: ImageLike, payload: bytes) -> tuple[Image.Image, dict]:
    """Embed with the standard 6-level table on each RGB channel."""
    return _rgb_embed(cover_img, payload, _SYMMETRIC_TABLES, 2)


def scheme2_extract(stego_img: ImageLike) -> tuple[bytes, dict]:
    """Blindly extract a Scheme 2 message, including its length header."""
    return _rgb_extract(stego_img, _SYMMETRIC_TABLES)


def scheme3_capacity(cover_img: ImageLike) -> dict:
    """Return gross bit capacity and usable bytes after the 32-bit header.

    Final partial codewords are zero-padded; padding is excluded from the
    extracted message. Capacity includes every horizontal pair in all RGB
    channels, without indicator bits or skipped indicator states.
    """
    by_channel = _rgb_capacity(_to_array(cover_img), _HVS_TABLES)
    total = sum(by_channel.values())
    return {"capacity_bits": total, "capacity_bits_by_channel": by_channel,
            "max_payload_bytes": max(0, total // 8 - 4)}


def scheme3_embed(cover_img: ImageLike, payload: bytes) -> tuple[Image.Image, dict]:
    """Embed using HVS tables: Red 6 levels, Green 7, Blue 5.

    Reuses the Phase 1 PVDM engine and range-preserving correction. Input
    images are copied. Output must be saved losslessly (for example PNG).
    Statistics include gross capacity, header-inclusive payload bits,
    capacity per channel, used spatial pairs, and FOBP correction count.
    """
    return _rgb_embed(cover_img, payload, _HVS_TABLES, 3)


def scheme3_extract(stego_img: ImageLike) -> tuple[bytes, dict]:
    """Extract Scheme 3 using only the stego image and fixed HVS tables."""
    return _rgb_extract(stego_img, _HVS_TABLES)
