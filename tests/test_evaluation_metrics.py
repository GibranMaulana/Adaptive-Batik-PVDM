"""
test_evaluation_metrics.py
==========================
Unit & integration tests for src/evaluation_metrics.py:
  - MSE & PSNR (per-channel R, G, B and combined RGB)
  - SSIM (per-channel, combined RGB, and ITU-R BT.601 luminance Y)
  - BER (Bit Error Rate)
  - Capacity calculation (bits, bytes, max_payload_bytes, bpp, per-channel)
  - Batik texture analysis (smooth vs edge ratios, sub-range distributions)
  - FOBPMotifCounter & end-to-end evaluate_scheme()
"""

import math
import os
import pathlib
import sys

import numpy as np
from PIL import Image
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.evaluation_metrics import (
    FOBPMotifCounter,
    analyze_texture,
    compare_capacities,
    compute_ber,
    compute_capacity,
    compute_mse,
    compute_psnr,
    compute_ssim,
    evaluate_scheme,
)

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_ROOT = REPO_ROOT / "data" / "batik_512"


def _synthetic_img(h: int = 64, w: int = 64, seed: int = 7) -> np.ndarray:
    rng = np.random.default_rng(seed=seed)
    return rng.integers(0, 256, (h, w, 3), dtype=np.uint8)


class TestMSEAndPSNR:
    def test_identical_images_zero_mse_inf_psnr(self):
        img = _synthetic_img(32, 32)
        mse = compute_mse(img, img.copy())
        assert mse["mse_r"] == 0.0
        assert mse["mse_g"] == 0.0
        assert mse["mse_b"] == 0.0
        assert mse["mse_rgb"] == 0.0

        psnr = compute_psnr(img, img.copy())
        assert math.isinf(psnr["psnr_r"])
        assert math.isinf(psnr["psnr_g"])
        assert math.isinf(psnr["psnr_b"])
        assert math.isinf(psnr["psnr_rgb"])

    def test_known_channel_perturbation(self):
        cover = np.full((16, 16, 3), 100, dtype=np.uint8)
        stego = cover.copy()
        stego[:, :, 0] += 1  # MSE_R = 1
        stego[:, :, 1] += 2  # MSE_G = 4
        stego[:, :, 2] += 4  # MSE_B = 16

        psnr = compute_psnr(cover, stego)
        assert math.isclose(psnr["mse_r"], 1.0)
        assert math.isclose(psnr["mse_g"], 4.0)
        assert math.isclose(psnr["mse_b"], 16.0)
        assert math.isclose(psnr["mse_rgb"], 7.0)
        assert math.isclose(psnr["psnr_r"], 10 * math.log10(255**2 / 1.0))
        assert math.isclose(psnr["psnr_g"], 10 * math.log10(255**2 / 4.0))
        assert math.isclose(psnr["psnr_b"], 10 * math.log10(255**2 / 16.0))
        assert math.isclose(psnr["psnr_rgb"], 10 * math.log10(255**2 / 7.0))


class TestSSIM:
    def test_identical_images_ssim_one(self):
        img = _synthetic_img(64, 64)
        res = compute_ssim(img, img.copy())
        for key in ("ssim_r", "ssim_g", "ssim_b", "ssim_rgb", "ssim_y"):
            assert math.isclose(res[key], 1.0, rel_tol=1e-9)

    def test_perturbed_image_ssim_below_one(self):
        cover = _synthetic_img(64, 64)
        stego = cover.copy()
        stego[10:50, 10:50, :] = np.clip(stego[10:50, 10:50, :].astype(int) + 15, 0, 255).astype(np.uint8)
        res = compute_ssim(cover, stego)
        assert 0.0 < res["ssim_rgb"] < 1.0
        assert 0.0 < res["ssim_y"] < 1.0


class TestBER:
    def test_identical_bytes_zero_ber(self):
        data = b"Batik Nusantara PVDM HVS"
        res = compute_ber(data, data)
        assert res["ber"] == 0.0
        assert res["ber_percent"] == 0.0
        assert res["error_bits"] == 0
        assert res["total_bits"] == len(data) * 8
        assert res["is_lossless"] is True

    def test_single_bit_flip(self):
        orig = bytes([0b00000000, 0b11111111])
        extr = bytes([0b00000001, 0b11111111])
        res = compute_ber(orig, extr)
        assert res["error_bits"] == 1
        assert res["total_bits"] == 16
        assert math.isclose(res["ber"], 1 / 16)
        assert res["is_lossless"] is False

    def test_empty_bytes(self):
        res = compute_ber(b"", b"")
        assert res["ber"] == 0.0
        assert res["is_lossless"] is True


class TestCapacityAndTexture:
    def test_capacity_uniform_image_exact_bits(self):
        # Uniform image (d = 0 everywhere) of size 10x10 -> 50 pixel pairs per channel
        cover = np.full((10, 10, 3), 128, dtype=np.uint8)
        # 128 = 0b10000000 -> 2 LSBs = 00 -> Scheme 1 skips all pairs
        caps = compare_capacities(cover)
        assert caps["scheme1"]["capacity_bits"] == 0
        # Scheme 2: 3 bits/pair * 50 pairs * 3 channels = 450 bits
        assert caps["scheme2"]["capacity_bits"] == 450
        assert math.isclose(caps["scheme2"]["bpp"], 4.5)
        # Scheme 3: R=3*50=150, G=2*50=100, B=4*50=200 -> total=450 bits
        assert caps["scheme3"]["per_channel_bits"] == {"R": 150, "G": 100, "B": 200}
        assert caps["scheme3"]["capacity_bits"] == 450

    def test_texture_analysis_smooth_vs_edge(self):
        smooth = np.full((16, 16, 3), 100, dtype=np.uint8)
        tex = analyze_texture(smooth)
        assert tex["smooth_ratio"] == 1.0
        assert tex["edge_ratio"] == 0.0
        assert tex["mean_abs_diff"] == 0.0


class TestFOBPCounterAndEndToEnd:
    def test_evaluate_scheme_and_fobp_tracker_real_batik(self):
        tracker = FOBPMotifCounter()
        payload = bytes(np.random.default_rng(123).integers(0, 256, 2048, dtype=np.uint8))

        for motif in ("parang", "kawung", "megamendung"):
            img_path = sorted((DATA_ROOT / motif).glob("*.png"))[0]
            cover = Image.open(img_path).convert("RGB")
            res = evaluate_scheme(
                cover,
                payload,
                scheme="scheme3",
                motif=motif,
                image_name=img_path.name,
                fobp_tracker=tracker,
            )
            assert res["ber"]["is_lossless"] is True
            assert res["ber"]["ber"] == 0.0
            assert res["ssim"]["ssim_rgb"] > 0.99
            assert res["psnr"]["psnr_rgb"] > 40.0

        summary = tracker.summary()
        assert set(summary.keys()) == {"parang", "kawung", "megamendung"}
        for motif in ("parang", "kawung", "megamendung"):
            assert summary[motif]["scheme3"]["images_evaluated"] == 1
            assert summary[motif]["scheme3"]["total_fobp"] >= 0
