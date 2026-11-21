"""
pvdm_rgb_batik.py
=================
RGB Batik Steganography Schemes using PVDM (Pixel-Value Differencing & Modulus
Function).

Implements all three comparison schemes specified in docs/md/pvdmbase.md:

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

Scheme 3: Asymmetric HVS-Based RGB PVDM (Proposed Method)
    All three channels (R, G, B) carry payload simultaneously using
    asymmetric range tables driven by the Human Visual System (ITU-R BT.601-7):
        - Red   channel : 6-level standard  (RANGE_TABLE_RED)
        - Green channel : 7-level protective (RANGE_TABLE_GREEN_HVS, max 2 bits in [0,7])
        - Blue  channel : 5-level expansive  (RANGE_TABLE_BLUE_HVS,  min 4 bits in [0,15])

All three schemes guarantee BER = 0% (bit-perfect extraction) on lossless
PNG images by ensuring that pixel pair (px', py') after embedding always
has its difference d' in the SAME sub-range as the original d.  When
the optimal 8-case shift would cross a sub-range boundary, we fall back
to a direct-remainder search that keeps (px', py') as close as possible
to (px, py) while satisfying (px'+py') mod 2^t == b and d' in [l_j, u_j].

Public API
----------
    scheme1_embed(cover_img, payload) -> stego_img, stats
    scheme1_extract(stego_img)        -> payload, stats
    scheme1_capacity(cover_img)       -> capacity_dict

    scheme2_embed(cover_img, payload) -> stego_img, stats
    scheme2_extract(stego_img)        -> payload, stats
    scheme2_capacity(cover_img)       -> capacity_dict

    scheme3_embed(cover_img, payload) -> stego_img, stats
    scheme3_extract(stego_img)        -> payload, stats
    scheme3_capacity(cover_img)       -> capacity_dict

    cover_img / stego_img : PIL.Image (mode "RGB") or numpy ndarray H×W×3
    payload               : bytes  (raw secret; 32-bit length header handled here)
    stats                 : dict   (capacity_bits, capacity_per_channel,
                                    payload_bits, fobp_count, fobp_per_channel, …)
"""

from __future__ import annotations

import numpy as np
from PIL import Image
from typing import Union

from src.pvdm_core import (
    RANGE_TABLE_RED,
    RANGE_TABLE_GREEN_SYM,
    RANGE_TABLE_BLUE_SYM,
    RANGE_TABLE_GREEN_HVS,
    RANGE_TABLE_BLUE_HVS,
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
# Type alias & Constants
# ---------------------------------------------------------------------------
ImageLike = Union[Image.Image, np.ndarray]

CHANNEL_NAMES = ("R", "G", "B")

SCHEME2_TABLES: tuple[list[RangeEntry], list[RangeEntry], list[RangeEntry]] = (
    RANGE_TABLE_RED,
    RANGE_TABLE_GREEN_SYM,
    RANGE_TABLE_BLUE_SYM,
)

SCHEME3_TABLES: tuple[list[RangeEntry], list[RangeEntry], list[RangeEntry]] = (
    RANGE_TABLE_RED,
    RANGE_TABLE_GREEN_HVS,
    RANGE_TABLE_BLUE_HVS,
)


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


def _build_capacity_dict(H: int, W: int, per_ch: dict[str, int]) -> dict:
    """Assemble standardized capacity dictionary (bits, bytes, bpp, per-channel)."""
    total_bits = per_ch["R"] + per_ch["G"] + per_ch["B"]
    num_pixels = H * W
    return {
        "capacity_bits": total_bits,
        "capacity_bytes": total_bits // 8,
        "max_payload_bytes": max(0, (total_bits // 8) - 4),
        "bpp": total_bits / num_pixels if num_pixels > 0 else 0.0,
        "per_channel_bits": dict(per_ch),
        "per_channel_bytes": {ch: bits // 8 for ch, bits in per_ch.items()},
        "per_channel_bpp": {
            ch: (bits / num_pixels if num_pixels > 0 else 0.0)
            for ch, bits in per_ch.items()
        },
    }


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
       We try multiples of 2^t around (px+py) and all d in the sub-range.

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
    # For each valid sum s = k*power + b (k integer), we derive:
    #   cx = (s + sign*d) // 2,  cy = (s - sign*d) // 2
    mid_sum  = px + py
    best_nx, best_ny = nx, ny
    best_mse = float('inf')

    k_center = mid_sum // power
    for dk in range(-2, 3):
        k = k_center + dk
        s = k * power + b
        if s < 0 or s > 510:
            continue
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

def _scheme1_capacity_per_channel(cover: np.ndarray) -> dict[str, int]:
    """Per-channel payload bits embeddable by Scheme 1 (indicator-guided pairs)."""
    H, W, _ = cover.shape
    per_ch = {"R": 0, "G": 0, "B": 0}
    for row in range(H):
        col = 0
        while col + 1 < W:
            indicator = int(cover[row, col, 0]) & 0b11
            if indicator == 0b01:
                g0, g1 = int(cover[row, col, 1]), int(cover[row, col + 1, 1])
                per_ch["G"] += find_range(abs(g0 - g1), RANGE_TABLE_GREEN_SYM).bits
            elif indicator == 0b10:
                b0, b1 = int(cover[row, col, 2]), int(cover[row, col + 1, 2])
                per_ch["B"] += find_range(abs(b0 - b1), RANGE_TABLE_BLUE_SYM).bits
            col += 2
    return per_ch


def _scheme1_capacity(cover: np.ndarray) -> int:
    """Maximum payload bits embeddable by Scheme 1 (indicator-guided pairs)."""
    per_ch = _scheme1_capacity_per_channel(cover)
    return per_ch["R"] + per_ch["G"] + per_ch["B"]


def scheme1_capacity(cover_img: ImageLike) -> dict:
    """Compute maximum capacity stats (bits, bytes, bpp, per-channel) for Scheme 1."""
    cover = _to_array(cover_img)
    H, W, _ = cover.shape
    per_ch = _scheme1_capacity_per_channel(cover)
    return _build_capacity_dict(H, W, per_ch)


def scheme1_embed(cover_img: ImageLike, payload: bytes) -> tuple[Image.Image, dict]:
    """
    Embed `payload` using Scheme 1 (Modified Pixel Indicator — Awate & Patil, 2016).

    Parameters
    ----------
    cover_img : PIL Image or H×W×3 uint8 numpy array.
    payload   : Raw bytes to embed.

    Returns
    -------
    stego_img : PIL Image (RGB).
    stats     : dict(capacity_bits, capacity_per_channel, payload_bits,
                     fobp_count, fobp_per_channel, skipped_pairs, used_pairs)
    """
    cover = _to_array(cover_img)
    stego = cover.copy()
    H, W, _ = cover.shape

    packed     = pack_message(payload)
    bit_stream = bytes_to_bits(packed)
    n_bits     = len(bit_stream)
    padded     = bit_stream + [0] * 16  # zero-pad for clean word reads

    per_ch_cap = _scheme1_capacity_per_channel(cover)
    capacity   = per_ch_cap["R"] + per_ch_cap["G"] + per_ch_cap["B"]
    if n_bits > capacity:
        raise ValueError(
            f"Scheme 1: payload+header ({n_bits} bits) exceeds capacity "
            f"({capacity} bits). Max payload ≈ {(capacity // 8) - 4} bytes."
        )

    bit_idx          = 0
    fobp_count       = 0
    fobp_per_channel = {"R": 0, "G": 0, "B": 0}
    skipped          = 0
    used             = 0

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
                fobp_count            += counter[0]
                fobp_per_channel["G"] += counter[0]

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
                fobp_count            += counter[0]
                fobp_per_channel["B"] += counter[0]

                stego[row, col,     2] = nb0
                stego[row, col + 1, 2] = nb1
                bit_idx += entry.bits
                used    += 1

            else:
                skipped += 1

            col += 2

    stats = {
        "capacity_bits"        : capacity,
        "capacity_per_channel" : per_ch_cap,
        "payload_bits"         : n_bits,
        "fobp_count"           : fobp_count,
        "fobp_per_channel"     : fobp_per_channel,
        "skipped_pairs"        : skipped,
        "used_pairs"           : used,
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
# SHARED FULL-RGB PVDM ENGINE (used by Scheme 2 & Scheme 3)
# ---------------------------------------------------------------------------

def _rgb_pvdm_capacity_per_channel(
    cover: np.ndarray,
    tables: tuple[list[RangeEntry], list[RangeEntry], list[RangeEntry]],
) -> dict[str, int]:
    """Per-channel maximum embeddable bits for a 3-channel PVDM range table set."""
    H, W, _ = cover.shape
    per_ch = {"R": 0, "G": 0, "B": 0}
    for ch, ch_name in enumerate(CHANNEL_NAMES):
        table = tables[ch]
        # Vectorised difference computation for speed on 512x512 images
        p0 = cover[:, 0 : W - (W % 2) : 2, ch].astype(np.int16)
        p1 = cover[:, 1 : W - (W % 2) : 2, ch].astype(np.int16)
        diffs = np.abs(p0 - p1)
        ch_bits = 0
        for entry in table:
            count = int(np.count_nonzero((diffs >= entry.low) & (diffs <= entry.high)))
            ch_bits += count * entry.bits
        per_ch[ch_name] = ch_bits
    return per_ch


def _rgb_pvdm_embed(
    cover_img: ImageLike,
    payload: bytes,
    tables: tuple[list[RangeEntry], list[RangeEntry], list[RangeEntry]],
    scheme_label: str,
) -> tuple[Image.Image, dict]:
    """
    Generic simultaneous 3-channel RGB PVDM embedding using per-channel range tables.
    """
    cover = _to_array(cover_img)
    stego = cover.copy()
    H, W, _ = cover.shape

    packed     = pack_message(payload)
    bit_stream = bytes_to_bits(packed)
    n_bits     = len(bit_stream)
    padded     = bit_stream + [0] * 16

    per_ch_cap = _rgb_pvdm_capacity_per_channel(cover, tables)
    capacity   = per_ch_cap["R"] + per_ch_cap["G"] + per_ch_cap["B"]
    if n_bits > capacity:
        raise ValueError(
            f"{scheme_label}: payload+header ({n_bits} bits) exceeds capacity "
            f"({capacity} bits). Max payload ≈ {(capacity // 8) - 4} bytes."
        )

    bit_idx          = 0
    fobp_count       = 0
    fobp_per_channel = {"R": 0, "G": 0, "B": 0}
    used_pairs       = 0

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
                if counter[0]:
                    fobp_count += counter[0]
                    fobp_per_channel[CHANNEL_NAMES[ch]] += counter[0]

                stego[row, col,     ch] = np0
                stego[row, col + 1, ch] = np1
                bit_idx += entry.bits

                if bit_idx >= n_bits:
                    break

            used_pairs += 1
            col        += 2

    stats = {
        "capacity_bits"        : capacity,
        "capacity_per_channel" : per_ch_cap,
        "payload_bits"         : n_bits,
        "fobp_count"           : fobp_count,
        "fobp_per_channel"     : fobp_per_channel,
        "used_pairs"           : used_pairs,
    }
    return _to_pil(stego), stats


def _rgb_pvdm_extract(
    stego_img: ImageLike,
    tables: tuple[list[RangeEntry], list[RangeEntry], list[RangeEntry]],
) -> tuple[bytes, dict]:
    """
    Generic blind extraction for simultaneous 3-channel RGB PVDM using per-channel range tables.
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


# ---------------------------------------------------------------------------
# SCHEME 2  — Symmetric RGB PVDM (Wang et al. 6-level, all 3 channels)
# ---------------------------------------------------------------------------

def _scheme2_capacity(cover: np.ndarray) -> int:
    per_ch = _rgb_pvdm_capacity_per_channel(cover, SCHEME2_TABLES)
    return per_ch["R"] + per_ch["G"] + per_ch["B"]


def scheme2_capacity(cover_img: ImageLike) -> dict:
    """Compute maximum capacity stats (bits, bytes, bpp, per-channel) for Scheme 2."""
    cover = _to_array(cover_img)
    H, W, _ = cover.shape
    per_ch = _rgb_pvdm_capacity_per_channel(cover, SCHEME2_TABLES)
    return _build_capacity_dict(H, W, per_ch)


def scheme2_embed(cover_img: ImageLike, payload: bytes) -> tuple[Image.Image, dict]:
    """
    Embed `payload` using Scheme 2: Symmetric Wang et al. 6-level table on R, G, B.

    Returns
    -------
    stego_img : PIL Image (RGB).
    stats     : dict(capacity_bits, capacity_per_channel, payload_bits,
                     fobp_count, fobp_per_channel, used_pairs)
    """
    return _rgb_pvdm_embed(cover_img, payload, SCHEME2_TABLES, "Scheme 2")


def scheme2_extract(stego_img: ImageLike) -> tuple[bytes, dict]:
    """
    Extract payload from Scheme-2 stego image.

    Returns
    -------
    payload : bytes
    stats   : dict(extracted_bits)
    """
    return _rgb_pvdm_extract(stego_img, SCHEME2_TABLES)


# ---------------------------------------------------------------------------
# SCHEME 3  — Asymmetric HVS-Based RGB PVDM (Proposed Method)
#             Green: 7-level protective | Red: 6-level standard | Blue: 5-level expansive
# ---------------------------------------------------------------------------

def _scheme3_capacity(cover: np.ndarray) -> int:
    per_ch = _rgb_pvdm_capacity_per_channel(cover, SCHEME3_TABLES)
    return per_ch["R"] + per_ch["G"] + per_ch["B"]


def scheme3_capacity(cover_img: ImageLike) -> dict:
    """Compute maximum capacity stats (bits, bytes, bpp, per-channel) for Scheme 3 (HVS)."""
    cover = _to_array(cover_img)
    H, W, _ = cover.shape
    per_ch = _rgb_pvdm_capacity_per_channel(cover, SCHEME3_TABLES)
    return _build_capacity_dict(H, W, per_ch)


def scheme3_embed(cover_img: ImageLike, payload: bytes) -> tuple[Image.Image, dict]:
    """
    Embed `payload` using Scheme 3 (Proposed Method): Asymmetric HVS-Based RGB PVDM.

    Range tables per channel (docs/md/pvdmbase.md Section 4.A):
        - Red   (ch=0): 6-level standard   (RANGE_TABLE_RED)
        - Green (ch=1): 7-level protective (RANGE_TABLE_GREEN_HVS)
        - Blue  (ch=2): 5-level expansive  (RANGE_TABLE_BLUE_HVS)

    Returns
    -------
    stego_img : PIL Image (RGB).
    stats     : dict(capacity_bits, capacity_per_channel, payload_bits,
                     fobp_count, fobp_per_channel, used_pairs)
    """
    return _rgb_pvdm_embed(cover_img, payload, SCHEME3_TABLES, "Scheme 3")


def scheme3_extract(stego_img: ImageLike) -> tuple[bytes, dict]:
    """
    Extract payload blindly from Scheme-3 (Asymmetric HVS RGB PVDM) stego image.

    Returns
    -------
    payload : bytes
    stats   : dict(extracted_bits)
    """
    return _rgb_pvdm_extract(stego_img, SCHEME3_TABLES)
