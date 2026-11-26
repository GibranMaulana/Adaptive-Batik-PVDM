"""Read-only calculation samples for the live embedding visualisation.

The functions in this module *observe* a completed embedding.  The PVDM
engine remains the sole implementation that writes stego pixels; this module
only compares the cover/stego pairs and reconstructs the already-consumed
payload words for a small, presentable trace.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

from src.pvdm_core import bytes_to_bits, embed_pair, find_range, pack_message
from src.pvdm_rgb_batik import (
    CHANNEL_NAMES,
    RANGE_TABLE_BLUE_SYM,
    RANGE_TABLE_GREEN_SYM,
    SCHEME2_TABLES,
    SCHEME3_TABLES,
)


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
