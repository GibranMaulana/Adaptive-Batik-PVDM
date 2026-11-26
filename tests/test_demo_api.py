"""Integration tests for the Demo Phase 1 FastAPI backend."""

from __future__ import annotations

import base64
import io
import json
import time

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from demo.backend.app import app
from demo.backend.service import _list_samples_cached
from demo.backend.trace import build_calculation_trace, build_row_trace
from src.evaluation_metrics import compute_ber
from src.pvdm_core import embed_pair
from src.pvdm_rgb_batik import scheme1_embed, scheme2_embed, scheme3_embed


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


def test_embed_calculation_trace_steps_include_valid_rgb_neighbor_triplets():
    cover_response = client.get("/api/samples/parang/parang_01.png")
    assert cover_response.status_code == 200
    with Image.open(io.BytesIO(cover_response.content)) as cover_img:
        cover = cover_img.convert("RGB")

    body = _embed("Trace RGB triplets verification — Batik")
    expected_keys = {
        "row",
        "columns",
        "channel",
        "before",
        "after",
        "rgb_before",
        "rgb_after",
        "difference_before",
        "difference_after",
        "range",
        "bits",
        "payload_bits",
        "payload_value",
        "frem_before",
        "frem_after",
    }
    channel_indices = {"R": 0, "G": 1, "B": 2}

    assert {result["scheme"] for result in body["results"]} == {
        "scheme1",
        "scheme2",
        "scheme3",
    }

    for result in body["results"]:
        assert result["status"] == "ok", result
        stego = _png_from_result(result, "stego_png_base64")
        trace = result["calculation_trace"]
        assert trace is not None
        steps = trace["steps"]
        assert len(steps) > 0
        assert trace["displayed_steps"] == len(steps)

        for step in steps:
            assert expected_keys.issubset(step.keys())
            if result["scheme"] == "scheme1":
                assert "indicator" in step

            row = step["row"]
            col0, col1 = step["columns"]
            assert col1 == col0 + 1

            for rgb_key in ("rgb_before", "rgb_after"):
                pair = step[rgb_key]
                assert isinstance(pair, list)
                assert len(pair) == 2
                for triplet in pair:
                    assert isinstance(triplet, list)
                    assert len(triplet) == 3
                    for value in triplet:
                        assert isinstance(value, int) and not isinstance(value, bool)
                        assert 0 <= value <= 255

            channel_idx = channel_indices[step["channel"]]
            assert [
                step["rgb_before"][0][channel_idx],
                step["rgb_before"][1][channel_idx],
            ] == step["before"]
            assert [
                step["rgb_after"][0][channel_idx],
                step["rgb_after"][1][channel_idx],
            ] == step["after"]

            assert step["rgb_before"] == [
                list(cover.getpixel((col0, row))),
                list(cover.getpixel((col1, row))),
            ]
            assert step["rgb_after"] == [
                list(stego.getpixel((col0, row))),
                list(stego.getpixel((col1, row))),
            ]


def _parse_strict_ndjson(raw_text: str) -> list[dict]:
    """Parse NDJSON strictly rejecting non-standard JSON constants (NaN/Infinity)."""
    def _reject_constant(token: str) -> None:
        raise ValueError(f"Non-RFC8259 JSON constant in NDJSON stream: {token}")

    lines = [line for line in raw_text.splitlines() if line.strip()]
    return [json.loads(line, parse_constant=_reject_constant) for line in lines]


def test_embed_calculation_trace_includes_authentic_fobp_triggered_and_24_steps():
    message = "FOBP trace verification payload — Batik PVDM " * 25
    body = _embed(message)
    assert [result["scheme"] for result in body["results"]] == [
        "scheme1",
        "scheme2",
        "scheme3",
    ]

    for result in body["results"]:
        assert result["status"] == "ok", result
        trace = result["calculation_trace"]
        assert trace is not None
        steps = trace["steps"]
        assert len(steps) == 24
        assert trace["displayed_steps"] == 24
        for step in steps:
            assert "fobp_triggered" in step
            assert isinstance(step["fobp_triggered"], bool)
            _, _, expected_fobp = embed_pair(
                step["before"][0],
                step["before"][1],
                step["payload_value"],
                step["bits"],
            )
            assert step["fobp_triggered"] is expected_fobp

    # Synthetic boundary-pixel image verifies fobp_triggered flips True when FOBP fires.
    boundary_cover = Image.fromarray(np.zeros((16, 16, 3), dtype=np.uint8), mode="RGB")
    boundary_payload = b"\xff\xff\xff\xff\xff\xff"
    stego, _ = scheme2_embed(boundary_cover, boundary_payload)
    boundary_trace = build_calculation_trace("scheme2", boundary_cover, stego, boundary_payload)
    assert any(step["fobp_triggered"] is True for step in boundary_trace["steps"])


def test_embed_stream_emits_ndjson_lifecycle_events_for_all_schemes():
    message = "Concurrent NDJSON streaming verification — Batik PVDM " * 10
    payload = message.encode("utf-8")
    required_bits = (len(payload) + 4) * 8
    expected_row_keys = {
        "row",
        "pairs_processed",
        "bits_embedded",
        "cumulative_bits",
        "total_payload_bits",
        "avg_diff",
        "fobp_count",
        "channels",
        "sample_steps",
    }
    expected_step_keys = {
        "row",
        "columns",
        "channel",
        "before",
        "after",
        "range",
        "difference_before",
        "difference_after",
        "bits",
        "payload_bits",
        "payload_value",
        "frem_before",
        "frem_after",
        "fobp_triggered",
        "rgb_before",
        "rgb_after",
    }

    with client.stream(
        "POST",
        "/api/embed/stream",
        json={"motif": "parang", "filename": "parang_01.png", "message": message},
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/x-ndjson")
        assert response.headers.get("cache-control") == "no-cache"
        assert response.headers.get("x-accel-buffering") == "no"
        raw_text = "".join(response.iter_text())

    events = _parse_strict_ndjson(raw_text)
    assert len(events) > 4

    # First 3 events are scheme_start for all 3 schemes.
    start_events = [event for event in events if event["type"] == "scheme_start"]
    assert len(start_events) == 3
    assert [event["scheme"] for event in events[:3]] == ["scheme1", "scheme2", "scheme3"]
    for start in start_events:
        assert start["width"] == 512
        assert start["height"] == 512
        assert start["payload_bytes"] == len(payload)
        assert start["required_bits"] == required_bits
        assert set(start["capacity"].keys()) >= {
            "capacity_bits",
            "capacity_bytes",
            "max_payload_bytes",
            "bpp",
            "per_channel_bits",
        }

    # Verify uncapped scheme_row events for all 3 schemes.
    rows_by_scheme: dict[str, list[dict]] = {"scheme1": [], "scheme2": [], "scheme3": []}
    results_by_scheme: dict[str, dict] = {}
    for event in events:
        if event["type"] == "scheme_row":
            scheme = event["scheme"]
            assert scheme not in results_by_scheme, "scheme_row arrived after scheme_result"
            rows_by_scheme[scheme].append(event)
            row = event["row"]
            assert expected_row_keys == set(row.keys())
            assert row["total_payload_bits"] == required_bits
            assert isinstance(row["avg_diff"], (int, float))
            assert isinstance(row["fobp_count"], int) and row["fobp_count"] >= 0
            assert 1 <= len(row["sample_steps"]) <= 3
            for step in row["sample_steps"]:
                assert expected_step_keys.issubset(step.keys())
                assert step["row"] == row["row"]
                assert step["channel"] in row["channels"]
                assert isinstance(step["fobp_triggered"], bool)
                assert step["frem_after"] == step["payload_value"]
                assert step["range"][0] <= step["difference_after"] <= step["range"][1]
                _, _, expected_fobp = embed_pair(
                    step["before"][0],
                    step["before"][1],
                    step["payload_value"],
                    step["bits"],
                )
                assert step["fobp_triggered"] is expected_fobp
                if scheme == "scheme1":
                    assert "indicator" in step
                else:
                    assert "indicator" not in step
        elif event["type"] == "scheme_result":
            results_by_scheme[event["scheme"]] = event["result"]

    assert set(results_by_scheme.keys()) == {"scheme1", "scheme2", "scheme3"}
    for scheme in ("scheme1", "scheme2", "scheme3"):
        result = results_by_scheme[scheme]
        assert result["status"] == "ok", result
        streamed_rows = rows_by_scheme[scheme]
        assert len(streamed_rows) >= 1
        assert [item["row_index"] for item in streamed_rows] == list(range(len(streamed_rows)))
        assert [item["row"]["row"] for item in streamed_rows] == list(range(len(streamed_rows)))
        assert all(item["total_rows"] == len(streamed_rows) for item in streamed_rows)

        running_bits = 0
        total_fobp = 0
        for item in streamed_rows:
            row = item["row"]
            running_bits += row["bits_embedded"]
            total_fobp += row["fobp_count"]
            assert row["cumulative_bits"] == running_bits

        assert streamed_rows[-1]["row"]["cumulative_bits"] >= required_bits
        if len(streamed_rows) > 1:
            assert streamed_rows[-2]["row"]["cumulative_bits"] < required_bits
        assert total_fobp == result["embed_stats"]["fobp_count"]

    # Scheme 1 leaves Red unmodified so psnr_r is serialized as JSON null (None).
    assert results_by_scheme["scheme1"]["psnr"]["psnr_r"] is None

    # Stream ends with done event.
    assert events[-1] == {
        "type": "done",
        "motif": "parang",
        "filename": "parang_01.png",
        "payload_bytes": len(payload),
    }


def test_embed_stream_50kb_overflows_scheme1_while_scheme2_and_3_complete_ok():
    message = "A" * (50 * 1024)
    payload_bytes = len(message.encode("utf-8"))
    required_bits = (payload_bytes + 4) * 8

    with client.stream(
        "POST",
        "/api/embed/stream",
        json={"motif": "parang", "filename": "parang_01.png", "message": message},
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/x-ndjson")
        raw_text = "".join(response.iter_text())

    events = _parse_strict_ndjson(raw_text)
    start_schemes = {event["scheme"] for event in events if event["type"] == "scheme_start"}
    assert start_schemes == {"scheme1", "scheme2", "scheme3"}

    rows_by_scheme: dict[str, list[dict]] = {"scheme1": [], "scheme2": [], "scheme3": []}
    results_by_scheme: dict[str, dict] = {}
    for event in events:
        if event["type"] == "scheme_row":
            assert event["scheme"] not in results_by_scheme
            rows_by_scheme[event["scheme"]].append(event)
        elif event["type"] == "scheme_result":
            results_by_scheme[event["scheme"]] = event["result"]

    assert set(results_by_scheme.keys()) == {"scheme1", "scheme2", "scheme3"}
    assert results_by_scheme["scheme1"]["status"] == "overflow"
    assert results_by_scheme["scheme1"]["error"]
    assert len(rows_by_scheme["scheme1"]) == 0

    for scheme in ("scheme2", "scheme3"):
        result = results_by_scheme[scheme]
        assert result["status"] == "ok", result
        streamed_rows = rows_by_scheme[scheme]
        # 50 KB spans > 100 rows on 512x512 Batik cover — must be 100% uncapped.
        assert len(streamed_rows) > 100
        assert [item["row_index"] for item in streamed_rows] == list(range(len(streamed_rows)))
        assert [item["row"]["row"] for item in streamed_rows] == list(range(len(streamed_rows)))
        assert all(item["total_rows"] == len(streamed_rows) for item in streamed_rows)
        assert streamed_rows[-1]["row"]["cumulative_bits"] >= required_bits
        assert streamed_rows[-2]["row"]["cumulative_bits"] < required_bits
        assert (
            sum(item["row"]["fobp_count"] for item in streamed_rows)
            == result["embed_stats"]["fobp_count"]
        )
        # Spot-check bit alignment on first and last row sample_steps.
        for edge_event in (streamed_rows[0], streamed_rows[-1]):
            for step in edge_event["row"]["sample_steps"]:
                assert step["frem_after"] == step["payload_value"]
        assert result["stego_png_base64"]

    assert events[-1] == {
        "type": "done",
        "motif": "parang",
        "filename": "parang_01.png",
        "payload_bytes": payload_bytes,
    }


def test_build_row_trace_fobp_capture_skip_row_and_50kb_speed():
    # 1) Boundary image triggers authentic FOBP and surfaces a FOBP sample_step.
    boundary_cover = Image.fromarray(np.zeros((16, 16, 3), dtype=np.uint8), mode="RGB")
    boundary_payload = b"\xff\xff\xff\xff\xff\xff"
    stego, stats = scheme2_embed(boundary_cover, boundary_payload)
    rows = build_row_trace("scheme2", boundary_cover, stego, boundary_payload)
    assert len(rows) >= 1
    assert sum(row["fobp_count"] for row in rows) == stats["fobp_count"]
    assert stats["fobp_count"] > 0
    for row in rows:
        assert 1 <= len(row["sample_steps"]) <= 3
        if row["fobp_count"] > 0:
            assert any(step["fobp_triggered"] is True for step in row["sample_steps"])

    # 2) Scheme 1 handles a row with zero valid indicators cleanly without breaking row indices.
    s1_arr = np.full((8, 16, 3), 120, dtype=np.uint8)
    s1_arr[0, :, 0] = 0  # indicator 0b00 -> all pairs skipped in Row 0
    s1_arr[1:, :, 0] = 1  # indicator 0b01 -> Green channel active in Rows 1..7
    s1_cover = Image.fromarray(s1_arr, mode="RGB")
    s1_payload = b"hi"
    s1_stego, s1_stats = scheme1_embed(s1_cover, s1_payload)
    s1_rows = build_row_trace("scheme1", s1_cover, s1_stego, s1_payload)
    assert s1_rows[0]["row"] == 0
    assert s1_rows[0]["pairs_processed"] == 0
    assert s1_rows[0]["bits_embedded"] == 0
    assert s1_rows[0]["channels"] == []
    assert s1_rows[0]["sample_steps"] == []
    assert s1_rows[-1]["cumulative_bits"] >= (len(s1_payload) + 4) * 8
    assert sum(row["fobp_count"] for row in s1_rows) == s1_stats["fobp_count"]

    # 3) 50 KB build_row_trace finishes fast (< 200ms generously; typically ~10-25ms).
    cover_response = client.get("/api/samples/parang/parang_01.png")
    assert cover_response.status_code == 200
    with Image.open(io.BytesIO(cover_response.content)) as cover_img:
        parang_cover = cover_img.convert("RGB")
    big_payload = b"A" * (50 * 1024)
    stego3, stats3 = scheme3_embed(parang_cover, big_payload)
    t0 = time.perf_counter()
    rows3 = build_row_trace("scheme3", parang_cover, stego3, big_payload)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert elapsed_ms < 200.0, f"build_row_trace took {elapsed_ms:.1f}ms for 50 KB"
    assert len(rows3) > 100
    assert sum(row["fobp_count"] for row in rows3) == stats3["fobp_count"]


def test_embed_stream_returns_404_for_unknown_sample():
    response = client.post(
        "/api/embed/stream",
        json={"motif": "unknown", "filename": "missing.png", "message": "hello"},
    )
    assert response.status_code == 404
