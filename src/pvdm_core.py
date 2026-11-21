"""
pvdm_core.py
============
Core PVDM (Pixel-Value Differencing & Modulus Function) engine.

Based on:
    Wang et al. (2008) - "A high quality steganographic method with
    pixel-value differencing and modulus function."
    Journal of Systems and Software, 81(1), pp. 150–158.
    DOI: 10.1016/j.jss.2007.01.049

This module is intentionally decoupled from any specific colour-channel
scheme so that Scheme 1, 2, and 3 (Phase 2) can all reuse the same
mathematically-verified building blocks.

Public API
----------
Range tables (plain dicts / lists usable by any scheme):
    RANGE_TABLE_RED        : 6-level standard (Wang et al. / Scheme 2 R)
    RANGE_TABLE_GREEN_HVS  : 7-level protective (Scheme 3 G)
    RANGE_TABLE_GREEN_SYM  : 6-level standard (Scheme 2 G)
    RANGE_TABLE_BLUE_HVS   : 5-level expansive (Scheme 3 B)
    RANGE_TABLE_BLUE_SYM   : 6-level standard (Scheme 2 B)

Core functions:
    find_range(d, table)   : locate sub-range for a difference value d
    bits_capacity(w)       : t = floor(log2(w))
    embed_pair(px, py, b, t, fobp_counter) -> (px', py', fobp_flag)
    extract_pair(px, py, t) -> b (int)

Message I/O helpers:
    bytes_to_bits(data)    : bytes -> list[int] (MSB first)
    bits_to_bytes(bits)    : list[int] -> bytes
    pack_message(payload)  : prepend 32-bit length header -> bytes
    unpack_message(data)   : strip 32-bit length header -> bytes payload
"""

from __future__ import annotations
import math
from typing import NamedTuple

# ---------------------------------------------------------------------------
# RANGE TABLES
# ---------------------------------------------------------------------------

class RangeEntry(NamedTuple):
    low: int   # lower bound l_j  (inclusive)
    high: int  # upper bound u_j  (inclusive)
    width: int # w_j = high - low + 1  (must be a power of 2)
    bits: int  # t = floor(log2(w_j))


def _build_table(bounds: list[tuple[int, int]]) -> list[RangeEntry]:
    """Build a validated RangeEntry list from (low, high) pairs."""
    table = []
    for low, high in bounds:
        w = high - low + 1
        t = int(math.floor(math.log2(w)))
        assert 2**t == w, f"Width {w} in [{low},{high}] is not a power of 2!"
        table.append(RangeEntry(low, high, w, t))
    return table


# Wang et al. (2008) standard 6-level table (grayscale baseline / Red channel)
RANGE_TABLE_RED = _build_table([
    (0,   7),    # R1 -> 3 bits
    (8,  15),    # R2 -> 3 bits
    (16, 31),    # R3 -> 4 bits
    (32, 63),    # R4 -> 5 bits
    (64, 127),   # R5 -> 6 bits
    (128, 255),  # R6 -> 7 bits
])

# Same 6-level for symmetric Scheme 2 (Green & Blue channels use same table)
RANGE_TABLE_GREEN_SYM = RANGE_TABLE_RED
RANGE_TABLE_BLUE_SYM  = RANGE_TABLE_RED

# HVS-driven 7-level PROTECTIVE table for Green channel (Scheme 3 / Phase 2)
#   - Area halus [0,7] dipecah jadi 2 sub-rentang w=4 -> max 2 bit (sangat protektif)
RANGE_TABLE_GREEN_HVS = _build_table([
    (0,   3),    # R1 -> 2 bits  (smooth area, very tight)
    (4,   7),    # R2 -> 2 bits  (smooth area, very tight)
    (8,  15),    # R3 -> 3 bits
    (16, 31),    # R4 -> 4 bits
    (32, 63),    # R5 -> 5 bits
    (64, 127),   # R6 -> 6 bits
    (128, 255),  # R7 -> 7 bits
])

# HVS-driven 5-level EXPANSIVE table for Blue channel (Scheme 3 / Phase 2)
#   - Area halus [0,15] digabung -> min 4 bit bahkan di smooth area
RANGE_TABLE_BLUE_HVS = _build_table([
    (0,  15),    # R1 -> 4 bits  (expanded smooth area)
    (16, 31),    # R2 -> 4 bits
    (32, 63),    # R3 -> 5 bits
    (64, 127),   # R4 -> 6 bits
    (128, 255),  # R5 -> 7 bits
])


# ---------------------------------------------------------------------------
# RANGE LOOKUP
# ---------------------------------------------------------------------------

def find_range(d: int, table: list[RangeEntry]) -> RangeEntry:
    """
    Return the RangeEntry whose [low, high] bracket contains d.

    Parameters
    ----------
    d     : absolute pixel difference |p_x - p_y|, integer in [0, 255]
    table : one of the RANGE_TABLE_* constants

    Raises
    ------
    ValueError if d is outside [0, 255] or not covered by any entry.
    """
    if not (0 <= d <= 255):
        raise ValueError(f"Difference d={d} out of valid range [0, 255].")
    for entry in table:
        if entry.low <= d <= entry.high:
            return entry
    raise ValueError(f"d={d} not covered by any entry in the given table.")


def bits_capacity(w: int) -> int:
    """Return t = floor(log2(w)) for a range width w (power of 2)."""
    return int(math.floor(math.log2(w)))


# ---------------------------------------------------------------------------
# BIT / BYTE HELPERS
# ---------------------------------------------------------------------------

def bytes_to_bits(data: bytes) -> list[int]:
    """Convert bytes to a flat list of bits, MSB first per byte."""
    bits = []
    for byte in data:
        for shift in range(7, -1, -1):
            bits.append((byte >> shift) & 1)
    return bits


def bits_to_bytes(bits: list[int]) -> bytes:
    """
    Convert a flat list of bits (MSB first per byte) back to bytes.
    Length of `bits` must be a multiple of 8.
    """
    if len(bits) % 8 != 0:
        raise ValueError("bits length must be a multiple of 8.")
    out = bytearray()
    for i in range(0, len(bits), 8):
        byte = 0
        for j in range(8):
            byte = (byte << 1) | bits[i + j]
        out.append(byte)
    return bytes(out)


def pack_message(payload: bytes) -> bytes:
    """
    Prepend a 32-bit big-endian length header to payload.
    This allows blind extraction without knowing the original message length.

    Format: [4 bytes: len(payload) as uint32-BE] + [payload bytes]
    """
    n = len(payload)
    if n > 0xFFFFFFFF:
        raise ValueError(f"Payload too large: {n} bytes (max 4 294 967 295).")
    header = n.to_bytes(4, byteorder='big')
    return header + payload


def unpack_message(data: bytes) -> bytes:
    """
    Strip the 32-bit big-endian length header and return the raw payload.
    Raises ValueError if the declared length exceeds available data.
    """
    if len(data) < 4:
        raise ValueError("Data too short to contain a 32-bit length header.")
    n = int.from_bytes(data[:4], byteorder='big')
    payload = data[4:4 + n]
    if len(payload) < n:
        raise ValueError(
            f"Declared length {n} exceeds available bytes {len(payload)}."
        )
    return payload


# ---------------------------------------------------------------------------
# CORE EMBED / EXTRACT  (Wang et al., 2008 — Steps 1–4)
# ---------------------------------------------------------------------------

def _ceil(x: float) -> int:
    return math.ceil(x)

def _floor(x: float) -> int:
    return math.floor(x)


def embed_pair(
    px: int,
    py: int,
    b: int,
    t: int,
    fobp_counter: list[int] | None = None,
) -> tuple[int, int, bool]:
    """
    Embed `t` bits of secret data (integer value `b`) into pixel pair (px, py).

    Implements Steps 2–4 of Wang et al. (2008):
        Step 2: Compute FREM = (px + py) mod 2^t
        Step 3: Optimal 8-case pixel shifting
        Step 4: Falling-Off-Boundary Problem (FOBP) correction (3 cases)

    Parameters
    ----------
    px, py         : original pixel values in [0, 255]
    b              : secret data value to embed, integer in [0, 2^t - 1]
    t              : number of bits determined by find_range().bits
    fobp_counter   : optional mutable list[int] of length 1; incremented
                     when a FOBP case fires (pass [0] from caller to track).

    Returns
    -------
    (px', py', fobp_flag)
        px', py'   : modified pixel values after embedding, guaranteed [0, 255]
        fobp_flag  : True if FOBP correction was applied
    """
    if not (0 <= px <= 255 and 0 <= py <= 255):
        raise ValueError(f"Pixel values must be in [0,255], got ({px},{py}).")
    power = 2 ** t
    half  = power // 2  # 2^(t-1)

    # --- Step 2: Compute remainder ---
    frem = (px + py) % power

    # --- Step 3: Optimal 8-case pixel shifting ---
    m  = abs(frem - b)
    m1 = power - m

    # Determine shift direction and magnitude using Wang et al. (2008) Step 3
    # (8 optimal cases, exact match to pvdmbase.md Section 4.B):
    #   Key insight: choose whichever of (m, m1) is smaller to minimise MSE,
    #   and shift inward (larger half from larger pixel when subtracting;
    #   larger half to smaller pixel when adding) to reduce distortion & FOBP.
    #
    #   Case 1 (frem >  b, m <= half, px >= py): (px - ceil(m/2),   py - floor(m/2))
    #   Case 2 (frem >  b, m <= half, px <  py): (px - floor(m/2),  py - ceil(m/2))
    #   Case 3 (frem >  b, m >  half, px >= py): (px + floor(m1/2), py + ceil(m1/2))
    #   Case 4 (frem >  b, m >  half, px <  py): (px + ceil(m1/2),  py + floor(m1/2))
    #   Case 5 (frem <= b, m <= half, px >= py): (px + floor(m/2),  py + ceil(m/2))
    #   Case 6 (frem <= b, m <= half, px <  py): (px + ceil(m/2),   py + floor(m/2))
    #   Case 7 (frem <= b, m >  half, px >= py): (px - ceil(m1/2),  py - floor(m1/2))
    #   Case 8 (frem <= b, m >  half, px <  py): (px - floor(m1/2), py - ceil(m1/2))
    if frem > b:
        if m <= half:
            # Cases 1 & 2: subtract m
            if px >= py:
                # Case 1
                nx = px - _ceil(m / 2)
                ny = py - _floor(m / 2)
            else:
                # Case 2
                nx = px - _floor(m / 2)
                ny = py - _ceil(m / 2)
        else:
            # Cases 3 & 4: add m1 (complement)
            if px >= py:
                # Case 3
                nx = px + _floor(m1 / 2)
                ny = py + _ceil(m1 / 2)
            else:
                # Case 4
                nx = px + _ceil(m1 / 2)
                ny = py + _floor(m1 / 2)
    else:  # frem <= b
        if m <= half:
            # Cases 5 & 6: add m
            if px >= py:
                # Case 5
                nx = px + _floor(m / 2)
                ny = py + _ceil(m / 2)
            else:
                # Case 6
                nx = px + _ceil(m / 2)
                ny = py + _floor(m / 2)
        else:
            # Cases 7 & 8: subtract m1 (complement)
            if px >= py:
                # Case 7
                nx = px - _ceil(m1 / 2)
                ny = py - _floor(m1 / 2)
            else:
                # Case 8
                nx = px - _floor(m1 / 2)
                ny = py - _ceil(m1 / 2)

    # --- Step 4: FOBP correction ---
    fobp_flag = False

    if nx < 0 or nx > 255 or ny < 0 or ny > 255:
        fobp_flag = True
        if fobp_counter is not None:
            fobp_counter[0] += 1

        d_orig = abs(px - py)

        if d_orig <= 128:
            # Case 1: both pixels near 0 (underflow)
            if nx < 0 or ny < 0:
                nx = nx + half
                ny = ny + half
            # Case 2: both pixels near 255 (overflow)
            elif nx > 255 or ny > 255:
                nx = nx - half
                ny = ny - half
        else:
            # Case 3: extreme contrast (d_orig > 128)
            # Clamp one pixel to boundary and absorb remainder into partner,
            # preserving (nx + ny) mod 2^t == b.
            if nx < 0:
                overflow = -nx            # how far below 0
                nx = 0
                ny = ny - overflow        # push remainder to partner
            elif nx > 255:
                overflow = nx - 255
                nx = 255
                ny = ny + overflow
            if ny < 0:
                overflow = -ny
                ny = 0
                nx = nx - overflow
            elif ny > 255:
                overflow = ny - 255
                ny = 255
                nx = nx + overflow

    # Final safety clamp (edge-of-edge-of-edge scenarios)
    nx = max(0, min(255, nx))
    ny = max(0, min(255, ny))

    return nx, ny, fobp_flag


def extract_pair(px: int, py: int, t: int) -> int:
    """
    Extract `t` bits of secret data from pixel pair (px, py).

    Implements the extraction step of Wang et al. (2008):
        b = (px + py) mod 2^t

    Parameters
    ----------
    px, py : stego pixel values in [0, 255]
    t      : number of bits to extract (from find_range on the stego pair)

    Returns
    -------
    b : integer in [0, 2^t - 1]
    """
    return (px + py) % (2 ** t)
