"""
test_demo_api.py
================
Phase 0 scaffold smoke tests for the Adaptive Batik PVDM FastAPI demo backend
(`demo/backend/`).

Verifies:
1. `GET /api/health` returns HTTP 200 with scaffold metadata.
2. Phase 0 stub endpoints (`GET /api/samples`, `POST /api/embed`, `POST /api/extract`)
   exist and return HTTP 501 Not Implemented prior to Issue #13.
3. CORS configuration permits the Vite frontend origins (`localhost:5173`, `127.0.0.1:5173`).
4. Service layer stubs connect to `src.*` modules and raise `NotImplementedError`.
5. Shared Pydantic API schemas instantiate and serialize cleanly.
"""

import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from demo.backend import service
from demo.backend.app import app
from demo.backend.schemas import (
    EmbedRequest,
    EmbedResponse,
    ExtractResponse,
    HealthResponse,
    SampleCapacity,
    SampleItem,
    SchemeEmbedResult,
    SchemeExtractResult,
    SchemeMetrics,
)

client = TestClient(app)


class TestDemoHealthEndpoint:
    def test_health_returns_200_and_scaffold_payload(self):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "phase": "scaffold",
            "branch": "feat/demo",
        }

    def test_app_metadata(self):
        assert app.title == "Adaptive Batik PVDM Demo API"
        assert app.version == "0.1.0-scaffold"

    @pytest.mark.parametrize(
        "origin",
        ["http://localhost:5173", "http://127.0.0.1:5173"],
    )
    def test_cors_allows_vite_dev_origins(self, origin: str):
        response = client.get("/api/health", headers={"Origin": origin})
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin


class TestDemoStubEndpoints:
    def test_get_samples_returns_501_stub(self):
        response = client.get("/api/samples")
        assert response.status_code == 501
        body = response.json()
        assert "detail" in body
        assert "Issue #13" in body["detail"]

    def test_post_embed_returns_501_stub(self):
        response = client.post("/api/embed")
        assert response.status_code == 501
        body = response.json()
        assert "detail" in body
        assert "Issue #13" in body["detail"]

    def test_post_extract_returns_501_stub(self):
        response = client.post("/api/extract")
        assert response.status_code == 501
        body = response.json()
        assert "detail" in body
        assert "Issue #13" in body["detail"]


class TestDemoServiceAndSchemas:
    def test_service_imports_core_src_modules(self):
        assert hasattr(service.pvdm_core, "RANGE_TABLE_RED")
        assert hasattr(service.pvdm_rgb_batik, "scheme1_embed")
        assert hasattr(service.pvdm_rgb_batik, "scheme2_embed")
        assert hasattr(service.pvdm_rgb_batik, "scheme3_embed")
        assert hasattr(service.evaluation_metrics, "evaluate_scheme")

    @pytest.mark.parametrize(
        "fn",
        [
            service.list_batik_samples,
            service.run_three_scheme_embed,
            service.run_blind_extract,
        ],
    )
    def test_service_stubs_raise_not_implemented(self, fn):
        with pytest.raises(NotImplementedError, match="Issue #13"):
            fn()

    def test_shared_pydantic_contract_models(self):
        health = HealthResponse(status="ok", phase="scaffold", branch="feat/demo")
        assert health.model_dump() == {
            "status": "ok",
            "phase": "scaffold",
            "branch": "feat/demo",
        }

        sample = SampleItem(
            id="parang_001",
            motif="parang",
            filename="parang_001.png",
            image_url="/api/samples/parang_001/image",
            featured=True,
            capacity=SampleCapacity(
                scheme1_bytes=10000,
                scheme2_bytes=20000,
                scheme3_bytes=25000,
            ),
        )
        assert sample.capacity.scheme3_bytes == 25000

        req = EmbedRequest(image_id="parang_001", message_text="Halo Batik")
        assert req.image_id == "parang_001"

        metrics = SchemeMetrics(
            psnr_total=45.2,
            psnr_r=44.1,
            psnr_g=48.3,
            psnr_b=43.0,
            ssim_rgb=0.992,
            ssim_y=0.996,
            capacity_used_bytes=10,
            capacity_max_bytes=25000,
            capacity_used_pct=0.04,
            fobp_count=0,
            elapsed_ms=12.5,
        )
        embed_resp = EmbedResponse(
            image_id="parang_001",
            message_bytes=10,
            schemes={
                "scheme3": SchemeEmbedResult(
                    scheme="scheme3",
                    status="ok",
                    metrics=metrics,
                )
            },
        )
        assert embed_resp.schemes["scheme3"].metrics is not None
        assert embed_resp.schemes["scheme3"].metrics.fobp_count == 0

        extract_resp = ExtractResponse(
            detected_scheme="scheme3",
            results={
                "scheme3": SchemeExtractResult(
                    scheme="scheme3",
                    is_valid_utf8=True,
                    matched=True,
                    extracted_text="Halo Batik",
                    extracted_bytes=10,
                    elapsed_ms=8.1,
                )
            },
        )
        assert extract_resp.detected_scheme == "scheme3"
