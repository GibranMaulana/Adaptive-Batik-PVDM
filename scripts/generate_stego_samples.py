#!/usr/bin/env python3
"""
generate_stego_samples.py
=========================
Generate complete lossless PNG stego samples and 300-DPI side-by-side visual
comparison figures for representative Batik images (parang_01, kawung_01,
megamendung_01) across all valid schemes and payload tiers:

  - Scheme 1 (Awate & Patil 2016) : 10 KB, Full
  - Scheme 2 (Symmetric PVDM)     : 10 KB, 50 KB, 100 KB, Full
  - Scheme 3 (Proposed HVS PVDM)  : 10 KB, 50 KB, 100 KB, Full

Uses the exact same deterministic payload (seed=2026) as run_experiments.py
so all metrics match results/tables/table2_quality_payload_per_image.csv.

Outputs
-------
  results/stego_samples/
      {motif}_01_scheme1_{10kb,full}.png
      {motif}_01_scheme2_{10kb,50kb,100kb,full}.png
      {motif}_01_scheme3_{10kb,50kb,100kb,full}.png
      stego_samples_index.csv
  results/figures/
      fig7_schemes_visual_comparison_10kb.png
      fig8_scheme3_payload_progression.png
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from src.evaluation_metrics import compare_capacities, evaluate_scheme

DATA_ROOT = REPO_ROOT / "data" / "batik_512"
STEGO_DIR = REPO_ROOT / "results" / "stego_samples"
FIG_DIR = REPO_ROOT / "results" / "figures"

MOTIFS = [
    ("parang", "Parang"),
    ("kawung", "Kawung"),
    ("megamendung", "Megamendung"),
]

# Valid payload tiers per scheme
SCHEME_TIERS: dict[str, list[tuple[str, str, int | None]]] = {
    "scheme1": [
        ("10kb", "10 KB", 10 * 1024),
        ("full", "Full", None),
    ],
    "scheme2": [
        ("10kb", "10 KB", 10 * 1024),
        ("50kb", "50 KB", 50 * 1024),
        ("100kb", "100 KB", 100 * 1024),
        ("full", "Full", None),
    ],
    "scheme3": [
        ("10kb", "10 KB", 10 * 1024),
        ("50kb", "50 KB", 50 * 1024),
        ("100kb", "100 KB", 100 * 1024),
        ("full", "Full", None),
    ],
}

# Same deterministic payload source as scripts/run_experiments.py
_MASTER_PAYLOAD = bytes(
    np.random.default_rng(seed=2026).integers(0, 256, size=1_024 * 1_024, dtype=np.uint8)
)


def main() -> None:
    STEGO_DIR.mkdir(parents=True, exist_ok=True)
    FIG_DIR.mkdir(parents=True, exist_ok=True)

    t0 = time.perf_counter()
    records: list[dict] = []
    # Store PIL images & metrics for plotting
    cache: dict[tuple[str, str, str], dict] = {}
    covers: dict[str, tuple[str, Image.Image]] = {}

    print("=== Generating Complete Stego Samples (3 Motifs x All Valid Tiers) ===", flush=True)

    for motif_key, motif_label in MOTIFS:
        img_path = sorted((DATA_ROOT / motif_key).glob("*.png"))[0]
        cover = Image.open(img_path).convert("RGB")
        covers[motif_key] = (img_path.name, cover)
        caps = compare_capacities(cover)

        for scheme_key, tiers in SCHEME_TIERS.items():
            max_payload = caps[scheme_key]["max_payload_bytes"]
            for tier_slug, tier_label, tier_bytes in tiers:
                actual_bytes = max_payload if tier_bytes is None else tier_bytes
                payload = _MASTER_PAYLOAD[:actual_bytes]

                res = evaluate_scheme(
                    cover,
                    payload,
                    scheme=scheme_key,
                    motif=motif_key,
                    image_name=img_path.name,
                )
                assert res["ber"]["is_lossless"] and res["ber"]["ber"] == 0.0, (
                    f"BER != 0 for {img_path.name} {scheme_key} {tier_label}"
                )

                out_name = f"{img_path.stem}_{scheme_key}_{tier_slug}.png"
                out_path = STEGO_DIR / out_name
                res["stego_img"].save(out_path, format="PNG")

                p = res["psnr"]
                s = res["ssim"]
                records.append({
                    "Motif": motif_label,
                    "Cover_Image": img_path.name,
                    "Scheme": scheme_key,
                    "Payload_Tier": tier_label,
                    "Payload_Bytes": actual_bytes,
                    "Stego_File": out_name,
                    "PSNR_R": round(p["psnr_r"], 4) if np.isfinite(p["psnr_r"]) else float("inf"),
                    "PSNR_G": round(p["psnr_g"], 4),
                    "PSNR_B": round(p["psnr_b"], 4),
                    "PSNR_RGB": round(p["psnr_rgb"], 4),
                    "SSIM_RGB": round(s["ssim_rgb"], 6),
                    "SSIM_Y": round(s["ssim_y"], 6),
                    "BER_%": res["ber"]["ber_percent"],
                    "FOBP_Count": res["fobp_count"],
                })
                cache[(motif_key, scheme_key, tier_slug)] = {
                    "stego": res["stego_img"].copy(),
                    "payload_bytes": actual_bytes,
                    "psnr": p,
                    "ssim": s,
                    "ber": res["ber"]["ber_percent"],
                }
                print(
                    f"  saved {out_name:34s} | {actual_bytes:6d} B | "
                    f"PSNR_RGB={p['psnr_rgb']:5.2f} dB (G={p['psnr_g']:5.2f}) | "
                    f"SSIM={s['ssim_rgb']:.5f} | BER=0.0%",
                    flush=True,
                )

    df = pd.DataFrame(records)
    index_path = STEGO_DIR / "stego_samples_index.csv"
    df.to_csv(index_path, index=False)
    print(f"\nSaved {len(records)} stego PNGs and index: {index_path}", flush=True)

    # ------------------------------------------------------------------
    # Figure 7: Cover vs Scheme 1 vs Scheme 2 vs Scheme 3 (10 KB payload)
    # ------------------------------------------------------------------
    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "font.size": 9,
        "axes.titlesize": 9.5,
        "axes.titleweight": "bold",
        "savefig.dpi": 300,
    })

    fig, axes = plt.subplots(3, 4, figsize=(15, 11.5))
    col_specs = [
        ("cover", "Cover Image"),
        ("scheme1", "Scheme 1 (Awate & Patil)"),
        ("scheme2", "Scheme 2 (Symmetric PVDM)"),
        ("scheme3", "Scheme 3 (Proposed HVS)"),
    ]

    for row_idx, (motif_key, motif_label) in enumerate(MOTIFS):
        cover_name, cover_img = covers[motif_key]
        for col_idx, (key, title_prefix) in enumerate(col_specs):
            ax = axes[row_idx, col_idx]
            if key == "cover":
                ax.imshow(np.asarray(cover_img, dtype=np.uint8))
                ax.set_title(f"{motif_label} — Cover\n({cover_name}, 512×512)")
            else:
                item = cache[(motif_key, key, "10kb")]
                p = item["psnr"]
                s = item["ssim"]
                ax.imshow(np.asarray(item["stego"], dtype=np.uint8))
                ax.set_title(
                    f"{title_prefix} (10 KB)\n"
                    f"PSNR={p['psnr_rgb']:.2f} dB (G={p['psnr_g']:.2f}) | SSIM={s['ssim_rgb']:.4f}"
                )
            ax.axis("off")

    fig.suptitle(
        "Visual Comparison of Stego Batik Images Across All Three Schemes (Payload = 10 KB, BER = 0.0%)",
        fontsize=12.5,
        fontweight="bold",
        y=0.995,
    )
    fig.tight_layout()
    fig7_path = FIG_DIR / "fig7_schemes_visual_comparison_10kb.png"
    fig.savefig(fig7_path, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved {fig7_path}", flush=True)

    # ------------------------------------------------------------------
    # Figure 8: Scheme 3 Progression (Cover | 10 KB | 50 KB | 100 KB | Full)
    # ------------------------------------------------------------------
    fig, axes = plt.subplots(3, 5, figsize=(18, 11))
    tier_specs = [
        ("cover", "Cover Image"),
        ("10kb", "10 KB"),
        ("50kb", "50 KB"),
        ("100kb", "100 KB"),
        ("full", "Full Capacity"),
    ]

    for row_idx, (motif_key, motif_label) in enumerate(MOTIFS):
        cover_name, cover_img = covers[motif_key]
        for col_idx, (t_slug, t_lbl) in enumerate(tier_specs):
            ax = axes[row_idx, col_idx]
            if t_slug == "cover":
                ax.imshow(np.asarray(cover_img, dtype=np.uint8))
                ax.set_title(f"{motif_label} — Cover\n({cover_name})")
            else:
                item = cache[(motif_key, "scheme3", t_slug)]
                p = item["psnr"]
                s = item["ssim"]
                kb = item["payload_bytes"] / 1024.0
                ax.imshow(np.asarray(item["stego"], dtype=np.uint8))
                ax.set_title(
                    f"Scheme 3 — {t_lbl} ({kb:.1f} KB)\n"
                    f"PSNR={p['psnr_rgb']:.2f} dB (G={p['psnr_g']:.2f})\n"
                    f"SSIM={s['ssim_rgb']:.4f} | BER=0.0%"
                )
            ax.axis("off")

    fig.suptitle(
        "Scheme 3 (Proposed Asymmetric HVS PVDM): Visual Quality Across Payload Variations",
        fontsize=13,
        fontweight="bold",
        y=0.995,
    )
    fig.tight_layout()
    fig8_path = FIG_DIR / "fig8_scheme3_payload_progression.png"
    fig.savefig(fig8_path, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved {fig8_path}", flush=True)

    print(f"\nDONE in {time.perf_counter() - t0:.1f}s!", flush=True)


if __name__ == "__main__":
    main()
