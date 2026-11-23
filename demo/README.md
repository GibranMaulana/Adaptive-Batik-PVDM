# Adaptive Batik PVDM — Interactive Demo Workbench

Interactive web workbench for demonstrating 3-scheme Adaptive Batik PVDM RGB steganography (Scheme 1, Scheme 2, and Scheme 3 — Proposed Asymmetric HVS-Based RGB PVDM), HVS telemetry comparison, and blind stego PNG extraction.

> **Current Stage:** Phase 0 Scaffold (`feat/demo`). Backend business logic and frontend interactive components are tracked in the GitHub Issues roadmap below.

## Directory Structure

```text
demo/
├── README.md        # Demo setup & development guide
├── backend/         # FastAPI + uv Python backend wrapping src/ PVDM modules
│   ├── __init__.py
│   ├── app.py       # FastAPI application shell & CORS setup
│   ├── schemas.py   # Shared Pydantic v2 request/response contracts
│   ├── service.py   # Service stub connected to src.pvdm_* & src.evaluation_metrics
│   └── pyproject.toml
└── frontend/        # React + TypeScript + Vite + Tailwind v4 UI
```

## Prerequisites

- **Backend:** Python 3.12+ and [`uv`](https://docs.astral.sh/uv/)
- **Frontend:** Node.js 20+ and `npm`

## Running the Backend (FastAPI)

Start the FastAPI dev server on port `8000`:

```bash
# Option A: From the repository root
uv run --project demo/backend uvicorn demo.backend.app:app --reload --port 8000

# Option B: From inside demo/backend/
cd demo/backend && uv run uvicorn app:app --reload --port 8000
```

Verify the scaffold health endpoint:

```bash
curl http://127.0.0.1:8000/api/health
# {"status":"ok","phase":"scaffold","branch":"feat/demo"}
```

Interactive OpenAPI docs are available at `http://127.0.0.1:8000/docs`.

## Running the Frontend (Vite)

Start the Vite dev server on port `5173` (configured to proxy `/api/*` to `http://127.0.0.1:8000`):

```bash
cd demo/frontend && npm run dev
```

Open `http://localhost:5173` in your browser.

## Running Tests

From the repository root, run the full pytest suite (existing core tests + demo API smoke tests):

```bash
uv run --project demo/backend --with pytest pytest -v --tb=short
```

## Roadmap & Tracked GitHub Issues

- **Issue #13 (DEMO PHASE 1):** Backend implementation — Batik cover gallery catalog (`GET /api/samples`), 3-scheme PVDM embedding & diff heatmap generation (`POST /api/embed`), and blind stego PNG extraction (`POST /api/extract`).
- **Issue #14 (DEMO PHASE 2):** Frontend implementation — Interactive Batik gallery, payload composer & presets, 3-scheme comparison with HVS telemetry visualizations, and blind extractor UI.
- **Issue #15 (DEMO PHASE 3):** End-to-end integration polish, QA verification, and demo presentation readiness.
