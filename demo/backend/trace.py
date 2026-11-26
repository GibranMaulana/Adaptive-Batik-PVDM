"""Read-only calculation samples for the live embedding visualisation.

The functions in this module *observe* a completed embedding.  The PVDM
engine remains the sole implementation that writes stego pixels; this module
only compares the cover/stego pairs and reconstructs the already-consumed
payload words for a small, presentable trace.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

from src.pvdm_core import RangeEntry, bytes_to_bits, embed_pair, find_range, pack_message
from src.pvdm_rgb_batik import (
    CHANNEL_NAMES,
    RANGE_TABLE_BLUE_SYM,
    RANGE_TABLE_GREEN_SYM,
    SCHEME2_TABLES,
    SCHEME3_TABLES,
)


def _build_table_luts(table: list[RangeEntry]) -> tuple[tuple[RangeEntry, ...], np.ndarray]:
    entries = tuple(find_range(d, table) for d in range(256))
    bits_lut = np.array([entry.bits for entry in entries], dtype=np.uint8)
    return entries, bits_lut


# Max single-pixel shift in embed_pair Step 3 is ceil(2^(t-1) / 2), so FOBP can
# only trigger when at least one pixel lies within max_shift of 0 or 255.
_MAX_SHIFT_LUT = np.array([0, 1, 1, 2, 4, 8, 16, 32, 64], dtype=np.uint8)

_SCHEME1_G_ENTRIES, _SCHEME1_G_BITS = _build_table_luts(RANGE_TABLE_GREEN_SYM)
_SCHEME1_B_ENTRIES, _SCHEME1_B_BITS = _build_table_luts(RANGE_TABLE_BLUE_SYM)
_SCHEME2_LUTS = tuple(_build_table_luts(table) for table in SCHEME2_TABLES)
_SCHEME3_LUTS = tuple(_build_table_luts(table) for table in SCHEME3_TABLES)


def _read_bits_int(buf: bytes, bit_pos: int, n_bits: int) -> int:
    byte_idx = bit_pos >> 3
    bit_off = bit_pos & 7
    chunk = (buf[byte_idx] << 8) | buf[byte_idx + 1]
    return (chunk >> (16 - bit_off - n_bits)) & ((1 << n_bits) - 1)


def _pick_sample_indices(written_count: int, first_fobp_idx: int | None) -> list[int]:
    if written_count <= 0:
        return []
    candidates = [0]
    if first_fobp_idx is not None:
        candidates.append(first_fobp_idx)
    candidates.append(written_count - 1)
    seen: set[int] = set()
    ordered: list[int] = []
    for idx in candidates:
        if idx not in seen:
            seen.add(idx)
            ordered.append(idx)
    return ordered


def _word(bits: list[int], start: int, length: int) -> tuple[str, int]:
    window = bits[start : start + length]
    if len(window) < length:
        window += [0] * (length - len(window))
    return "".join(str(bit) for bit in window), int("".join(str(bit) for bit in window), 2)


def _rgb_pair(pixels: np.ndarray, row: int, col: int) -> list[list[int]]:
    return [
        [int(pixels[row, col, 0]), int(pixels[row, col, 1]), int(pixels[row, col, 2])],
        [int(pixels[row, col + 1, 0]), int(pixels[row, col + 1, 1]), int(pixels[row, col + 1, 2])],
    ]


def _step(
    *,
    row: int,
    col: int,
    channel: str,
    before: tuple[int, int],
    after: tuple[int, int],
    rgb_before: list[list[int]],
    rgb_after: list[list[int]],
    low: int,
    high: int,
    bits: int,
    payload_bits: str,
    payload_value: int,
    fobp_triggered: bool,
    indicator: int | None = None,
) -> dict[str, object]:
    modulo = 2**bits
    item: dict[str, object] = {
        "row": row,
        "columns": [col, col + 1],
        "channel": channel,
        "before": list(before),
        "after": list(after),
        "rgb_before": [[int(c) for c in pixel] for pixel in rgb_before],
        "rgb_after": [[int(c) for c in pixel] for pixel in rgb_after],
        "difference_before": abs(before[0] - before[1]),
        "difference_after": abs(after[0] - after[1]),
        "range": [low, high],
        "bits": bits,
        "payload_bits": payload_bits,
        "payload_value": payload_value,
        "frem_before": (before[0] + before[1]) % modulo,
        "frem_after": (after[0] + after[1]) % modulo,
        "fobp_triggered": bool(fobp_triggered),
    }
    if indicator is not None:
        item["indicator"] = indicator
    return item


def build_calculation_trace(
    scheme: str, cover: Image.Image, stego: Image.Image, payload: bytes, max_steps: int = 24
) -> dict[str, object]:
    """Return the first real PVDM writes from an already-completed embed."""
    source = np.asarray(cover.convert("RGB"), dtype=np.uint8)
    target = np.asarray(stego.convert("RGB"), dtype=np.uint8)
    height, width, _ = source.shape
    stream = bytes_to_bits(pack_message(payload))
    cursor = 0
    steps: list[dict[str, object]] = []

    for row in range(height):
        for col in range(0, width - 1, 2):
            if cursor >= len(stream) or (len(steps) >= max_steps and cursor >= 32):
                break

            if scheme == "scheme1":
                indicator = int(source[row, col, 0]) & 0b11
                if indicator not in (0b01, 0b10):
                    continue
                channel_index = 1 if indicator == 0b01 else 2
                channel = "G" if channel_index == 1 else "B"
                table = RANGE_TABLE_GREEN_SYM if channel == "G" else RANGE_TABLE_BLUE_SYM
                before = (int(source[row, col, channel_index]), int(source[row, col + 1, channel_index]))
                after = (int(target[row, col, channel_index]), int(target[row, col + 1, channel_index]))
                entry = find_range(abs(before[0] - before[1]), table)
                word, value = _word(stream, cursor, entry.bits)
                if len(steps) < max_steps and (len(steps) < 4 or cursor >= 32):
                    _, _, fobp_triggered = embed_pair(before[0], before[1], value, entry.bits)
                    steps.append(
                        _step(
                            row=row, col=col, channel=channel, before=before, after=after,
                            rgb_before=_rgb_pair(source, row, col),
                            rgb_after=_rgb_pair(target, row, col),
                            low=entry.low, high=entry.high, bits=entry.bits,
                            payload_bits=word, payload_value=value,
                            fobp_triggered=fobp_triggered, indicator=indicator,
                        )
                    )
                cursor += entry.bits
                continue

            tables = SCHEME2_TABLES if scheme == "scheme2" else SCHEME3_TABLES
            for channel_index, table in enumerate(tables):
                if cursor >= len(stream) or (len(steps) >= max_steps and cursor >= 32):
                    break
                before = (int(source[row, col, channel_index]), int(source[row, col + 1, channel_index]))
                after = (int(target[row, col, channel_index]), int(target[row, col + 1, channel_index]))
                entry = find_range(abs(before[0] - before[1]), table)
                word, value = _word(stream, cursor, entry.bits)
                if len(steps) < max_steps and (len(steps) < 4 or cursor >= 32):
                    _, _, fobp_triggered = embed_pair(before[0], before[1], value, entry.bits)
                    steps.append(
                        _step(
                            row=row, col=col, channel=CHANNEL_NAMES[channel_index], before=before,
                            after=after,
                            rgb_before=_rgb_pair(source, row, col),
                            rgb_after=_rgb_pair(target, row, col),
                            low=entry.low, high=entry.high, bits=entry.bits,
                            payload_bits=word, payload_value=value,
                            fobp_triggered=fobp_triggered,
                        )
                    )
                cursor += entry.bits
        if cursor >= len(stream) or (len(steps) >= max_steps and cursor >= 32):
            break

    return {
        "kind": "observed_engine_output",
        "payload_bits": len(stream),
        "displayed_steps": len(steps),
        "steps": steps,
    }


def build_row_trace(
    scheme: str, cover: Image.Image, stego: Image.Image, payload: bytes
) -> list[dict[str, object]]:
    """Return an uncapped, row-by-row summary trace from Row 0 to the final embedded row."""
    if scheme not in ("scheme1", "scheme2", "scheme3"):
        raise ValueError(f"Unknown scheme: {scheme}")

    source = np.asarray(cover.convert("RGB"), dtype=np.uint8)
    target = np.asarray(stego.convert("RGB"), dtype=np.uint8)
    height, width, _ = source.shape
    pair_width = (width // 2) * 2
    if height == 0 or pair_width == 0:
        return []

    packed = pack_message(payload)
    total_bits = len(packed) * 8
    packed_pad = packed + b"\x00\x00"

    p0_all = source[:, :pair_width:2, :]
    p1_all = source[:, 1:pair_width:2, :]

    rows: list[dict[str, object]] = []
    cursor = 0

    if scheme == "scheme1":
        indicators_all = p0_all[:, :, 0] & 0b11
        for row in range(height):
            if cursor >= total_bits:
                break
            row_ind = indicators_all[row]
            active_pair_idxs = np.flatnonzero((row_ind == 1) | (row_ind == 2))
            if len(active_pair_idxs) == 0:
                rows.append(
                    {
                        "row": row,
                        "pairs_processed": 0,
                        "bits_embedded": 0,
                        "cumulative_bits": cursor,
                        "total_payload_bits": total_bits,
                        "avg_diff": 0.0,
                        "fobp_count": 0,
                        "channels": [],
                        "sample_steps": [],
                    }
                )
                continue

            ch_idxs = row_ind[active_pair_idxs]
            p0 = p0_all[row, active_pair_idxs, ch_idxs]
            p1 = p1_all[row, active_pair_idxs, ch_idxs]
            row_diffs = np.abs(p0.astype(np.int16) - p1.astype(np.int16))
            row_bits = np.where(
                ch_idxs == 1,
                _SCHEME1_G_BITS[row_diffs],
                _SCHEME1_B_BITS[row_diffs],
            )
            cum = np.cumsum(row_bits, dtype=np.int64)
            remaining = total_bits - cursor
            if int(cum[-1]) >= remaining:
                stop_idx = int(np.searchsorted(cum, remaining, side="left"))
                written_count = stop_idx + 1
            else:
                written_count = len(active_pair_idxs)

            active_pair_idxs = active_pair_idxs[:written_count]
            ch_idxs = ch_idxs[:written_count]
            p0 = p0[:written_count]
            p1 = p1[:written_count]
            row_diffs = row_diffs[:written_count]
            row_bits = row_bits[:written_count]
            cum = cum[:written_count]

            bits_embedded = int(cum[-1])
            avg_diff = round(float(row_diffs.mean()), 2)
            channels: list[str] = []
            if bool(np.any(ch_idxs == 1)):
                channels.append("G")
            if bool(np.any(ch_idxs == 2)):
                channels.append("B")

            max_shifts = _MAX_SHIFT_LUT[row_bits]
            upper_bounds = np.uint8(255) - max_shifts
            near = (
                (p0 < max_shifts)
                | (p0 > upper_bounds)
                | (p1 < max_shifts)
                | (p1 > upper_bounds)
            )
            fobp_count = 0
            first_fobp_idx: int | None = None
            for k in np.flatnonzero(near):
                k_int = int(k)
                n_bits = int(row_bits[k_int])
                bit_pos = cursor + (0 if k_int == 0 else int(cum[k_int - 1]))
                val = _read_bits_int(packed_pad, bit_pos, n_bits)
                _, _, triggered = embed_pair(
                    int(p0[k_int]), int(p1[k_int]), val, n_bits
                )
                if triggered:
                    fobp_count += 1
                    if first_fobp_idx is None:
                        first_fobp_idx = k_int

            sample_steps: list[dict[str, object]] = []
            for k_int in _pick_sample_indices(written_count, first_fobp_idx):
                col = int(active_pair_idxs[k_int]) * 2
                ch = int(ch_idxs[k_int])
                diff = int(row_diffs[k_int])
                entry = (
                    _SCHEME1_G_ENTRIES[diff] if ch == 1 else _SCHEME1_B_ENTRIES[diff]
                )
                before = (int(p0[k_int]), int(p1[k_int]))
                after = (int(target[row, col, ch]), int(target[row, col + 1, ch]))
                bit_pos = cursor + (0 if k_int == 0 else int(cum[k_int - 1]))
                val = _read_bits_int(packed_pad, bit_pos, entry.bits)
                word = format(val, f"0{entry.bits}b")
                _, _, fobp_triggered = embed_pair(before[0], before[1], val, entry.bits)
                sample_steps.append(
                    _step(
                        row=row,
                        col=col,
                        channel="G" if ch == 1 else "B",
                        before=before,
                        after=after,
                        rgb_before=_rgb_pair(source, row, col),
                        rgb_after=_rgb_pair(target, row, col),
                        low=entry.low,
                        high=entry.high,
                        bits=entry.bits,
                        payload_bits=word,
                        payload_value=val,
                        fobp_triggered=fobp_triggered,
                        indicator=ch,
                    )
                )

            cursor += bits_embedded
            rows.append(
                {
                    "row": row,
                    "pairs_processed": written_count,
                    "bits_embedded": bits_embedded,
                    "cumulative_bits": cursor,
                    "total_payload_bits": total_bits,
                    "avg_diff": avg_diff,
                    "fobp_count": fobp_count,
                    "channels": channels,
                    "sample_steps": sample_steps,
                }
            )
        return rows

    luts = _SCHEME2_LUTS if scheme == "scheme2" else _SCHEME3_LUTS
    entries_by_ch = tuple(entries for entries, _ in luts)
    diffs_all = np.abs(p0_all.astype(np.int16) - p1_all.astype(np.int16))
    bits_all = np.empty_like(p0_all, dtype=np.uint8)
    for ch, (_, bits_lut) in enumerate(luts):
        bits_all[:, :, ch] = bits_lut[diffs_all[:, :, ch]]

    max_shifts_all = _MAX_SHIFT_LUT[bits_all]
    upper_bounds_all = np.uint8(255) - max_shifts_all
    near_all = (
        (p0_all < max_shifts_all)
        | (p0_all > upper_bounds_all)
        | (p1_all < max_shifts_all)
        | (p1_all > upper_bounds_all)
    )

    for row in range(height):
        if cursor >= total_bits:
            break
        row_bits_flat = bits_all[row].ravel()
        row_diffs_flat = diffs_all[row].ravel()
        row_near_flat = near_all[row].ravel()
        cum = np.cumsum(row_bits_flat, dtype=np.int64)
        remaining = total_bits - cursor
        if int(cum[-1]) >= remaining:
            stop_idx = int(np.searchsorted(cum, remaining, side="left"))
            written_count = stop_idx + 1
        else:
            written_count = len(row_bits_flat)

        bits_embedded = int(cum[written_count - 1])
        avg_diff = round(float(row_diffs_flat[:written_count].mean()), 2)
        channels = list(CHANNEL_NAMES[: min(3, written_count)])

        fobp_count = 0
        first_fobp_idx = None
        for k in np.flatnonzero(row_near_flat[:written_count]):
            k_int = int(k)
            pair_idx = k_int // 3
            ch = k_int % 3
            col = pair_idx * 2
            n_bits = int(row_bits_flat[k_int])
            bit_pos = cursor + (0 if k_int == 0 else int(cum[k_int - 1]))
            val = _read_bits_int(packed_pad, bit_pos, n_bits)
            _, _, triggered = embed_pair(
                int(source[row, col, ch]),
                int(source[row, col + 1, ch]),
                val,
                n_bits,
            )
            if triggered:
                fobp_count += 1
                if first_fobp_idx is None:
                    first_fobp_idx = k_int

        sample_steps = []
        for k_int in _pick_sample_indices(written_count, first_fobp_idx):
            pair_idx = k_int // 3
            ch = k_int % 3
            col = pair_idx * 2
            diff = int(row_diffs_flat[k_int])
            entry = entries_by_ch[ch][diff]
            before = (int(source[row, col, ch]), int(source[row, col + 1, ch]))
            after = (int(target[row, col, ch]), int(target[row, col + 1, ch]))
            bit_pos = cursor + (0 if k_int == 0 else int(cum[k_int - 1]))
            val = _read_bits_int(packed_pad, bit_pos, entry.bits)
            word = format(val, f"0{entry.bits}b")
            _, _, fobp_triggered = embed_pair(before[0], before[1], val, entry.bits)
            sample_steps.append(
                _step(
                    row=row,
                    col=col,
                    channel=CHANNEL_NAMES[ch],
                    before=before,
                    after=after,
                    rgb_before=_rgb_pair(source, row, col),
                    rgb_after=_rgb_pair(target, row, col),
                    low=entry.low,
                    high=entry.high,
                    bits=entry.bits,
                    payload_bits=word,
                    payload_value=val,
                    fobp_triggered=fobp_triggered,
                )
            )

        cursor += bits_embedded
        rows.append(
            {
                "row": row,
                "pairs_processed": written_count,
                "bits_embedded": bits_embedded,
                "cumulative_bits": cursor,
                "total_payload_bits": total_bits,
                "avg_diff": avg_diff,
                "fobp_count": fobp_count,
                "channels": channels,
                "sample_steps": sample_steps,
            }
        )

    return rows
