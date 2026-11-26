"""Integration tests for the Demo Phase 1 FastAPI backend."""

from __future__ import annotations

import base64
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from demo.backend.app import app
from demo.backend.service import _list_samples_cached
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


def test_health_endpoint_returns_200_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "phase": "phase-1-demo",
        "branch": "feat/demo",
    }


@pytest.mark.parametrize(
    "origin",
    ["http://localhost:5173", "http://127.0.0.1:5173"],
)
def test_cors_allows_vite_dev_origins(origin: str):
    response = client.get("/api/health", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin
    assert response.headers.get("access-control-allow-credentials") == "true"

    preflight = client.options(
        "/api/embed",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers.get("access-control-allow-origin") == origin


def test_samples_catalog_has_all_45_batik_images_and_capacities():
    response = client.get("/api/samples")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 45
    assert {sample["motif"] for sample in body["samples"]} == {
        "parang",
        "kawung",
        "megamendung",
    }
    assert all(
        set(sample["capacities"]) == {"scheme1", "scheme2", "scheme3"}
        for sample in body["samples"]
    )


def test_samples_catalog_featured_flags_image_urls_and_caching():
    _list_samples_cached.cache_clear()
    first = client.get("/api/samples")
    assert first.status_code == 200
    body = first.json()

    featured = [sample for sample in body["samples"] if sample["featured"]]
    assert len(featured) == 3
    assert {(sample["motif"], sample["filename"]) for sample in featured} == {
        ("parang", "parang_01.png"),
        ("kawung", "kawung_01.png"),
        ("megamendung", "megamendung_01.png"),
    }

    for sample in body["samples"]:
        assert sample["image_url"] == f"/api/samples/{sample['motif']}/{sample['filename']}"

    img_response = client.get(featured[0]["image_url"])
    assert img_response.status_code == 200
    assert img_response.headers["content-type"] == "image/png"

    second = client.get("/api/samples")
    assert second.status_code == 200
    assert second.json() == body
    assert _list_samples_cached.cache_info().hits >= 1


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
        candidate = next(
            item for item in extracted["candidates"] if item["scheme"] == result["scheme"]
        )
        assert candidate["message"] == message
        assert (
            compute_ber(message.encode("utf-8"), candidate["message"].encode("utf-8"))[
                "ber"
            ]
            == 0.0
        )


def test_manual_scheme_extract_and_non_png_upload_returns_422():
    message = "Manual scheme extraction verification — Batik"
    body = _embed(message)
    scheme3_result = next(
        item for item in body["results"] if item["scheme"] == "scheme3"
    )
    assert scheme3_result["status"] == "ok"
    stego_png = base64.b64decode(scheme3_result["stego_png_base64"])

    manual_ok = client.post(
        "/api/extract",
        files={"file": ("scheme3.png", stego_png, "image/png")},
        data={"scheme": "scheme3"},
    )
    assert manual_ok.status_code == 200, manual_ok.text
    extracted = manual_ok.json()
    assert extracted["auto_detected"] is False
    assert extracted["ambiguous"] is False
    assert extracted["selected_scheme"] == "scheme3"
    assert len(extracted["candidates"]) == 1
    assert extracted["candidates"][0]["scheme"] == "scheme3"
    assert extracted["candidates"][0]["valid"] is True
    assert extracted["candidates"][0]["message"] == message

    # Non-PNG image (JPEG) must be rejected with HTTP 422
    jpeg_buf = io.BytesIO()
    Image.new("RGB", (64, 64), color=(120, 80, 40)).save(jpeg_buf, format="JPEG")
    jpeg_resp = client.post(
        "/api/extract",
        files={"file": ("not_a_png.jpg", jpeg_buf.getvalue(), "image/jpeg")},
    )
    assert jpeg_resp.status_code == 422

    # Arbitrary non-image bytes must also be rejected with HTTP 422
    garbage_resp = client.post(
        "/api/extract",
        files={"file": ("garbage.txt", b"not an image at all", "text/plain")},
    )
    assert garbage_resp.status_code == 422


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
        candidate = next(
            item for item in extracted["candidates"] if item["scheme"] == scheme
        )
        assert (
            compute_ber(message.encode("utf-8"), candidate["message"].encode("utf-8"))[
                "ber"
            ]
            == 0.0
        )
