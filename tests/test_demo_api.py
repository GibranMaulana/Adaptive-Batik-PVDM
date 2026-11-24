"""Integration tests for the Demo Phase 1 FastAPI backend."""

from __future__ import annotations

import base64
import io

from fastapi.testclient import TestClient
from PIL import Image

from demo.backend.app import app
from src.evaluation_metrics import compute_ber


client = TestClient(app)


def _embed(message: str) -> dict:
    response = client.post(
        "/api/embed",
        json={"motif": "parang", "filename": "parang_01.png", "message": message},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _png_from_result(result: dict, key: str) -> Image.Image:
    raw = base64.b64decode(result[key])
    with Image.open(io.BytesIO(raw)) as image:
        return image.copy()


def test_samples_catalog_has_all_45_batik_images_and_capacities():
    response = client.get("/api/samples")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 45
    assert {sample["motif"] for sample in body["samples"]} == {"parang", "kawung", "megamendung"}
    assert all(set(sample["capacities"]) == {"scheme1", "scheme2", "scheme3"} for sample in body["samples"])


def test_sample_endpoint_returns_lossless_rgb_png():
    response = client.get("/api/samples/parang/parang_01.png")
    assert response.status_code == 200
    with Image.open(io.BytesIO(response.content)) as image:
        assert image.format == "PNG"
        assert image.mode == "RGB"
        assert image.size == (512, 512)


def test_embed_and_auto_extract_each_scheme_through_saved_rgb_png_roundtrip(tmp_path):
    message = "Demo PVDM Batik — pesan UTF-8"
    body = _embed(message)
    assert body["payload_bytes"] == len(message.encode("utf-8"))

    for result in body["results"]:
        assert result["status"] == "ok", result
        stego = _png_from_result(result, "stego_png_base64")
        heatmap = _png_from_result(result, "heatmap_png_base64")
        assert stego.mode == "RGB"
        assert heatmap.mode == "RGB"
        assert max(heatmap.getextrema()[channel][1] for channel in range(3)) <= 255

        saved_png = tmp_path / f"{result['scheme']}.png"
        saved_png.write_bytes(base64.b64decode(result["stego_png_base64"]))
        encoded = saved_png.read_bytes()
        response = client.post(
            "/api/extract",
            files={"file": (saved_png.name, encoded, "image/png")},
        )
        assert response.status_code == 200, response.text
        extracted = response.json()
        assert extracted["auto_detected"] is True
        assert extracted["selected_scheme"] == result["scheme"]
        candidate = next(item for item in extracted["candidates"] if item["scheme"] == result["scheme"])
        assert candidate["message"] == message
        assert compute_ber(message.encode("utf-8"), candidate["message"].encode("utf-8"))["ber"] == 0.0


def test_50kb_scheme1_overflow_and_scheme2_3_saved_png_roundtrip(tmp_path):
    message = "A" * (50 * 1024)
    body = _embed(message)
    outcomes = {result["scheme"]: result for result in body["results"]}
    assert outcomes["scheme1"]["status"] == "overflow"
    for scheme in ("scheme2", "scheme3"):
        result = outcomes[scheme]
        assert result["status"] == "ok", result
        saved_png = tmp_path / f"{scheme}_50kb.png"
        saved_png.write_bytes(base64.b64decode(result["stego_png_base64"]))
        with Image.open(saved_png) as image:
            assert image.format == "PNG"
            assert image.mode == "RGB"
        response = client.post(
            "/api/extract",
            files={"file": (saved_png.name, saved_png.read_bytes(), "image/png")},
        )
        assert response.status_code == 200, response.text
        extracted = response.json()
        assert extracted["auto_detected"] is True
        assert extracted["selected_scheme"] == scheme
        candidate = next(item for item in extracted["candidates"] if item["scheme"] == scheme)
        assert compute_ber(message.encode("utf-8"), candidate["message"].encode("utf-8"))["ber"] == 0.0
