# Asymmetric HVS-Based PVDM RGB Steganography on Indonesian Batik Images

Research & implementation workspace for Digital Image Processing (*Pengolahan Citra Digital*), targeting **ITSMART (IEEE format)** publication:

> **"Asymmetric Range Table Quantization Based on Human Visual System for RGB Image Steganography Using Pixel-Value Differencing and Modulus Function on Indonesian Batik Images"**

---

## Repository Structure

```text
.
├── data/
│   └── batik_512/              # Curated 512x512 24-bit RGB lossless PNG cover images
│       ├── parang/             # 15 samples (high edge density / diagonal geometric)
│       ├── kawung/             # 15 samples (high edge density / symmetric geometric)
│       ├── megamendung/        # 15 samples (smooth color gradations)
│       └── manifest.json       # Source provenance, original resolutions, & edge stats
├── docs/
│   ├── md/
│   │   ├── analysis.md         # Master research blueprint, HVS theory, & methodology
│   │   └── PAPER_REFERENCE.md  # Extracted text of Wang et al. (2008)
│   └── pdf/
│       └── 1-s2.0-S0164121207000593-main.pdf
├── scripts/
│   └── prepare_dataset.py      # HTTP-Range dataset curator from Kaggle raw_dataset
├── .gitignore
└── README.md
```

---

## Dataset Setup (`data/batik_512/`)

The 45 cover images (`512×512`, 24-bit RGB, lossless PNG, ~20.6 MB total) are already curated and included in `data/batik_512/` so experiments run identically across machines.

If you need to regenerate the curated subset from scratch:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install numpy pillow
python3 scripts/prepare_dataset.py
```

`scripts/prepare_dataset.py` streams high-resolution images ($\min(w, h) \ge 512$) directly from Kaggle (`hydiexe/dataset-fix`, `raw_dataset/`) without downloading the full 1.99 GB archive, applies EXIF orientation correction, aspect-preserving LANCZOS downscaling (short side = `512px`), and `512×512` center cropping.

---

## Planned Implementation Roadmap

See [`docs/md/analysis.md`](docs/md/analysis.md) for the full mathematical specification:

1. **`pvdm_rgb_batik.py`** — Embedding & blind extraction for 3 comparison schemes:
   - **Scheme 1:** Awate & Patil (2016) Modified Pixel Indicator RGB PVDM
   - **Scheme 2:** Symmetric 6-level RGB PVDM (Wang et al. table applied uniformly to R, G, B)
   - **Scheme 3 (Proposed):** HVS-driven Asymmetric PVDM RGB (Green 7-level protective, Red 6-level standard, Blue 5-level expansive) with 8-case optimal remainder shifting and 3-case Falling-Off-Boundary Problem (FOBP) revision
2. **`evaluation_metrics.py`** — Automated computation of Capacity (bits / bytes / bpp), $\text{MSE}$, $\text{PSNR}_R / \text{PSNR}_G / \text{PSNR}_B / \text{PSNR}_{\text{RGB}}$, $\text{SSIM}$, $\text{BER}$ ($0\%$ lossless check), FOBP trigger counts, and RGB histogram visualizations.

---

## Credits & References

### Dataset Attribution
- **Indonesian Batik Cover Images:** Curated from [**Dataset Batik Indonesia (`hydiexe/dataset-fix`)**](https://www.kaggle.com/datasets/hydiexe/dataset-fix) on Kaggle (`raw_dataset/`). Original resolutions, SHA-256 checksums, and zip entry paths are recorded in [`data/batik_512/manifest.json`](data/batik_512/manifest.json).
- **Dataset Reference Evaluated:** [`arifnurrhmnn/Dataset-Motif-Batik`](https://github.com/arifnurrhmnn/Dataset-Motif-Batik) on GitHub (inspected during dataset selection; not used directly due to `256×256` pre-resized JPEGs).

### Scientific Literature
- C.-M. Wang, N.-I. Wu, C.-S. Tsai, and M.-S. Hwang, *"A high quality steganographic method with pixel-value differencing and modulus function,"* *Journal of Systems and Software*, vol. 81, no. 1, pp. 150–158, Jan. 2008.
- A. S. Awate and V. H. Patil, *"High capacity steganography using pixel-value differencing and modulus function for RGB images,"* IRF International Conference, 2016.
- ITU-R Recommendation BT.601-7, *"Studio encoding parameters of digital television for standard 4:3 and wide screen 16:9 aspect ratios."*
- A. Roorda and D. R. Williams, *"The arrangement of the three cone classes in the living human eye,"* *Nature*, vol. 397, pp. 520–522, 1999.
