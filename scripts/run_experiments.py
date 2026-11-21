#!/usr/bin/env python3
"""
run_experiments.py
==================
Automated experiment & visualization runner for Output 2 of docs/md/pvdmbase.md:

Generates publication-ready tables (CSV + Markdown) and 300-DPI IEEE-style figures:
  1. Table 1 — Maximum Capacity Analysis per Channel (R, G, B, Total, bpp)
               comparing Scheme 1 (Awate & Patil 2016), Scheme 2 (Symmetric PVDM),
               and Scheme 3 (Proposed Asymmetric HVS PVDM).
  2. Table 2 — Multi-Metric Image Quality across Payload Variations
               (10 KB, 50 KB, 100 KB, Full Capacity): MSE, PSNR_R, PSNR_G,
               PSNR_B, PSNR_RGB, SSIM_RGB, SSIM_Y, BER (0% check).
  3. Table 3 — Batik Texture Density (Smooth vs Edge ratio) vs Capacity & FOBP
               occurrences across Parang, Kawung, and Megamendung motifs.
  4. Figures — Capacity comparison, PSNR per channel vs Payload, SSIM vs Payload,
               Texture vs Capacity/FOBP, and Side-by-side Cover/Stego + RGB Histograms.

Usage
-----
    python scripts/run_experiments.py                     # default: 5 samples/motif (15 images)
    python scripts/run_experiments.py --samples 3         # 3 samples/motif (9 images)
    python scripts/run_experiments.py --samples 15        # full dataset (45 images)
"""

from __future__ import annotations

import argparse
import json
import math
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

from src.evaluation_metrics import (
    FOBPMotifCounter,
    analyze_texture,
    compare_capacities,
    evaluate_scheme,
)
from src.pvdm_rgb_batik import SCHEME3_TABLES

DATA_ROOT = REPO_ROOT / "data" / "batik_512"
DEFAULT_OUT_DIR = REPO_ROOT / "results"

MOTIFS = [
    ("parang", "Parang"),
    ("kawung", "Kawung"),
    ("megamendung", "Megamendung"),
]

SCHEMES = [
    ("scheme1", "Scheme 1 (Awate & Patil 2016)"),
    ("scheme2", "Scheme 2 (Symmetric PVDM)"),
    ("scheme3", "Scheme 3 (Proposed HVS PVDM)"),
]

# Fixed payload tiers (in bytes); "full" is evaluated dynamically per image/scheme
PAYLOAD_TIERS: list[tuple[str, int | None]] = [
    ("10 KB", 10 * 1024),
    ("50 KB", 50 * 1024),
    ("100 KB", 100 * 1024),
    ("Full", None),
]

# Deterministic pseudo-random payload source (1 MB, sliced as needed)
_MASTER_PAYLOAD = bytes(
    np.random.default_rng(seed=2026).integers(0, 256, size=1_024 * 1_024, dtype=np.uint8)
)


def _get_payload(n_bytes: int) -> bytes:
    if n_bytes <= len(_MASTER_PAYLOAD):
        return _MASTER_PAYLOAD[:n_bytes]
    rng = np.random.default_rng(seed=2026)
    return bytes(rng.integers(0, 256, size=n_bytes, dtype=np.uint8))


def _df_to_markdown(df: pd.DataFrame) -> str:
    """Format a DataFrame as a GitHub-Flavored Markdown table without external deps."""
    cols = [str(c) for c in df.columns]
    lines = [
        "| " + " | ".join(cols) + " |",
        "| " + " | ".join(["---"] * len(cols)) + " |",
    ]
    for _, row in df.iterrows():
        vals = []
        for v in row:
            if isinstance(v, float):
                if math.isnan(v):
                    vals.append("N/A")
                elif math.isinf(v):
                    vals.append("inf")
                else:
                    vals.append(f"{v:.4f}" if abs(v) < 10 else f"{v:.2f}")
            elif pd.isna(v):
                vals.append("N/A")
            else:
                vals.append(str(v))
        lines.append("| " + " | ".join(vals) + " |")
    return "\n".join(lines)


def _configure_plot_style() -> None:
    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "font.size": 10,
        "axes.titlesize": 11,
        "axes.titleweight": "bold",
        "axes.labelsize": 10,
        "legend.fontsize": 8.5,
        "xtick.labelsize": 9,
        "ytick.labelsize": 9,
        "figure.dpi": 150,
        "savefig.dpi": 300,
        "axes.grid": True,
        "grid.alpha": 0.3,
        "grid.linestyle": "--",
    })


# ---------------------------------------------------------------------------
# EXPERIMENT 1: TABLE 1 — MAXIMUM CAPACITY ANALYSIS PER CHANNEL
# ---------------------------------------------------------------------------

def run_table1_capacity(samples: list[tuple[str, str, Path]]) -> tuple[pd.DataFrame, pd.DataFrame]:
    print("\n[1/4] Running Table 1: Maximum Capacity Analysis per Channel...", flush=True)
    rows = []
    for motif_key, motif_label, img_path in samples:
        cover = Image.open(img_path).convert("RGB")
        caps = compare_capacities(cover)
        for scheme_key, scheme_label in SCHEMES:
            c = caps[scheme_key]
            rows.append({
                "Motif": motif_label,
                "Image": img_path.name,
                "Scheme_Key": scheme_key,
                "Scheme": scheme_label,
                "Cap_R_Bits": c["per_channel_bits"]["R"],
                "Cap_G_Bits": c["per_channel_bits"]["G"],
                "Cap_B_Bits": c["per_channel_bits"]["B"],
                "Cap_Total_Bits": c["capacity_bits"],
                "Cap_R_Bytes": c["per_channel_bytes"]["R"],
                "Cap_G_Bytes": c["per_channel_bytes"]["G"],
                "Cap_B_Bytes": c["per_channel_bytes"]["B"],
                "Cap_Total_Bytes": c["capacity_bytes"],
                "Max_Payload_Bytes": c["max_payload_bytes"],
                "BPP": round(c["bpp"], 4),
            })

    df_per_img = pd.DataFrame(rows)

    # Summary grouped by Motif & Scheme (preserving order)
    motif_order = [m[1] for m in MOTIFS]
    scheme_order = [s[1] for s in SCHEMES]
    summary = (
        df_per_img.groupby(["Motif", "Scheme"], as_index=False)
        .agg(
            Samples=("Image", "count"),
            Mean_R_Bytes=("Cap_R_Bytes", "mean"),
            Mean_G_Bytes=("Cap_G_Bytes", "mean"),
            Mean_B_Bytes=("Cap_B_Bytes", "mean"),
            Mean_Total_Bytes=("Cap_Total_Bytes", "mean"),
            Mean_Total_Bits=("Cap_Total_Bits", "mean"),
            Mean_BPP=("BPP", "mean"),
        )
    )
    summary["Motif"] = pd.Categorical(summary["Motif"], categories=motif_order, ordered=True)
    summary["Scheme"] = pd.Categorical(summary["Scheme"], categories=scheme_order, ordered=True)
    summary = summary.sort_values(["Motif", "Scheme"]).reset_index(drop=True)

    # Add gain % of Scheme 3 vs Scheme 1 and Scheme 2 per motif
    gain_vs_s1 = []
    gain_vs_s2 = []
    for _, row in summary.iterrows():
        m = row["Motif"]
        s1_val = summary[(summary["Motif"] == m) & (summary["Scheme"] == scheme_order[0])]["Mean_Total_Bytes"].values[0]
        s2_val = summary[(summary["Motif"] == m) & (summary["Scheme"] == scheme_order[1])]["Mean_Total_Bytes"].values[0]
        val = row["Mean_Total_Bytes"]
        gain_vs_s1.append(round(((val - s1_val) / s1_val) * 100.0, 2) if s1_val > 0 else 0.0)
        gain_vs_s2.append(round(((val - s2_val) / s2_val) * 100.0, 2) if s2_val > 0 else 0.0)
    summary["Gain_vs_S1_%"] = gain_vs_s1
    summary["Gain_vs_S2_%"] = gain_vs_s2

    print("      Table 1 complete.", flush=True)
    return df_per_img, summary


# ---------------------------------------------------------------------------
# EXPERIMENT 2 & 3: TABLE 2 (QUALITY vs PAYLOAD) & TABLE 3 (TEXTURE & FOBP)
# ---------------------------------------------------------------------------

def run_table2_and_table3(
    samples: list[tuple[str, str, Path]],
    stego_dir: Path,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, dict]:
    print("\n[2/4] Running Table 2 (Quality vs Payload) & Table 3 (Texture & FOBP)...", flush=True)

    t2_rows = []
    t3_rows = []
    fobp_tracker = FOBPMotifCounter()
    visual_samples: dict[str, dict] = {}

    total_images = len(samples)
    for idx, (motif_key, motif_label, img_path) in enumerate(samples, start=1):
        t0 = time.perf_counter()
        cover = Image.open(img_path).convert("RGB")
        caps = compare_capacities(cover)
        tex = analyze_texture(cover, edge_threshold=16, tables=SCHEME3_TABLES)

        # Extreme edge (d >= 128) ratio across RGB (relevant for FOBP Case 3)
        arr = np.asarray(cover, dtype=np.int16)
        diffs = np.abs(arr[:, 0::2, :] - arr[:, 1::2, :])
        extreme_edge_ratio = float(np.mean(diffs >= 128))

        full_fobp_by_scheme: dict[str, dict] = {}

        for scheme_key, scheme_label in SCHEMES:
            max_payload = caps[scheme_key]["max_payload_bytes"]

            for tier_label, tier_bytes in PAYLOAD_TIERS:
                actual_bytes = max_payload if tier_bytes is None else tier_bytes

                if actual_bytes > max_payload:
                    t2_rows.append({
                        "Motif": motif_label,
                        "Image": img_path.name,
                        "Scheme_Key": scheme_key,
                        "Scheme": scheme_label,
                        "Payload_Tier": tier_label,
                        "Payload_Bytes": np.nan,
                        "Utilization_%": np.nan,
                        "MSE_R": np.nan,
                        "MSE_G": np.nan,
                        "MSE_B": np.nan,
                        "MSE_RGB": np.nan,
                        "PSNR_R": np.nan,
                        "PSNR_G": np.nan,
                        "PSNR_B": np.nan,
                        "PSNR_RGB": np.nan,
                        "SSIM_R": np.nan,
                        "SSIM_G": np.nan,
                        "SSIM_B": np.nan,
                        "SSIM_RGB": np.nan,
                        "SSIM_Y": np.nan,
                        "BER_%": np.nan,
                        "FOBP_Count": np.nan,
                        "FOBP_R": np.nan,
                        "FOBP_G": np.nan,
                        "FOBP_B": np.nan,
                        "Status": "Exceeds Capacity",
                    })
                    continue

                payload = _get_payload(actual_bytes)
                tracker_arg = fobp_tracker if tier_label == "Full" else None
                res = evaluate_scheme(
                    cover,
                    payload,
                    scheme=scheme_key,
                    motif=motif_key,
                    image_name=img_path.name,
                    fobp_tracker=tracker_arg,
                )

                # Hard correctness check: 100% lossless extraction required
                assert res["ber"]["is_lossless"] and res["ber"]["ber"] == 0.0, (
                    f"BER != 0 on {img_path.name} ({scheme_key}, {tier_label}): {res['ber']}"
                )

                p = res["psnr"]
                s = res["ssim"]
                f_ch = res["fobp_per_channel"]

                t2_rows.append({
                    "Motif": motif_label,
                    "Image": img_path.name,
                    "Scheme_Key": scheme_key,
                    "Scheme": scheme_label,
                    "Payload_Tier": tier_label,
                    "Payload_Bytes": actual_bytes,
                    "Utilization_%": round(res["utilization_percent"], 2),
                    "MSE_R": p["mse_r"],
                    "MSE_G": p["mse_g"],
                    "MSE_B": p["mse_b"],
                    "MSE_RGB": p["mse_rgb"],
                    "PSNR_R": p["psnr_r"],
                    "PSNR_G": p["psnr_g"],
                    "PSNR_B": p["psnr_b"],
                    "PSNR_RGB": p["psnr_rgb"],
                    "SSIM_R": s["ssim_r"],
                    "SSIM_G": s["ssim_g"],
                    "SSIM_B": s["ssim_b"],
                    "SSIM_RGB": s["ssim_rgb"],
                    "SSIM_Y": s["ssim_y"],
                    "BER_%": res["ber"]["ber_percent"],
                    "FOBP_Count": res["fobp_count"],
                    "FOBP_R": f_ch["R"],
                    "FOBP_G": f_ch["G"],
                    "FOBP_B": f_ch["B"],
                    "Status": "OK",
                })

                if tier_label == "Full":
                    full_fobp_by_scheme[scheme_key] = {
                        "total": res["fobp_count"],
                        "per_ch": dict(f_ch),
                        "used_pairs": res["used_pairs"],
                    }

                # Save first sample per motif at 50 KB (Scheme 3) for visual & histogram comparison
                if (
                    motif_key not in visual_samples
                    and scheme_key == "scheme3"
                    and tier_label == "50 KB"
                ):
                    stego_path = stego_dir / f"{img_path.stem}_scheme3_50kb.png"
                    res["stego_img"].save(stego_path, format="PNG")
                    visual_samples[motif_key] = {
                        "motif_label": motif_label,
                        "image_name": img_path.name,
                        "cover_img": cover.copy(),
                        "stego_img": res["stego_img"].copy(),
                        "stego_path": str(stego_path),
                        "payload_label": "50 KB (51,200 B)",
                        "psnr": p,
                        "ssim": s,
                        "ber": res["ber"],
                        "fobp_count": res["fobp_count"],
                    }

        # Record Table 3 row for this image
        s3_fobp = full_fobp_by_scheme["scheme3"]
        s2_fobp = full_fobp_by_scheme["scheme2"]
        s1_fobp = full_fobp_by_scheme["scheme1"]
        total_rgb_pairs = tex["total_pairs_rgb"]

        t3_rows.append({
            "Motif": motif_label,
            "Image": img_path.name,
            "Mean_Abs_Diff": round(tex["mean_abs_diff"], 4),
            "Smooth_Area_%": round(tex["smooth_ratio"] * 100.0, 2),
            "Edge_Area_%": round(tex["edge_ratio"] * 100.0, 2),
            "Extreme_Edge_ge128_%": round(extreme_edge_ratio * 100.0, 4),
            "S3_Cap_Bytes": caps["scheme3"]["capacity_bytes"],
            "S3_BPP": round(caps["scheme3"]["bpp"], 4),
            "S1_FOBP_Full": s1_fobp["total"],
            "S2_FOBP_Full": s2_fobp["total"],
            "S3_FOBP_Full": s3_fobp["total"],
            "S3_FOBP_R": s3_fobp["per_ch"]["R"],
            "S3_FOBP_G": s3_fobp["per_ch"]["G"],
            "S3_FOBP_B": s3_fobp["per_ch"]["B"],
            "S3_FOBP_Rate_%": round((s3_fobp["total"] / total_rgb_pairs) * 100.0, 4),
        })

        elapsed = time.perf_counter() - t0
        print(
            f"      [{idx:02d}/{total_images:02d}] {img_path.name:18s} "
            f"| edge={tex['edge_ratio']*100:5.1f}% | S3_cap={caps['scheme3']['capacity_bytes']:6d}B "
            f"| S3_FOBP(Full)={s3_fobp['total']:5d} | {elapsed:.1f}s",
            flush=True,
        )

    df_t2 = pd.DataFrame(t2_rows)
    df_t3 = pd.DataFrame(t3_rows)

    # Summary Table 2 (mean across images per Motif, Scheme, Payload_Tier)
    motif_order = [m[1] for m in MOTIFS]
    scheme_order = [s[1] for s in SCHEMES]
    tier_order = [t[0] for t in PAYLOAD_TIERS]

    df_t2_ok = df_t2[df_t2["Status"] == "OK"].copy()
    t2_summary = (
        df_t2_ok.groupby(["Motif", "Scheme", "Payload_Tier"], as_index=False)
        .agg(
            Mean_Payload_Bytes=("Payload_Bytes", "mean"),
            Mean_MSE_RGB=("MSE_RGB", "mean"),
            Mean_PSNR_R=("PSNR_R", "mean"),
            Mean_PSNR_G=("PSNR_G", "mean"),
            Mean_PSNR_B=("PSNR_B", "mean"),
            Mean_PSNR_RGB=("PSNR_RGB", "mean"),
            Mean_SSIM_RGB=("SSIM_RGB", "mean"),
            Mean_SSIM_Y=("SSIM_Y", "mean"),
            Max_BER_Pct=("BER_%", "max"),
            Mean_FOBP=("FOBP_Count", "mean"),
        )
    )
    t2_summary["Motif"] = pd.Categorical(t2_summary["Motif"], categories=motif_order, ordered=True)
    t2_summary["Scheme"] = pd.Categorical(t2_summary["Scheme"], categories=scheme_order, ordered=True)
    t2_summary["Payload_Tier"] = pd.Categorical(t2_summary["Payload_Tier"], categories=tier_order, ordered=True)
    t2_summary = t2_summary.sort_values(["Motif", "Scheme", "Payload_Tier"]).reset_index(drop=True)

    # Summary Table 3 (mean per motif)
    t3_summary = (
        df_t3.groupby("Motif", as_index=False)
        .agg(
            Samples=("Image", "count"),
            Mean_Abs_Diff=("Mean_Abs_Diff", "mean"),
            Smooth_Area_Pct=("Smooth_Area_%", "mean"),
            Edge_Area_Pct=("Edge_Area_%", "mean"),
            Extreme_Edge_Pct=("Extreme_Edge_ge128_%", "mean"),
            S3_Mean_Cap_Bytes=("S3_Cap_Bytes", "mean"),
            S3_Mean_BPP=("S3_BPP", "mean"),
            S1_Mean_FOBP=("S1_FOBP_Full", "mean"),
            S2_Mean_FOBP=("S2_FOBP_Full", "mean"),
            S3_Mean_FOBP=("S3_FOBP_Full", "mean"),
            S3_Mean_FOBP_R=("S3_FOBP_R", "mean"),
            S3_Mean_FOBP_G=("S3_FOBP_G", "mean"),
            S3_Mean_FOBP_B=("S3_FOBP_B", "mean"),
            S3_FOBP_Rate_Pct=("S3_FOBP_Rate_%", "mean"),
        )
    )
    t3_summary["Motif"] = pd.Categorical(t3_summary["Motif"], categories=motif_order, ordered=True)
    t3_summary = t3_summary.sort_values("Motif").reset_index(drop=True)

    # Attach FOBPMotifCounter summary into visual_samples meta
    fobp_summary_dict = fobp_tracker.summary()
    return df_t2, t2_summary, df_t3, t3_summary, {
        "visuals": visual_samples,
        "fobp_counter": fobp_summary_dict,
    }


# ---------------------------------------------------------------------------
# VISUALIZATIONS (FIGURES 1–5)
# ---------------------------------------------------------------------------

def generate_figures(
    t1_summary: pd.DataFrame,
    t2_summary: pd.DataFrame,
    t3_summary: pd.DataFrame,
    df_t3: pd.DataFrame,
    visual_samples: dict[str, dict],
    fig_dir: Path,
) -> list[Path]:
    print("\n[3/4] Generating IEEE-style Figures & Visual Histograms (300 DPI)...", flush=True)
    _configure_plot_style()
    saved_paths: list[Path] = []

    motif_labels = [m[1] for m in MOTIFS]
    scheme_labels = [s[1] for s in SCHEMES]

    # --- Figure 1: Capacity Comparison (Total & Per-Channel R/G/B) ---
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))

    # Left panel: Total Capacity (KB) by Motif & Scheme
    ax = axes[0]
    x = np.arange(len(motif_labels))
    width = 0.25
    colors = ["#7f8c8d", "#2980b9", "#27ae60"]
    short_names = ["Scheme 1 (Awate & Patil)", "Scheme 2 (Symmetric)", "Scheme 3 (Proposed HVS)"]
    for i, (sl, short, col) in enumerate(zip(scheme_labels, short_names, colors)):
        vals = [
            t1_summary[(t1_summary["Motif"] == m) & (t1_summary["Scheme"] == sl)]["Mean_Total_Bytes"].values[0] / 1024.0
            for m in motif_labels
        ]
        bars = ax.bar(x + (i - 1) * width, vals, width, label=short, color=col, edgecolor="black", linewidth=0.5)
        for bar, v in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, v + 2.5, f"{v:.1f}", ha="center", va="bottom", fontsize=7.5)
    ax.set_xticks(x)
    ax.set_xticklabels(motif_labels)
    ax.set_ylabel("Maximum Capacity (KB)")
    ax.set_title("(a) Total RGB Capacity Comparison")
    ax.set_ylim(0, max(t1_summary["Mean_Total_Bytes"]) / 1024.0 * 1.18)
    ax.legend(loc="upper right")

    # Right panel: Scheme 3 Per-Channel Capacity (R vs G vs B)
    ax = axes[1]
    s3_sub = t1_summary[t1_summary["Scheme"] == scheme_labels[2]]
    ch_colors = {"R": "#e74c3c", "G": "#2ecc71", "B": "#3498db"}
    ch_cols = [("R", "Mean_R_Bytes", "Red (6-level Std)"),
               ("G", "Mean_G_Bytes", "Green (7-level Protective)"),
               ("B", "Mean_B_Bytes", "Blue (5-level Expansive)")]
    for i, (ch, col_name, lbl) in enumerate(ch_cols):
        vals = [s3_sub[s3_sub["Motif"] == m][col_name].values[0] / 1024.0 for m in motif_labels]
        bars = ax.bar(x + (i - 1) * width, vals, width, label=lbl, color=ch_colors[ch], edgecolor="black", linewidth=0.5)
        for bar, v in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, v + 1.0, f"{v:.1f}", ha="center", va="bottom", fontsize=7.5)
    ax.set_xticks(x)
    ax.set_xticklabels(motif_labels)
    ax.set_ylabel("Channel Capacity (KB)")
    ax.set_title("(b) Scheme 3 Asymmetric Capacity per Channel")
    ax.set_ylim(0, max(s3_sub["Mean_B_Bytes"]) / 1024.0 * 1.2)
    ax.legend(loc="upper right")

    fig.tight_layout()
    p1 = fig_dir / "fig1_capacity_comparison.png"
    fig.savefig(p1, bbox_inches="tight")
    plt.close(fig)
    saved_paths.append(p1)

    # --- Figure 2: PSNR per Channel vs Payload (Scheme 3 across 3 Motifs) ---
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.6), sharey=True)
    tiers = [t[0] for t in PAYLOAD_TIERS]
    tx = np.arange(len(tiers))

    for ax, motif in zip(axes, motif_labels):
        sub = t2_summary[(t2_summary["Motif"] == motif) & (t2_summary["Scheme"] == scheme_labels[2])]
        psnr_g = [sub[sub["Payload_Tier"] == t]["Mean_PSNR_G"].values[0] for t in tiers]
        psnr_r = [sub[sub["Payload_Tier"] == t]["Mean_PSNR_R"].values[0] for t in tiers]
        psnr_b = [sub[sub["Payload_Tier"] == t]["Mean_PSNR_B"].values[0] for t in tiers]
        psnr_rgb = [sub[sub["Payload_Tier"] == t]["Mean_PSNR_RGB"].values[0] for t in tiers]

        ax.plot(tx, psnr_g, "o-", color="#27ae60", linewidth=2.2, label="PSNR_G (7-level Protected)")
        ax.plot(tx, psnr_r, "s-", color="#e74c3c", linewidth=1.8, label="PSNR_R (6-level Standard)")
        ax.plot(tx, psnr_b, "^-", color="#2980b9", linewidth=1.8, label="PSNR_B (5-level Expansive)")
        ax.plot(tx, psnr_rgb, "D--", color="#2c3e50", linewidth=1.6, label="PSNR_RGB (Combined)")

        for j, (vg, vb) in enumerate(zip(psnr_g, psnr_b)):
            ax.annotate(f"{vg:.1f}", (tx[j], vg), textcoords="offset points", xytext=(0, 6), ha="center", fontsize=7.5, color="#1e8449")
            ax.annotate(f"{vb:.1f}", (tx[j], vb), textcoords="offset points", xytext=(0, -12), ha="center", fontsize=7.5, color="#1f618d")

        ax.set_xticks(tx)
        ax.set_xticklabels(tiers)
        ax.set_xlabel("Payload Size")
        ax.set_title(f"Batik {motif}")
        if ax is axes[0]:
            ax.set_ylabel("PSNR (dB)")
            ax.legend(loc="lower left", fontsize=8)

    fig.suptitle("Scheme 3 (Proposed HVS PVDM): Per-Channel PSNR Across Payload Variations", fontsize=12, fontweight="bold", y=1.02)
    fig.tight_layout()
    p2 = fig_dir / "fig2_psnr_per_channel_vs_payload.png"
    fig.savefig(p2, bbox_inches="tight")
    plt.close(fig)
    saved_paths.append(p2)

    # --- Figure 3: SSIM vs Payload (Scheme 2 vs Scheme 3 across Motifs) ---
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.4), sharey=True)
    for ax, motif in zip(axes, motif_labels):
        for sl, short, col, marker in [
            (scheme_labels[1], "Scheme 2 (Symmetric)", "#2980b9", "s--"),
            (scheme_labels[2], "Scheme 3 (Proposed HVS)", "#27ae60", "o-"),
        ]:
            sub = t2_summary[(t2_summary["Motif"] == motif) & (t2_summary["Scheme"] == sl)]
            vals = [sub[sub["Payload_Tier"] == t]["Mean_SSIM_RGB"].values[0] for t in tiers]
            ax.plot(tx, vals, marker, color=col, linewidth=2.0, label=short)
            for j, v in enumerate(vals):
                offset = -14 if "Scheme 3" in short else 7
                ax.annotate(f"{v:.4f}", (tx[j], v), textcoords="offset points", xytext=(0, offset), ha="center", fontsize=7.2, color=col)

        # Also plot Scheme 1 available points (10 KB & Full)
        sub1 = t2_summary[(t2_summary["Motif"] == motif) & (t2_summary["Scheme"] == scheme_labels[0])]
        s1_x, s1_y = [], []
        for j, t in enumerate(tiers):
            m_row = sub1[sub1["Payload_Tier"] == t]
            if not m_row.empty:
                s1_x.append(tx[j])
                s1_y.append(m_row["Mean_SSIM_RGB"].values[0])
        if s1_x:
            ax.plot(s1_x, s1_y, "^:", color="#7f8c8d", linewidth=1.6, label="Scheme 1 (Awate & Patil)")

        ax.axhline(0.99, color="#c0392b", linestyle=":", linewidth=1.2, label="SSIM = 0.99 threshold")
        ax.set_xticks(tx)
        ax.set_xticklabels(tiers)
        ax.set_xlabel("Payload Size")
        ax.set_title(f"Batik {motif}")
        if ax is axes[0]:
            ax.set_ylabel("SSIM (RGB)")
            ax.legend(loc="lower left", fontsize=7.8)

    fig.suptitle("Structural Similarity Index (SSIM) Across Payload Variations", fontsize=12, fontweight="bold", y=1.02)
    fig.tight_layout()
    p3 = fig_dir / "fig3_ssim_vs_payload.png"
    fig.savefig(p3, bbox_inches="tight")
    plt.close(fig)
    saved_paths.append(p3)

    # --- Figure 4: Texture Density (Smooth vs Edge) & FOBP Correlation ---
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.8))

    # Left: Stacked Smooth vs Edge area per motif
    ax = axes[0]
    smooth_vals = [t3_summary[t3_summary["Motif"] == m]["Smooth_Area_Pct"].values[0] for m in motif_labels]
    edge_vals = [t3_summary[t3_summary["Motif"] == m]["Edge_Area_Pct"].values[0] for m in motif_labels]
    ax.bar(x, smooth_vals, 0.5, label="Smooth Area (d < 16)", color="#aed6f1", edgecolor="black", linewidth=0.5)
    ax.bar(x, edge_vals, 0.5, bottom=smooth_vals, label="Edge / Detail Area (d ≥ 16)", color="#2e86c1", edgecolor="black", linewidth=0.5)
    for j, (sv, ev) in enumerate(zip(smooth_vals, edge_vals)):
        ax.text(j, sv / 2, f"{sv:.1f}%", ha="center", va="center", fontsize=8.5, fontweight="bold")
        ax.text(j, sv + ev / 2, f"{ev:.1f}%", ha="center", va="center", fontsize=8.5, fontweight="bold", color="white")
    ax.set_xticks(x)
    ax.set_xticklabels(motif_labels)
    ax.set_ylabel("Pixel-Pair Proportion (%)")
    ax.set_ylim(0, 120)
    ax.set_title("(a) Batik Spatial Texture Distribution")
    ax.legend(loc="upper right")

    # Right: Mean FOBP Count (Full Payload) per Channel in Scheme 3 vs Scheme 2
    ax = axes[1]
    w2 = 0.25
    f_r = [t3_summary[t3_summary["Motif"] == m]["S3_Mean_FOBP_R"].values[0] for m in motif_labels]
    f_g = [t3_summary[t3_summary["Motif"] == m]["S3_Mean_FOBP_G"].values[0] for m in motif_labels]
    f_b = [t3_summary[t3_summary["Motif"] == m]["S3_Mean_FOBP_B"].values[0] for m in motif_labels]
    max_fobp = max(f_r + f_g + f_b)
    ax.bar(x - w2, f_r, w2, label="FOBP Red (6-level)", color="#e74c3c", edgecolor="black", linewidth=0.5)
    ax.bar(x,      f_g, w2, label="FOBP Green (7-level)", color="#2ecc71", edgecolor="black", linewidth=0.5)
    ax.bar(x + w2, f_b, w2, label="FOBP Blue (5-level)", color="#3498db", edgecolor="black", linewidth=0.5)
    for j, (vr, vg, vb) in enumerate(zip(f_r, f_g, f_b)):
        ax.text(j - w2, vr + max_fobp * 0.015, f"{vr:.0f}", ha="center", va="bottom", fontsize=7.5)
        ax.text(j,      vg + max_fobp * 0.015, f"{vg:.0f}", ha="center", va="bottom", fontsize=7.5)
        ax.text(j + w2, vb + max_fobp * 0.015, f"{vb:.0f}", ha="center", va="bottom", fontsize=7.5)
    ax.set_xticks(x)
    ax.set_xticklabels(motif_labels)
    ax.set_ylabel("Mean FOBP Events (Full Payload)")
    ax.set_ylim(0, max_fobp * 1.15)
    ax.set_title("(b) Step-4 FOBP Triggers per Channel (Scheme 3)")
    ax.legend(loc="upper left")

    fig.tight_layout()
    p4 = fig_dir / "fig4_texture_vs_capacity_fobp.png"
    fig.savefig(p4, bbox_inches="tight")
    plt.close(fig)
    saved_paths.append(p4)

    # --- Figure 5: Side-by-Side Cover vs Stego & RGB Histogram per Motif ---
    for motif_key, motif_label in MOTIFS:
        if motif_key not in visual_samples:
            continue
        vs = visual_samples[motif_key]
        cover_arr = np.asarray(vs["cover_img"], dtype=np.uint8)
        stego_arr = np.asarray(vs["stego_img"], dtype=np.uint8)
        p = vs["psnr"]
        s = vs["ssim"]

        fig, axes = plt.subplots(2, 2, figsize=(11, 9))

        # Top-Left: Cover Image
        axes[0, 0].imshow(cover_arr)
        axes[0, 0].set_title(f"Cover Image — Batik {motif_label} ({vs['image_name']})")
        axes[0, 0].axis("off")

        # Top-Right: Stego Image
        axes[0, 1].imshow(stego_arr)
        axes[0, 1].set_title(
            f"Stego Image (Scheme 3, {vs['payload_label']})\n"
            f"PSNR_RGB={p['psnr_rgb']:.2f} dB | PSNR_G={p['psnr_g']:.2f} dB | "
            f"SSIM={s['ssim_rgb']:.5f} | BER={vs['ber']['ber_percent']:.1f}%"
        )
        axes[0, 1].axis("off")

        # Bottom-Left: Cover RGB Histogram
        bins = np.arange(256)
        for ch, col, name in [(0, "#e74c3c", "Red"), (1, "#27ae60", "Green"), (2, "#2980b9", "Blue")]:
            hist_c, _ = np.histogram(cover_arr[:, :, ch], bins=256, range=(0, 256))
            axes[1, 0].plot(bins, hist_c, color=col, linewidth=1.2, alpha=0.9, label=name)
            axes[1, 0].fill_between(bins, hist_c, color=col, alpha=0.12)
        axes[1, 0].set_xlim(0, 255)
        axes[1, 0].set_xlabel("Pixel Intensity (0–255)")
        axes[1, 0].set_ylabel("Pixel Frequency")
        axes[1, 0].set_title("RGB Histogram — Cover Image")
        axes[1, 0].legend(loc="upper right")

        # Bottom-Right: Stego RGB Histogram
        for ch, col, name in [(0, "#e74c3c", "Red"), (1, "#27ae60", "Green"), (2, "#2980b9", "Blue")]:
            hist_s, _ = np.histogram(stego_arr[:, :, ch], bins=256, range=(0, 256))
            axes[1, 1].plot(bins, hist_s, color=col, linewidth=1.2, alpha=0.9, label=name)
            axes[1, 1].fill_between(bins, hist_s, color=col, alpha=0.12)
        axes[1, 1].set_xlim(0, 255)
        axes[1, 1].set_xlabel("Pixel Intensity (0–255)")
        axes[1, 1].set_ylabel("Pixel Frequency")
        axes[1, 1].set_title("RGB Histogram — Stego Image (Scheme 3)")
        axes[1, 1].legend(loc="upper right")

        # Match y-axis limits between Cover & Stego histograms for fair comparison
        ymax = max(axes[1, 0].get_ylim()[1], axes[1, 1].get_ylim()[1])
        axes[1, 0].set_ylim(0, ymax)
        axes[1, 1].set_ylim(0, ymax)

        fig.tight_layout()
        p5 = fig_dir / f"fig5_visual_histogram_{motif_key}.png"
        fig.savefig(p5, bbox_inches="tight")
        plt.close(fig)
        saved_paths.append(p5)

    # --- Figure 6: Combined 3-Motif Side-by-Side Overview (for IEEE paper) ---
    if len(visual_samples) == 3:
        fig, axes = plt.subplots(3, 3, figsize=(13, 12))
        bins = np.arange(256)
        for row_idx, (motif_key, motif_label) in enumerate(MOTIFS):
            vs = visual_samples[motif_key]
            cover_arr = np.asarray(vs["cover_img"], dtype=np.uint8)
            stego_arr = np.asarray(vs["stego_img"], dtype=np.uint8)
            p = vs["psnr"]
            s = vs["ssim"]

            axes[row_idx, 0].imshow(cover_arr)
            axes[row_idx, 0].set_title(f"{motif_label} — Cover ({vs['image_name']})")
            axes[row_idx, 0].axis("off")

            axes[row_idx, 1].imshow(stego_arr)
            axes[row_idx, 1].set_title(
                f"{motif_label} — Stego (50 KB)\n"
                f"PSNR={p['psnr_rgb']:.2f} dB (G={p['psnr_g']:.2f}) | SSIM={s['ssim_rgb']:.4f}"
            )
            axes[row_idx, 1].axis("off")

            # Overlay Cover (solid) vs Stego (dashed) RGB histograms
            for ch, col, name in [(0, "#e74c3c", "R"), (1, "#27ae60", "G"), (2, "#2980b9", "B")]:
                hc, _ = np.histogram(cover_arr[:, :, ch], bins=256, range=(0, 256))
                hs, _ = np.histogram(stego_arr[:, :, ch], bins=256, range=(0, 256))
                axes[row_idx, 2].plot(bins, hc, color=col, linewidth=1.2, alpha=0.85, label=f"{name} Cover")
                axes[row_idx, 2].plot(bins, hs, color=col, linewidth=1.0, linestyle="--", alpha=0.85, label=f"{name} Stego")
            axes[row_idx, 2].set_xlim(0, 255)
            axes[row_idx, 2].set_title(f"{motif_label} — RGB Histogram Overlay")
            axes[row_idx, 2].set_xlabel("Intensity")
            axes[row_idx, 2].set_ylabel("Frequency")
            if row_idx == 0:
                axes[row_idx, 2].legend(ncol=2, fontsize=7, loc="upper right")

        fig.tight_layout()
        p6 = fig_dir / "fig6_combined_visual_comparison.png"
        fig.savefig(p6, bbox_inches="tight")
        plt.close(fig)
        saved_paths.append(p6)

    print(f"      Generated {len(saved_paths)} figures in {fig_dir}", flush=True)
    return saved_paths


# ---------------------------------------------------------------------------
# MARKDOWN REPORT GENERATOR (READY FOR BAB IV JURNAL)
# ---------------------------------------------------------------------------

def write_markdown_report(
    out_path: Path,
    samples_per_motif: int,
    t1_summary: pd.DataFrame,
    t2_summary: pd.DataFrame,
    t3_summary: pd.DataFrame,
    df_t3: pd.DataFrame,
    fobp_counter_summary: dict,
) -> None:
    corr_edge_cap = float(df_t3["Edge_Area_%"].corr(df_t3["S3_BPP"]))
    corr_edge_fobp = float(df_t3["Edge_Area_%"].corr(df_t3["S3_FOBP_Full"]))

    s3_t2 = t2_summary[t2_summary["Scheme"] == SCHEMES[2][1]].copy()
    psnr_g_highest_all = bool(
        ((s3_t2["Mean_PSNR_G"] > s3_t2["Mean_PSNR_R"]) & (s3_t2["Mean_PSNR_G"] > s3_t2["Mean_PSNR_B"])).all()
    )

    md_parts = [
        "# Laporan Hasil Eksperimen PVDM RGB Asimetris Berbasis HVS (Output 2)",
        "",
        f"- **Dataset:** Citra Batik Nusantara 512×512 (24-bit RGB PNG) — `{samples_per_motif}` sampel per motif (`{samples_per_motif * 3}` citra total: Parang, Kawung, Megamendung).",
        "- **Skema Uji:** Skema 1 (*Awate & Patil 2016*), Skema 2 (*Symmetric 6-level PVDM*), Skema 3 (*Proposed Asymmetric HVS PVDM: Green 7-level, Red 6-level, Blue 5-level*).",
        "- **Verifikasi Lossless:** Seluruh skema & ukuran payload terverifikasi `BER = 0.0%`.",
        f"- **Validasi Hipotesis HVS (Skema 3):** $\\text{{PSNR}}_G$ selalu tertinggi ($\\text{{PSNR}}_G > \\max(\\text{{PSNR}}_R, \\text{{PSNR}}_B)$) pada semua tier & motif: **`{psnr_g_highest_all}`**.",
        "",
        "---",
        "",
        "## Tabel 1 — Analisis Kapasitas Maksimum per Kanal (Rata-rata per Motif)",
        "",
        _df_to_markdown(t1_summary),
        "",
        "---",
        "",
        "## Tabel 2 — Evaluasi Kualitas Citra Multimetrik pada Variasi Payload (Rata-rata per Motif)",
        "",
        "> Catatan: Pada Skema 1 (*Awate & Patil 2016*), payload 50 KB dan 100 KB melebihi kapasitas maksimum (~25–30 KB) sehingga hanya 10 KB dan Full Capacity yang dapat disisipkan.",
        "",
        _df_to_markdown(t2_summary),
        "",
        "---",
        "",
        "## Tabel 3 — Korelasi Kerapatan Tekstur Batik terhadap Kapasitas & Kasus FOBP (Full Payload)",
        "",
        _df_to_markdown(t3_summary),
        "",
        f"- **Korelasi Pearson (`Edge_Area_%` vs `S3_BPP`):** `r = {corr_edge_cap:.4f}` (semakin rapat tepi motif Batik, semakin besar kapasitas penyisipan).",
        f"- **Korelasi Pearson (`Edge_Area_%` vs `S3_FOBP_Full`):** `r = {corr_edge_fobp:.4f}`.",
        "",
        "---",
        "",
        "## Ringkasan Pencatat FOBP Otomatis (`FOBPMotifCounter` — Full Payload)",
        "",
        "```json",
        json.dumps(fobp_counter_summary, indent=2),
        "```",
        "",
    ]
    out_path.write_text("\n".join(md_parts), encoding="utf-8")


# ---------------------------------------------------------------------------
# MAIN CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Run Batik PVDM RGB experiments (Output 2).")
    parser.add_argument(
        "--samples",
        type=int,
        default=5,
        help="Number of images per motif to evaluate (default: 5; max: 15).",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Output directory for tables, figures, and sample stego images.",
    )
    args = parser.parse_args()

    out_dir: Path = args.out_dir
    tables_dir = out_dir / "tables"
    fig_dir = out_dir / "figures"
    stego_dir = out_dir / "stego_samples"
    for d in (tables_dir, fig_dir, stego_dir):
        d.mkdir(parents=True, exist_ok=True)

    # Collect deterministic sample list
    samples: list[tuple[str, str, Path]] = []
    for motif_key, motif_label in MOTIFS:
        pngs = sorted((DATA_ROOT / motif_key).glob("*.png"))[: args.samples]
        if not pngs:
            raise FileNotFoundError(f"No PNGs found in {DATA_ROOT / motif_key}")
        for p in pngs:
            samples.append((motif_key, motif_label, p))

    t_start = time.perf_counter()
    print(
        f"=== Adaptive Batik PVDM Experiment Runner ===\n"
        f"Samples: {len(samples)} images ({args.samples}/motif) | Output: {out_dir}",
        flush=True,
    )

    # Table 1
    df_t1_img, df_t1_sum = run_table1_capacity(samples)
    df_t1_img.to_csv(tables_dir / "table1_capacity_per_image.csv", index=False)
    df_t1_sum.to_csv(tables_dir / "table1_capacity_summary.csv", index=False)

    # Table 2 & Table 3
    df_t2_img, df_t2_sum, df_t3_img, df_t3_sum, meta = run_table2_and_table3(samples, stego_dir)
    df_t2_img.to_csv(tables_dir / "table2_quality_payload_per_image.csv", index=False)
    df_t2_sum.to_csv(tables_dir / "table2_quality_payload_summary.csv", index=False)
    df_t3_img.to_csv(tables_dir / "table3_texture_fobp_per_image.csv", index=False)
    df_t3_sum.to_csv(tables_dir / "table3_texture_fobp_summary.csv", index=False)

    # Figures
    generate_figures(
        t1_summary=df_t1_sum,
        t2_summary=df_t2_sum,
        t3_summary=df_t3_sum,
        df_t3=df_t3_img,
        visual_samples=meta["visuals"],
        fig_dir=fig_dir,
    )

    # Markdown report
    print("\n[4/4] Writing Markdown experiment report...", flush=True)
    report_path = tables_dir / "experiment_report.md"
    write_markdown_report(
        out_path=report_path,
        samples_per_motif=args.samples,
        t1_summary=df_t1_sum,
        t2_summary=df_t2_sum,
        t3_summary=df_t3_sum,
        df_t3=df_t3_img,
        fobp_counter_summary=meta["fobp_counter"],
    )

    total_time = time.perf_counter() - t_start
    print(f"\nDONE in {total_time:.1f}s! Report written to: {report_path}", flush=True)


if __name__ == "__main__":
    main()
