"""FastAPI application for the Adaptive Batik PVDM demo."""

from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from demo.backend.schemas import EmbedRequest, EmbedResponse, ExtractResponse, SampleCatalogResponse, SchemeName
from demo.backend.service import (
    embed_all,
    extract_candidates,
    list_samples,
    load_sample,
    load_uploaded_png,
    sample_path,
)


app = FastAPI(title="Adaptive Batik PVDM Demo API", version="1.0.0")


@app.get("/api/samples", response_model=SampleCatalogResponse)
def get_samples() -> SampleCatalogResponse:
    samples = list_samples()
    return SampleCatalogResponse(count=len(samples), samples=samples)


@app.get("/api/samples/{motif}/{filename}")
def get_sample_image(motif: str, filename: str) -> FileResponse:
    try:
        path = sample_path(motif, filename)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(path, media_type="image/png", filename=filename)


@app.post("/api/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest) -> EmbedResponse:
    try:
        cover = load_sample(request.motif, request.filename)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    payload = request.message.encode("utf-8")
    return EmbedResponse(
        motif=request.motif,
        filename=request.filename,
        payload_bytes=len(payload),
        results=embed_all(cover, payload),
    )


@app.post("/api/extract", response_model=ExtractResponse)
async def extract(
    file: UploadFile = File(...),
    scheme: SchemeName | None = Form(default=None),
) -> ExtractResponse:
    raw_png = await file.read()
    try:
        image = load_uploaded_png(raw_png)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    candidates, selected_scheme, ambiguous = extract_candidates(image, scheme)
    if scheme and selected_scheme is None:
        raise HTTPException(status_code=422, detail="The selected scheme could not extract a valid UTF-8 payload.")
    if not scheme and selected_scheme is None and not ambiguous:
        raise HTTPException(status_code=422, detail="No scheme produced a valid length-framed UTF-8 payload.")

    return ExtractResponse(
        selected_scheme=selected_scheme,
        auto_detected=scheme is None and selected_scheme is not None,
        ambiguous=ambiguous,
        candidates=candidates,
    )
