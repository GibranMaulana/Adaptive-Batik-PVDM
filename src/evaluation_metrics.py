"""
evaluation_metrics.py
=====================
Image quality, capacity, fidelity (BER), texture, and FOBP evaluation module
for RGB Batik PVDM steganography (docs/md/pvdmbase.md Section 5 - Output 1.2).

Metrics implemented
-------------------
1. Capacity Analysis:
   - Total & per-channel (R, G, B) capacity in bits, bytes, max_payload_bytes, and bpp
   - Supports Scheme 1, Scheme 2, and Scheme 3

2. Image Distortion & Visual Quality:
   - MSE per channel (MSE_R, MSE_G, MSE_B) and combined RGB (MSE_RGB)
   - PSNR per channel (PSNR_R, PSNR_G, PSNR_B) and combined RGB (PSNR_RGB)
   - SSIM (Structural Similarity Index Measure — Wang et al., 2004)
     per channel (SSIM_R, SSIM_G, SSIM_B), combined RGB (SSIM_RGB), and
     ITU-R BT.601 luminance channel (SSIM_Y)

3. Extraction Fidelity:
   - BER (Bit Error Rate) and bit-error count to verify 100% lossless (BER = 0%)

4. Texture & FOBP Analysis (for Batik motifs: Parang, Kawung, Megamendung):
   - Distribution of adjacent pixel differences d = |P_x - P_y|
   - Smooth vs. edge pair ratios and per-sub-range histograms
   - Automated FOBPMotifCounter tracking Step-4 FOBP occurrences per motif
   - End-to-end `evaluate_scheme(...)` runner returning a complete metrics report
"""

from __future__ import annotations

import math
from typing import Union

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

from src.pvdm_core import (
    RANGE_TABLE_RED,
    RANGE_TABLE_GREEN_HVS,
    RANGE_TABLE_BLUE_HVS,
    RangeEntry,
)
from src.pvdm_rgb_batik import (
    CHANNEL_NAMES,
    SCHEME2_TABLES,
    SCHEME3_TABLES,
    scheme1_capacity,
    scheme1_embed,
    scheme1_extract,
    scheme2_capacity,
    scheme2_embed,
    scheme2_extract,
    scheme3_capacity,
    scheme3_embed,
    scheme3_extract,
)

ImageLike = Union[Image.Image, np.ndarray]

# ITU-R BT.601-7 luminance coefficients (Section 3.A of pvdmbase.md)
BT601_R = 0.299
BT601_G = 0.587
BT601_B = 0.114

_SCHEME_REGISTRY = {
    "scheme1": (scheme1_embed, scheme1_extract, scheme1_capacity),
    "scheme2": (scheme2_embed, scheme2_extract, scheme2_capacity),
    "scheme3": (scheme3_embed, scheme3_extract, scheme3_capacity),
}


def _to_rgb_float64(img: ImageLike) -> np.ndarray:
    """Convert PIL Image or H×W×3 ndarray to float64 RGB array in [0, 255]."""
    if isinstance(img, np.ndarray):
        arr = np.asarray(img, dtype=np.float64)
        if arr.ndim != 3 or arr.shape[2] != 3:
            raise ValueError(f"Expected H×W×3 RGB array, got shape {arr.shape}.")
        return arr
    if isinstance(img, Image.Image):
        return np.asarray(img.convert("RGB"), dtype=np.float64)
    raise TypeError(f"Expected PIL.Image or numpy.ndarray, got {type(img)}.")


def _validate_pair_shapes(cover: np.ndarray, stego: np.ndarray) -> None:
    if cover.shape != stego.shape:
        raise ValueError(
            f"Cover shape {cover.shape} does not match stego shape {stego.shape}."
        )


# ---------------------------------------------------------------------------
# 1. CAPACITY METRICS
# ---------------------------------------------------------------------------

def compute_capacity(cover_img: ImageLike, scheme: str = "scheme3") -> dict:
    """
    Compute maximum embedding capacity (bits, bytes, max_payload_bytes, bpp,
    and per-channel R/G/B breakdown) for the specified scheme.

    Parameters
    ----------
    cover_img : PIL Image or H×W×3 ndarray
    scheme    : 'scheme1' | 'scheme2' | 'scheme3'
    """
    key = scheme.lower().strip()
    if key not in _SCHEME_REGISTRY:
        raise ValueError(
            f"Unknown scheme '{scheme}'. Expected one of {list(_SCHEME_REGISTRY)}."
        )
    _, _, cap_fn = _SCHEME_REGISTRY[key]
    return cap_fn(cover_img)


def compare_capacities(cover_img: ImageLike) -> dict[str, dict]:
    """Compute maximum capacities for all 3 schemes on the same cover image."""
    return {
        "scheme1": scheme1_capacity(cover_img),
        "scheme2": scheme2_capacity(cover_img),
        "scheme3": scheme3_capacity(cover_img),
    }


# ---------------------------------------------------------------------------
# 2. MSE & PSNR (per-channel R, G, B and combined RGB)
# ---------------------------------------------------------------------------

def compute_mse(cover_img: ImageLike, stego_img: ImageLike) -> dict[str, float]:
    """
    Compute Mean Squared Error (MSE) per channel (R, G, B) and combined RGB.

    Returns
    -------
    dict with keys: 'mse_r', 'mse_g', 'mse_b', 'mse_rgb'
    """
    c = _to_rgb_float64(cover_img)
    s = _to_rgb_float64(stego_img)
    _validate_pair_shapes(c, s)

    diff_sq = (c - s) ** 2
    mse_r = float(np.mean(diff_sq[:, :, 0]))
    mse_g = float(np.mean(diff_sq[:, :, 1]))
    mse_b = float(np.mean(diff_sq[:, :, 2]))
    mse_rgb = float(np.mean(diff_sq))  # == (mse_r + mse_g + mse_b) / 3

    return {
        "mse_r": mse_r,
        "mse_g": mse_g,
        "mse_b": mse_b,
        "mse_rgb": mse_rgb,
    }


def _mse_to_psnr(mse: float, max_val: float = 255.0) -> float:
    if mse == 0.0:
        return float("inf")
    return float(10.0 * math.log10((max_val ** 2) / mse))


def compute_psnr(
    cover_img: ImageLike,
    stego_img: ImageLike,
    max_val: float = 255.0,
) -> dict[str, float]:
    """
    Compute Peak Signal-to-Noise Ratio (PSNR, in dB) per channel (R, G, B)
    and combined RGB, along with the underlying MSE values.

    Formula: PSNR = 10 * log10(255^2 / MSE)

    Returns
    -------
    dict with keys:
        'psnr_r', 'psnr_g', 'psnr_b', 'psnr_rgb',
        'mse_r',  'mse_g',  'mse_b',  'mse_rgb'
    """
    mse = compute_mse(cover_img, stego_img)
    return {
        "psnr_r": _mse_to_psnr(mse["mse_r"], max_val),
        "psnr_g": _mse_to_psnr(mse["mse_g"], max_val),
        "psnr_b": _mse_to_psnr(mse["mse_b"], max_val),
        "psnr_rgb": _mse_to_psnr(mse["mse_rgb"], max_val),
        **mse,
    }


# ---------------------------------------------------------------------------
# 3. SSIM (Structural Similarity Index Measure — Wang et al., 2004)
# ---------------------------------------------------------------------------

def _ssim_2d(
    img1: np.ndarray,
    img2: np.ndarray,
    data_range: float = 255.0,
    sigma: float = 1.5,
    k1: float = 0.01,
    k2: float = 0.03,
) -> float:
    """
    Compute 2D single-channel SSIM (Wang et al., 2004) using an 11×11 Gaussian
    window (sigma=1.5, truncate=3.5), matching scikit-image's Gaussian SSIM.
    """
    c1 = (k1 * data_range) ** 2
    c2 = (k2 * data_range) ** 2

    # truncate=3.5 with sigma=1.5 yields radius=round(3.5*1.5)=5 -> 11x11 kernel
    truncate = 3.5
    filter_kwargs = {"sigma": sigma, "truncate": truncate, "mode": "reflect"}

    mu1 = gaussian_filter(img1, **filter_kwargs)
    mu2 = gaussian_filter(img2, **filter_kwargs)

    mu1_sq = mu1 * mu1
    mu2_sq = mu2 * mu2
    mu1_mu2 = mu1 * mu2

    sigma1_sq = np.maximum(0.0, gaussian_filter(img1 * img1, **filter_kwargs) - mu1_sq)
    sigma2_sq = np.maximum(0.0, gaussian_filter(img2 * img2, **filter_kwargs) - mu2_sq)
    sigma12 = gaussian_filter(img1 * img2, **filter_kwargs) - mu1_mu2

    numerator = (2.0 * mu1_mu2 + c1) * (2.0 * sigma12 + c2)
    denominator = (mu1_sq + mu2_sq + c1) * (sigma1_sq + sigma2_sq + c2)
    ssim_map = numerator / denominator

    # Crop border by filter radius (5 px) if image is large enough, matching
    # Wang et al. (2004) valid-window averaging.
    pad = 5
    h, w = img1.shape
    if h > 2 * pad and w > 2 * pad:
        ssim_map = ssim_map[pad:-pad, pad:-pad]

    return float(np.mean(ssim_map))


def compute_ssim(
    cover_img: ImageLike,
    stego_img: ImageLike,
    data_range: float = 255.0,
) -> dict[str, float]:
    """
    Compute SSIM per channel (R, G, B), combined RGB average, and ITU-R BT.601
    luminance channel (Y = 0.299R + 0.587G + 0.114B).

    Returns
    -------
    dict with keys: 'ssim_r', 'ssim_g', 'ssim_b', 'ssim_rgb', 'ssim_y'
    """
    c = _to_rgb_float64(cover_img)
    s = _to_rgb_float64(stego_img)
    _validate_pair_shapes(c, s)

    ssim_r = _ssim_2d(c[:, :, 0], s[:, :, 0], data_range=data_range)
    ssim_g = _ssim_2d(c[:, :, 1], s[:, :, 1], data_range=data_range)
    ssim_b = _ssim_2d(c[:, :, 2], s[:, :, 2], data_range=data_range)
    ssim_rgb = (ssim_r + ssim_g + ssim_b) / 3.0

    # Luminance channel per ITU-R BT.601-7
    y_c = BT601_R * c[:, :, 0] + BT601_G * c[:, :, 1] + BT601_B * c[:, :, 2]
    y_s = BT601_R * s[:, :, 0] + BT601_G * s[:, :, 1] + BT601_B * s[:, :, 2]
    ssim_y = _ssim_2d(y_c, y_s, data_range=data_range)

    return {
        "ssim_r": ssim_r,
        "ssim_g": ssim_g,
        "ssim_b": ssim_b,
        "ssim_rgb": ssim_rgb,
        "ssim_y": ssim_y,
    }


# ---------------------------------------------------------------------------
# 4. BER (Bit Error Rate)
# ---------------------------------------------------------------------------

def compute_ber(original: bytes, extracted: bytes) -> dict[str, float | int | bool]:
    """
    Compute Bit Error Rate (BER) between original and extracted secret payloads.

    Returns
    -------
    dict with keys:
        'ber'         : float in [0.0, 1.0] (0.0 means 100% lossless)
        'ber_percent' : float in [0.0, 100.0]
        'error_bits'  : int
        'total_bits'  : int
        'is_lossless' : bool (True iff error_bits == 0 and lengths match)
    """
    orig_len = len(original)
    extr_len = len(extracted)
    max_len = max(orig_len, extr_len)

    if max_len == 0:
        return {
            "ber": 0.0,
            "ber_percent": 0.0,
            "error_bits": 0,
            "total_bits": 0,
            "is_lossless": True,
        }

    min_len = min(orig_len, extr_len)
    error_bits = 0
    for i in range(min_len):
        error_bits += (original[i] ^ extracted[i]).bit_count()

    # Any missing or trailing extra bytes count as 8 bit errors each
    error_bits += (max_len - min_len) * 8
    total_bits = max_len * 8
    ber = error_bits / total_bits

    return {
        "ber": float(ber),
        "ber_percent": float(ber * 100.0),
        "error_bits": int(error_bits),
        "total_bits": int(total_bits),
        "is_lossless": (error_bits == 0 and orig_len == extr_len),
    }


# ---------------------------------------------------------------------------
# 5. TEXTURE & PIXEL-DIFFERENCE DISTRIBUTION ANALYSIS
# ---------------------------------------------------------------------------

def analyze_texture(
    cover_img: ImageLike,
    edge_threshold: int = 16,
    tables: tuple[list[RangeEntry], list[RangeEntry], list[RangeEntry]] = SCHEME3_TABLES,
) -> dict:
    """
    Analyze Batik image spatial texture via horizontal pixel-pair differences
    d = |P_(i,x) - P_(i,y)| across R, G, and B channels.

    Parameters
    ----------
    cover_img      : PIL Image or H×W×3 ndarray
    edge_threshold : threshold separating smooth area (d < threshold) from
                     edge/detail area (d >= threshold). Default 16 matches
                     Wang et al. sub-range boundary R_smooth=[0,15] vs R_edge=[16,255].
    tables         : 3-tuple of RangeEntry tables for sub-range breakdown
                     (defaults to Scheme 3 HVS asymmetric tables).

    Returns
    -------
    dict containing overall & per-channel:
        - total_pairs_per_channel, total_pairs_rgb
        - mean_abs_diff, mean_abs_diff_per_channel
        - smooth_pairs, edge_pairs, smooth_ratio, edge_ratio
        - smooth_ratio_per_channel, edge_ratio_per_channel
        - range_distribution (per-channel count & ratio per sub-range [low, high])
    """
    arr = _to_rgb_float64(cover_img).astype(np.int16)
    H, W, _ = arr.shape
    w_even = W - (W % 2)

    p0 = arr[:, 0:w_even:2, :]
    p1 = arr[:, 1:w_even:2, :]
    diffs = np.abs(p0 - p1)  # shape (H, W//2, 3)

    pairs_per_ch = int(diffs.shape[0] * diffs.shape[1])
    total_pairs_rgb = pairs_per_ch * 3

    mean_diff_per_ch: dict[str, float] = {}
    smooth_ratio_per_ch: dict[str, float] = {}
    edge_ratio_per_ch: dict[str, float] = {}
    range_distribution: dict[str, list[dict]] = {}

    for ch, ch_name in enumerate(CHANNEL_NAMES):
        d_ch = diffs[:, :, ch]
        mean_diff_per_ch[ch_name] = float(np.mean(d_ch)) if pairs_per_ch > 0 else 0.0
        n_smooth = int(np.count_nonzero(d_ch < edge_threshold))
        n_edge = pairs_per_ch - n_smooth
        smooth_ratio_per_ch[ch_name] = n_smooth / pairs_per_ch if pairs_per_ch > 0 else 0.0
        edge_ratio_per_ch[ch_name] = n_edge / pairs_per_ch if pairs_per_ch > 0 else 0.0

        dist = []
        for idx, entry in enumerate(tables[ch], start=1):
            cnt = int(np.count_nonzero((d_ch >= entry.low) & (d_ch <= entry.high)))
            dist.append({
                "level": f"R{idx}",
                "range": [entry.low, entry.high],
                "width": entry.width,
                "bits": entry.bits,
                "count": cnt,
                "ratio": cnt / pairs_per_ch if pairs_per_ch > 0 else 0.0,
            })
        range_distribution[ch_name] = dist

    total_smooth = int(np.count_nonzero(diffs < edge_threshold))
    total_edge = total_pairs_rgb - total_smooth

    return {
        "edge_threshold": edge_threshold,
        "total_pairs_per_channel": pairs_per_ch,
        "total_pairs_rgb": total_pairs_rgb,
        "mean_abs_diff": float(np.mean(diffs)) if total_pairs_rgb > 0 else 0.0,
        "mean_abs_diff_per_channel": mean_diff_per_ch,
        "smooth_pairs": total_smooth,
        "edge_pairs": total_edge,
        "smooth_ratio": total_smooth / total_pairs_rgb if total_pairs_rgb > 0 else 0.0,
        "edge_ratio": total_edge / total_pairs_rgb if total_pairs_rgb > 0 else 0.0,
        "smooth_ratio_per_channel": smooth_ratio_per_ch,
        "edge_ratio_per_channel": edge_ratio_per_ch,
        "range_distribution": range_distribution,
    }


# ---------------------------------------------------------------------------
# 6. AUTOMATED FOBP COUNTER PER BATIK MOTIF
# ---------------------------------------------------------------------------

class FOBPMotifCounter:
    """
    Automated counter tracking Falling-Off-Boundary Problem (FOBP) occurrences
    grouped by Batik motif (e.g. 'parang', 'kawung', 'megamendung') and scheme.
    """

    def __init__(self) -> None:
        self._records: dict[str, dict[str, dict]] = {}

    def record(
        self,
        motif: str,
        scheme: str,
        fobp_count: int,
        fobp_per_channel: dict[str, int] | None = None,
        used_pairs: int = 0,
        image_name: str | None = None,
    ) -> None:
        """Record FOBP counts from a single embedding run."""
        motif_key = motif.lower().strip()
        scheme_key = scheme.lower().strip()

        motif_bucket = self._records.setdefault(motif_key, {})
        entry = motif_bucket.setdefault(
            scheme_key,
            {
                "images_evaluated": 0,
                "total_fobp": 0,
                "per_channel_fobp": {"R": 0, "G": 0, "B": 0},
                "total_used_pairs": 0,
                "per_image": [],
            },
        )

        entry["images_evaluated"] += 1
        entry["total_fobp"] += int(fobp_count)
        entry["total_used_pairs"] += int(used_pairs)

        if fobp_per_channel:
            for ch in CHANNEL_NAMES:
                entry["per_channel_fobp"][ch] += int(fobp_per_channel.get(ch, 0))

        entry["per_image"].append({
            "image": image_name or f"{motif_key}_{entry['images_evaluated']:02d}",
            "fobp_count": int(fobp_count),
            "fobp_per_channel": dict(fobp_per_channel) if fobp_per_channel else None,
            "used_pairs": int(used_pairs),
        })

    def summary(self) -> dict[str, dict[str, dict]]:
        """Return aggregated FOBP statistics per motif and scheme."""
        out: dict[str, dict[str, dict]] = {}
        for motif, schemes in self._records.items():
            out[motif] = {}
            for scheme, data in schemes.items():
                n = data["images_evaluated"]
                used = data["total_used_pairs"]
                out[motif][scheme] = {
                    "images_evaluated": n,
                    "total_fobp": data["total_fobp"],
                    "mean_fobp_per_image": data["total_fobp"] / n if n > 0 else 0.0,
                    "per_channel_fobp": dict(data["per_channel_fobp"]),
                    "total_used_pairs": used,
                    "fobp_rate_percent": (
                        (data["total_fobp"] / (used * 3)) * 100.0
                        if used > 0 and scheme != "scheme1"
                        else ((data["total_fobp"] / used) * 100.0 if used > 0 else 0.0)
                    ),
                }
        return out

    def reset(self) -> None:
        """Clear all accumulated FOBP records."""
        self._records.clear()


# ---------------------------------------------------------------------------
# 7. END-TO-END EVALUATION HELPER
# ---------------------------------------------------------------------------

def evaluate_scheme(
    cover_img: ImageLike,
    payload: bytes,
    scheme: str = "scheme3",
    motif: str | None = None,
    image_name: str | None = None,
    fobp_tracker: FOBPMotifCounter | None = None,
) -> dict:
    """
    Run full embed -> extract -> metric evaluation pipeline for a given scheme.

    Computes capacity, MSE, PSNR (R, G, B, RGB), SSIM (R, G, B, RGB, Y),
    BER (lossless check), FOBP count, and texture stats in a single call.

    Parameters
    ----------
    cover_img    : PIL Image or H×W×3 ndarray
    payload      : Secret message bytes
    scheme       : 'scheme1' | 'scheme2' | 'scheme3'
    motif        : Optional Batik motif label ('parang', 'kawung', 'megamendung')
    image_name   : Optional identifier for FOBP logging
    fobp_tracker : Optional FOBPMotifCounter instance to accumulate FOBP counts

    Returns
    -------
    dict with full evaluation metrics and the generated `stego_img`
    """
    key = scheme.lower().strip()
    if key not in _SCHEME_REGISTRY:
        raise ValueError(
            f"Unknown scheme '{scheme}'. Expected one of {list(_SCHEME_REGISTRY)}."
        )

    embed_fn, extract_fn, cap_fn = _SCHEME_REGISTRY[key]

    cap = cap_fn(cover_img)
    stego_img, embed_stats = embed_fn(cover_img, payload)
    recovered, extract_stats = extract_fn(stego_img)

    psnr_metrics = compute_psnr(cover_img, stego_img)
    ssim_metrics = compute_ssim(cover_img, stego_img)
    ber_metrics = compute_ber(payload, recovered)

    tables = SCHEME3_TABLES if key == "scheme3" else SCHEME2_TABLES
    texture = analyze_texture(cover_img, tables=tables)

    if fobp_tracker is not None and motif is not None:
        fobp_tracker.record(
            motif=motif,
            scheme=key,
            fobp_count=embed_stats["fobp_count"],
            fobp_per_channel=embed_stats.get("fobp_per_channel"),
            used_pairs=embed_stats.get("used_pairs", 0),
            image_name=image_name,
        )

    return {
        "scheme": key,
        "motif": motif,
        "image_name": image_name,
        "payload_bytes": len(payload),
        "payload_bits": embed_stats["payload_bits"],
        "utilization_percent": (
            (embed_stats["payload_bits"] / cap["capacity_bits"]) * 100.0
            if cap["capacity_bits"] > 0
            else 0.0
        ),
        "capacity": cap,
        "psnr": psnr_metrics,
        "ssim": ssim_metrics,
        "ber": ber_metrics,
        "fobp_count": embed_stats["fobp_count"],
        "fobp_per_channel": embed_stats.get("fobp_per_channel", {"R": 0, "G": 0, "B": 0}),
        "used_pairs": embed_stats.get("used_pairs", 0),
        "extracted_bits": extract_stats.get("extracted_bits", 0),
        "texture": texture,
        "stego_img": stego_img,
    }
