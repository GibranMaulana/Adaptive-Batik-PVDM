#!/usr/bin/env python3
"""Reproducible Issue #2 acceptance check, separate from Phase 3 evaluation.

Compare the same seeded message (up to 10 KiB) in all three schemes.
If Scheme 1 cannot hold 10 KiB, use its maximum usable bytes for all three. Also round-trip
Scheme 3 at its maximum usable byte capacity, including PNG serialization.
Write per-image evidence to CSV; fail on extraction errors or unmet goals.
"""
from __future__ import annotations

import argparse
import csv
import io
import math
from pathlib import Path
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.pvdm_rgb_batik import (
    scheme1_embed, scheme1_extract, scheme2_embed, scheme2_extract,
    scheme3_capacity, scheme3_embed, scheme3_extract,
)

ROOT = Path(__file__).resolve().parents[1]


def green_psnr(cover, stego):
    difference = np.asarray(cover)[:, :, 1].astype(np.float64) - np.asarray(stego)[:, :, 1]
    mse = float(np.mean(difference ** 2))
    return math.inf if mse == 0 else 10 * math.log10(255 ** 2 / mse)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/results/phase2_validation.csv')
    parser.add_argument('--payload-bytes', type=int, default=10 * 1024)
    args = parser.parse_args()
    if args.payload_bytes <= 0:
        parser.error('--payload-bytes must be positive')
    paths = sorted((ROOT / 'data/batik_512').glob('*/*.png'))
    if not paths:
        raise SystemExit('No cover images found')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    failures = 0
    with args.output.open('w', newline='') as stream:
        writer = None
        for path in paths:
            with Image.open(path) as image:
                cover = image.convert('RGB')
            _, baseline_stats = scheme1_embed(cover, b'')
            common_bytes = min(args.payload_bytes, baseline_stats['capacity_bits'] // 8 - 4)
            if common_bytes <= 0:
                raise RuntimeError(f'{path.name}: no non-empty common payload fits')
            payload = np.random.default_rng(42).bytes(common_bytes)
            row = {'image': str(path.relative_to(ROOT / 'data/batik_512')),
                   'seed': 42, 'requested_payload_bytes': args.payload_bytes, 'payload_bytes': len(payload)}
            for n, embed, extract in ((1, scheme1_embed, scheme1_extract),
                                      (2, scheme2_embed, scheme2_extract),
                                      (3, scheme3_embed, scheme3_extract)):
                stego, stats = embed(cover, payload)
                recovered, _ = extract(stego)
                if recovered != payload:
                    raise RuntimeError(f'{path.name}: Scheme {n} extraction failed')
                row[f'scheme{n}_capacity_bits'] = stats['capacity_bits']
                row[f'scheme{n}_ber'] = 0.0
                if n in (2, 3):
                    row[f'scheme{n}_psnr_g_db'] = green_psnr(cover, stego)
            capacity = scheme3_capacity(cover)
            for channel, bits in capacity['capacity_bits_by_channel'].items():
                row[f'scheme3_capacity_{channel.lower()}_bits'] = bits
            full_payload = np.random.default_rng(42).bytes(capacity['max_payload_bytes'])
            full_stego, stats = scheme3_embed(cover, full_payload)
            png = io.BytesIO()
            full_stego.save(png, format='PNG')
            png.seek(0)
            with Image.open(png) as reloaded:
                recovered, _ = scheme3_extract(reloaded)
            if recovered != full_payload:
                raise RuntimeError(f'{path.name}: full-capacity PNG extraction failed')
            row['scheme3_full_payload_bytes'] = len(full_payload)
            row['scheme3_full_ber'] = 0.0
            row['scheme3_full_fobp_count'] = stats['fobp_count']
            row['capacity_ratio_3_to_1'] = row['scheme3_capacity_bits'] / row['scheme1_capacity_bits']
            row['psnr_g_gain_db'] = row['scheme3_psnr_g_db'] - row['scheme2_psnr_g_db']
            row['goals_pass'] = row['capacity_ratio_3_to_1'] > 1 and row['psnr_g_gain_db'] > 0
            failures += not row['goals_pass']
            if writer is None:
                writer = csv.DictWriter(stream, fieldnames=list(row), lineterminator="\n")
                writer.writeheader()
            writer.writerow(row)
            stream.flush()
            print(f"{row['image']}: BER=0 ({len(payload)} bytes + full PNG), capacity ratio={row['capacity_ratio_3_to_1']:.2f}, Green gain={row['psnr_g_gain_db']:.3f} dB", flush=True)
    print(f'{len(paths)} images checked; {failures} unmet comparisons. Evidence: {args.output}')
    return int(failures > 0)


if __name__ == '__main__':
    raise SystemExit(main())
