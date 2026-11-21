# Phase 2 / Issue #2 validation

Implementation: Scheme 3 (HVS-asymmetric RGB PVDM), built on the Phase 1
merge `7314345`. Scope follows [Issue #2](https://github.com/GibranMaulana/Adaptive-Batik-PVDM/issues/2).

## Reproduction

```bash
python -m pytest -q
python scripts/validate_phase2.py
```

Environment used: Python 3.14.10, NumPy 2.5.5,
Pillow 13.0.0, pytest 9.2.0.

The regression suite passes **78 tests** (including all Phase 1 tests).
Nine additional manual compatibility comparisons produced byte-identical
Scheme 2 stego arrays and unchanged original statistic values, with extraction
working between the old and new implementations.

## Dataset acceptance results

Evidence: [per-image CSV](../results/phase2_validation.csv), all **45** curated
512×512 RGB images (15 per motif).

- All three schemes: **BER = 0%** at the common comparison payload on every image.
- Scheme 3: **BER = 0%** at maximum usable byte capacity on every image,
  including saving to PNG, reopening, and blind extraction.
- Scheme 3 usable full payload: **148,047–188,452 bytes**, excluding
  the four-byte message-length header.
- Gross capacity ratio, Scheme 3 / Scheme 1: **5.997–20.696×**
  (mean of per-image ratios: **6.578×**).
- Mean per-image Green PSNR gain, Scheme 3 minus Scheme 2:
  **+0.789 dB**. Improvement occurs on **42/45** images.

The comparison uses the same bytes in all three schemes: NumPy
`default_rng(42).bytes(n)`, with `n = min(10240, Scheme 1 maximum usable bytes)`.
For Megamendung 06, Scheme 1 only holds 7,700 bytes, so all three receive that
same shorter message. Other images receive 10,240 bytes. Full-capacity Scheme 3
uses a separate seeded message sized to its own capacity.

Green PSNR is computed as `10*log10(255**2 / MSE_G)`, where MSE_G is the mean
squared Green-channel error over all 512×512 pixels. All embedding and extraction
are performed with the fixed tables and no original cover is used for extraction.

## Exceptions and interpretation

| Image | Green PSNR gain (dB) |
| --- | ---: |
| kawung/kawung_09.png | -0.2190 |
| megamendung/megamendung_08.png | -0.0802 |
| megamendung/megamendung_13.png | -0.2706 |

The method meets the capacity and lossless-extraction goals across the dataset,
and improves Green PSNR on average in this experiment. It does **not** establish
higher Green PSNR for every image or every payload. The validation command exits
with code **1** to expose these three per-image comparisons; this is not an
extraction failure.

From the implementation, the protective Green table reduces capacity only for
original differences 0–7. The wider Blue table also changes which message bits
reach subsequent pairs. Thus the same payload can cause different Green-channel
changes even where the two Green tables have identical bit capacities. This
explains why table protection alone does not enforce a per-image PSNR ordering.
The prescribed tables and payloads were retained, including the negative results.

These checks cover Issue #2, not the full Phase 3 experiment suite. No conclusion
is claimed for other message seeds, all payload sizes, SSIM, steganalysis, or
robustness to lossy image transformations. `fobp_count` records the engine's
pixel-boundary events; it does not count the separate range-preserving fallback.
