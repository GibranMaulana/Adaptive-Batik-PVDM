#!/usr/bin/env python3
"""Stream high-resolution Batik images from Kaggle (`hydiexe/dataset-fix`)
via HTTP Range requests and standardize them to 512x512 24-bit RGB PNGs.
"""

from __future__ import annotations

import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
from PIL import Image, ImageOps

KAGGLE_DOWNLOAD_URL = "https://www.kaggle.com/api/v1/datasets/download/hydiexe/dataset-fix"

TARGET_MOTIFS: Dict[str, str] = {
    "parang": "dataset_batik_fix/raw_dataset/batik_parang/",
    "kawung": "dataset_batik_fix/raw_dataset/batik_kawung/",
    "megamendung": "dataset_batik_fix/raw_dataset/batik_mega_mendung/",
}

TARGET_SIZE = 512
SAMPLES_PER_MOTIF = 15
OUTPUT_ROOT = Path(__file__).resolve().parent.parent / "data" / "batik_512"


class HttpRangeFile(io.RawIOBase):
    """Seekable read-only file wrapper over an HTTP Range-capable URL."""

    def __init__(self, url: str) -> None:
        self.url = url
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=20) as resp:
            self.size = int(resp.headers["Content-Length"])
        self.pos = 0

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            self.pos = offset
        elif whence == io.SEEK_CUR:
            self.pos += offset
        elif whence == io.SEEK_END:
            self.pos = self.size + offset
        else:
            raise ValueError(f"Unsupported whence: {whence}")
        self.pos = max(0, min(self.pos, self.size))
        return self.pos

    def tell(self) -> int:
        return self.pos

    def read(self, n: int = -1) -> bytes:
        if n == 0 or self.pos >= self.size:
            return b""
        end = self.size - 1 if n < 0 else min(self.size - 1, self.pos + n - 1)
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{end}"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        self.pos += len(data)
        return data


def resolve_kaggle_signed_url(url: str) -> str:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.geturl()


def standardize_to_512_rgb(img: Image.Image) -> Image.Image:
    """Fix EXIF orientation, convert to 24-bit RGB, aspect-preserve downscale
    short side to 512px, and center-crop to 512x512."""
    img = ImageOps.exif_transpose(img).convert("RGB")
    w, h = img.size
    short = min(w, h)
    if short < TARGET_SIZE:
        raise ValueError(f"Image too small ({w}x{h}) for zero-upscaling 512x512 curation")
    if short > TARGET_SIZE:
        scale = TARGET_SIZE / short
        new_w = max(TARGET_SIZE, int(round(w * scale)))
        new_h = max(TARGET_SIZE, int(round(h * scale)))
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    w, h = img.size
    left = (w - TARGET_SIZE) // 2
    top = (h - TARGET_SIZE) // 2
    return img.crop((left, top, left + TARGET_SIZE, top + TARGET_SIZE))


def compute_gradient_stats(arr: np.ndarray) -> Tuple[float, float]:
    """Compute mean horizontal adjacent pixel difference |P_x - P_y| and edge ratio (d >= 16)."""
    diffs = np.abs(arr[:, 0::2, :].astype(np.int16) - arr[:, 1::2, :].astype(np.int16))
    mean_abs_diff = float(diffs.mean())
    edge_pair_ratio = float((diffs >= 16).mean())
    return round(mean_abs_diff, 4), round(edge_pair_ratio, 4)


def curate_dataset() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    signed_url = resolve_kaggle_signed_url(KAGGLE_DOWNLOAD_URL)
    range_file = HttpRangeFile(signed_url)

    manifest: Dict[str, object] = {
        "source": "kaggle:hydiexe/dataset-fix (raw_dataset)",
        "target_size": [TARGET_SIZE, TARGET_SIZE],
        "mode": "RGB",
        "format": "PNG",
        "preprocessing": "exif_transpose -> RGB -> aspect-preserving LANCZOS downscale (short=512) -> center crop 512x512",
        "motifs": {},
    }

    with zipfile.ZipFile(range_file) as zf:
        all_entries = [n for n in zf.namelist() if not n.endswith("/")]

        for motif, prefix in TARGET_MOTIFS.items():
            motif_dir = OUTPUT_ROOT / motif
            motif_dir.mkdir(parents=True, exist_ok=True)
            candidates = sorted(n for n in all_entries if n.startswith(prefix))
            print(f"[{motif}] Found {len(candidates)} entries under {prefix}")

            seen_hashes = set()
            selected_records: List[Dict[str, object]] = []
            scanned = 0
            skipped_small = 0
            skipped_dup = 0
            skipped_err = 0

            for entry in candidates:
                if len(selected_records) >= SAMPLES_PER_MOTIF:
                    break
                scanned += 1
                try:
                    raw_bytes = zf.read(entry)
                    raw_hash = hashlib.sha256(raw_bytes).hexdigest()
                    if raw_hash in seen_hashes:
                        skipped_dup += 1
                        continue
                    with Image.open(io.BytesIO(raw_bytes)) as im:
                        im_t = ImageOps.exif_transpose(im)
                        orig_w, orig_h = im_t.size
                        if min(orig_w, orig_h) < TARGET_SIZE:
                            skipped_small += 1
                            continue
                        curated = standardize_to_512_rgb(im)
                except Exception as exc:
                    skipped_err += 1
                    print(f"  skip {entry}: {exc}")
                    continue

                seen_hashes.add(raw_hash)
                idx = len(selected_records) + 1
                out_name = f"{motif}_{idx:02d}.png"
                out_path = motif_dir / out_name
                curated.save(out_path, format="PNG", optimize=False)

                arr = np.asarray(curated, dtype=np.uint8)
                mean_d, edge_ratio = compute_gradient_stats(arr)
                selected_records.append(
                    {
                        "filename": out_name,
                        "relative_path": f"{motif}/{out_name}",
                        "source_zip_entry": entry,
                        "original_size": [orig_w, orig_h],
                        "curated_size": [TARGET_SIZE, TARGET_SIZE],
                        "mean_pair_diff": mean_d,
                        "edge_pair_ratio_ge16": edge_ratio,
                        "source_sha256": raw_hash[:16],
                    }
                )
                print(
                    f"  saved {out_name} (from {orig_w}x{orig_h}) | mean_d={mean_d:.2f}, edge_ratio={edge_ratio:.3f}"
                )

            manifest["motifs"][motif] = {
                "count": len(selected_records),
                "scanned": scanned,
                "skipped_small": skipped_small,
                "skipped_dup": skipped_dup,
                "skipped_err": skipped_err,
                "samples": selected_records,
            }
            print(
                f"[{motif}] Curated {len(selected_records)}/{SAMPLES_PER_MOTIF} "
                f"(scanned={scanned}, small={skipped_small}, dup={skipped_dup}, err={skipped_err})"
            )

    manifest_path = OUTPUT_ROOT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nManifest written to {manifest_path}")


if __name__ == "__main__":
    curate_dataset()
