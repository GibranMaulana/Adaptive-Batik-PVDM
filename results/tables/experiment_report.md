# Laporan Hasil Eksperimen PVDM RGB Asimetris Berbasis HVS (Output 2)

- **Dataset:** Citra Batik Nusantara 512×512 (24-bit RGB PNG) — `15` sampel per motif (`45` citra total: Parang, Kawung, Megamendung).
- **Skema Uji:** Skema 1 (*Awate & Patil 2016*), Skema 2 (*Symmetric 6-level PVDM*), Skema 3 (*Proposed Asymmetric HVS PVDM: Green 7-level, Red 6-level, Blue 5-level*).
- **Verifikasi Lossless:** Seluruh skema & ukuran payload terverifikasi `BER = 0.0%`.
- **Validasi Hipotesis HVS (Skema 3):** $\text{PSNR}_G$ selalu tertinggi ($\text{PSNR}_G > \max(\text{PSNR}_R, \text{PSNR}_B)$) pada semua tier & motif: **`True`**.

---

## Tabel 1 — Analisis Kapasitas Maksimum per Kanal (Rata-rata per Motif)

| Motif | Scheme | Samples | Mean_R_Bytes | Mean_G_Bytes | Mean_B_Bytes | Mean_Total_Bytes | Mean_Total_Bits | Mean_BPP | Gain_vs_S1_% | Gain_vs_S2_% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Parang | Scheme 1 (Awate & Patil 2016) | 15 | 0.0000 | 13667.40 | 13488.53 | 27156.33 | 217254.00 | 0.8288 | 0.0000 | -83.63 |
| Parang | Scheme 2 (Symmetric PVDM) | 15 | 55296.73 | 55433.07 | 55150.93 | 165881.60 | 1327055.80 | 5.0623 | 510.84 | 0.0000 |
| Parang | Scheme 3 (Proposed HVS PVDM) | 15 | 55296.73 | 44761.40 | 68116.27 | 168175.33 | 1345405.93 | 5.1323 | 519.29 | 1.3800 |
| Kawung | Scheme 1 (Awate & Patil 2016) | 15 | 0.0000 | 13761.67 | 13860.67 | 27622.67 | 220984.87 | 0.8430 | 0.0000 | -83.55 |
| Kawung | Scheme 2 (Symmetric PVDM) | 15 | 56057.87 | 56063.00 | 55839.07 | 167960.87 | 1343690.80 | 5.1258 | 508.05 | 0.0000 |
| Kawung | Scheme 3 (Proposed HVS PVDM) | 15 | 56057.87 | 47681.67 | 67734.80 | 171475.13 | 1371804.93 | 5.2330 | 520.78 | 2.0900 |
| Megamendung | Scheme 1 (Awate & Patil 2016) | 15 | 0.0000 | 12160.33 | 12178.60 | 24339.47 | 194718.80 | 0.7428 | 0.0000 | -84.79 |
| Megamendung | Scheme 2 (Symmetric PVDM) | 15 | 53868.53 | 53372.00 | 52792.93 | 160034.33 | 1280278.00 | 4.8839 | 557.51 | 0.0000 |
| Megamendung | Scheme 3 (Proposed HVS PVDM) | 15 | 53868.53 | 41353.67 | 66958.53 | 162181.73 | 1297457.27 | 4.9494 | 566.33 | 1.3400 |

---

## Tabel 2 — Evaluasi Kualitas Citra Multimetrik pada Variasi Payload (Rata-rata per Motif)

> Catatan: Pada Skema 1 (*Awate & Patil 2016*), payload 50 KB dan 100 KB melebihi kapasitas maksimum (~25–30 KB) sehingga hanya 10 KB dan Full Capacity yang dapat disisipkan.

| Motif | Scheme | Payload_Tier | Mean_Payload_Bytes | Mean_MSE_RGB | Mean_PSNR_R | Mean_PSNR_G | Mean_PSNR_B | Mean_PSNR_RGB | Mean_SSIM_RGB | Mean_SSIM_Y | Max_BER_Pct | Mean_FOBP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Parang | Scheme 1 (Awate & Patil 2016) | 10 KB | 10240.00 | 0.5317 | inf | 50.25 | 50.29 | 52.03 | 0.9994 | 0.9997 | 0.0000 | 412.80 |
| Parang | Scheme 1 (Awate & Patil 2016) | Full | 27152.33 | 1.4867 | inf | 45.81 | 45.89 | 47.61 | 0.9984 | 0.9992 | 0.0000 | 1197.27 |
| Parang | Scheme 2 (Symmetric PVDM) | 10 KB | 10240.00 | 0.5601 | 51.94 | 51.93 | 51.90 | 51.92 | 0.9995 | 0.9998 | 0.0000 | 506.13 |
| Parang | Scheme 2 (Symmetric PVDM) | 50 KB | 51200.00 | 2.6373 | 44.99 | 45.04 | 45.07 | 45.03 | 0.9970 | 0.9987 | 0.0000 | 2480.93 |
| Parang | Scheme 2 (Symmetric PVDM) | 100 KB | 102400.00 | 5.3015 | 41.92 | 41.96 | 42.02 | 41.97 | 0.9940 | 0.9974 | 0.0000 | 5172.40 |
| Parang | Scheme 2 (Symmetric PVDM) | Full | 165877.60 | 9.0210 | 39.74 | 39.76 | 39.81 | 39.77 | 0.9903 | 0.9958 | 0.0000 | 8846.80 |
| Parang | Scheme 3 (Proposed HVS PVDM) | 10 KB | 10240.00 | 0.6161 | 51.94 | 52.99 | 49.75 | 51.19 | 0.9992 | 0.9998 | 0.0000 | 547.73 |
| Parang | Scheme 3 (Proposed HVS PVDM) | 50 KB | 51200.00 | 2.9283 | 45.05 | 46.06 | 42.81 | 44.28 | 0.9952 | 0.9991 | 0.0000 | 2692.67 |
| Parang | Scheme 3 (Proposed HVS PVDM) | 100 KB | 102400.00 | 5.8635 | 41.99 | 42.95 | 39.78 | 41.23 | 0.9902 | 0.9982 | 0.0000 | 5639.33 |
| Parang | Scheme 3 (Proposed HVS PVDM) | Full | 168171.33 | 10.09 | 39.74 | 40.69 | 37.53 | 38.97 | 0.9839 | 0.9970 | 0.0000 | 9822.07 |
| Kawung | Scheme 1 (Awate & Patil 2016) | 10 KB | 10240.00 | 0.4056 | inf | 50.69 | 50.78 | 52.50 | 0.9997 | 0.9998 | 0.0000 | 264.67 |
| Kawung | Scheme 1 (Awate & Patil 2016) | Full | 27618.67 | 1.1125 | inf | 46.38 | 46.40 | 48.15 | 0.9992 | 0.9995 | 0.0000 | 716.47 |
| Kawung | Scheme 2 (Symmetric PVDM) | 10 KB | 10240.00 | 0.4038 | 52.47 | 52.50 | 52.58 | 52.51 | 0.9997 | 0.9999 | 0.0000 | 292.20 |
| Kawung | Scheme 2 (Symmetric PVDM) | 50 KB | 51200.00 | 2.0281 | 45.43 | 45.47 | 45.53 | 45.48 | 0.9984 | 0.9993 | 0.0000 | 1577.00 |
| Kawung | Scheme 2 (Symmetric PVDM) | 100 KB | 102400.00 | 4.1794 | 42.33 | 42.39 | 42.43 | 42.39 | 0.9969 | 0.9985 | 0.0000 | 3261.80 |
| Kawung | Scheme 2 (Symmetric PVDM) | Full | 167956.87 | 6.9227 | 40.20 | 40.27 | 40.30 | 40.25 | 0.9948 | 0.9976 | 0.0000 | 5482.47 |
| Kawung | Scheme 3 (Proposed HVS PVDM) | 10 KB | 10240.00 | 0.4464 | 52.57 | 53.09 | 50.66 | 51.95 | 0.9996 | 0.9999 | 0.0000 | 314.33 |
| Kawung | Scheme 3 (Proposed HVS PVDM) | 50 KB | 51200.00 | 2.2459 | 45.53 | 46.07 | 43.65 | 44.93 | 0.9979 | 0.9994 | 0.0000 | 1697.07 |
| Kawung | Scheme 3 (Proposed HVS PVDM) | 100 KB | 102400.00 | 4.6325 | 42.43 | 42.95 | 40.55 | 41.83 | 0.9958 | 0.9988 | 0.0000 | 3509.07 |
| Kawung | Scheme 3 (Proposed HVS PVDM) | Full | 171471.13 | 7.8319 | 40.20 | 40.73 | 38.31 | 39.59 | 0.9928 | 0.9981 | 0.0000 | 6007.67 |
| Megamendung | Scheme 1 (Awate & Patil 2016) | 10 KB | 10240.00 | 0.3882 | inf | 50.47 | 51.68 | 52.71 | 0.9994 | 0.9997 | 0.0000 | 126.64 |
| Megamendung | Scheme 1 (Awate & Patil 2016) | Full | 24335.47 | 1.0671 | inf | 46.16 | 47.37 | 48.40 | 0.9987 | 0.9993 | 0.0000 | 383.07 |
| Megamendung | Scheme 2 (Symmetric PVDM) | 10 KB | 10240.00 | 0.5288 | 50.74 | 51.84 | 53.30 | 51.72 | 0.9994 | 0.9997 | 0.0000 | 760.87 |
| Megamendung | Scheme 2 (Symmetric PVDM) | 50 KB | 51200.00 | 2.6300 | 43.67 | 44.70 | 46.12 | 44.60 | 0.9969 | 0.9986 | 0.0000 | 3741.00 |
| Megamendung | Scheme 2 (Symmetric PVDM) | 100 KB | 102400.00 | 5.3056 | 40.59 | 41.62 | 43.00 | 41.52 | 0.9938 | 0.9971 | 0.0000 | 7263.20 |
| Megamendung | Scheme 2 (Symmetric PVDM) | Full | 160030.33 | 8.2751 | 38.74 | 39.73 | 41.11 | 39.64 | 0.9903 | 0.9955 | 0.0000 | 10929.13 |
| Megamendung | Scheme 3 (Proposed HVS PVDM) | 10 KB | 10240.00 | 0.5770 | 50.78 | 52.62 | 50.68 | 51.10 | 0.9991 | 0.9998 | 0.0000 | 712.27 |
| Megamendung | Scheme 3 (Proposed HVS PVDM) | 50 KB | 51200.00 | 2.8558 | 43.73 | 45.54 | 43.59 | 44.05 | 0.9954 | 0.9990 | 0.0000 | 3532.87 |
| Megamendung | Scheme 3 (Proposed HVS PVDM) | 100 KB | 102400.00 | 5.8073 | 40.62 | 42.38 | 40.53 | 40.95 | 0.9909 | 0.9980 | 0.0000 | 6839.73 |
| Megamendung | Scheme 3 (Proposed HVS PVDM) | Full | 162177.73 | 9.2332 | 38.71 | 40.43 | 38.54 | 39.00 | 0.9855 | 0.9969 | 0.0000 | 10406.73 |

---

## Tabel 3 — Korelasi Kerapatan Tekstur Batik terhadap Kapasitas & Kasus FOBP (Full Payload)

| Motif | Samples | Mean_Abs_Diff | Smooth_Area_Pct | Edge_Area_Pct | Extreme_Edge_Pct | S3_Mean_Cap_Bytes | S3_Mean_BPP | S1_Mean_FOBP | S2_Mean_FOBP | S3_Mean_FOBP | S3_Mean_FOBP_R | S3_Mean_FOBP_G | S3_Mean_FOBP_B | S3_FOBP_Rate_Pct |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Parang | 15 | 12.25 | 78.64 | 21.36 | 0.3798 | 168175.33 | 5.1323 | 1197.27 | 8846.80 | 9822.07 | 3036.33 | 1435.67 | 5350.07 | 2.4979 |
| Kawung | 15 | 13.47 | 72.35 | 27.65 | 0.1208 | 171475.13 | 5.2330 | 716.47 | 5482.47 | 6007.67 | 2172.60 | 798.53 | 3036.53 | 1.5278 |
| Megamendung | 15 | 9.4838 | 85.29 | 14.71 | 0.5407 | 162181.73 | 4.9494 | 383.07 | 10929.13 | 10406.73 | 6276.67 | 2295.80 | 1834.27 | 2.6466 |

- **Korelasi Pearson (`Edge_Area_%` vs `S3_BPP`):** `r = 0.9574` (semakin rapat tepi motif Batik, semakin besar kapasitas penyisipan).
- **Korelasi Pearson (`Edge_Area_%` vs `S3_FOBP_Full`):** `r = -0.1933`.

---

## Ringkasan Pencatat FOBP Otomatis (`FOBPMotifCounter` — Full Payload)

```json
{
  "parang": {
    "scheme1": {
      "images_evaluated": 15,
      "total_fobp": 17959,
      "mean_fobp_per_image": 1197.2666666666667,
      "per_channel_fobp": {
        "R": 0,
        "G": 6271,
        "B": 11688
      },
      "total_used_pairs": 966239,
      "fobp_rate_percent": 1.858649878549717
    },
    "scheme2": {
      "images_evaluated": 15,
      "total_fobp": 132702,
      "mean_fobp_per_image": 8846.8,
      "per_channel_fobp": {
        "R": 45533,
        "G": 34096,
        "B": 53073
      },
      "total_used_pairs": 1966080,
      "fobp_rate_percent": 2.2498575846354165
    },
    "scheme3": {
      "images_evaluated": 15,
      "total_fobp": 147331,
      "mean_fobp_per_image": 9822.066666666668,
      "per_channel_fobp": {
        "R": 45545,
        "G": 21535,
        "B": 80251
      },
      "total_used_pairs": 1966080,
      "fobp_rate_percent": 2.4978807237413196
    }
  },
  "kawung": {
    "scheme1": {
      "images_evaluated": 15,
      "total_fobp": 10747,
      "mean_fobp_per_image": 716.4666666666667,
      "per_channel_fobp": {
        "R": 0,
        "G": 3306,
        "B": 7441
      },
      "total_used_pairs": 970072,
      "fobp_rate_percent": 1.10785591172614
    },
    "scheme2": {
      "images_evaluated": 15,
      "total_fobp": 82237,
      "mean_fobp_per_image": 5482.466666666666,
      "per_channel_fobp": {
        "R": 32411,
        "G": 17083,
        "B": 32743
      },
      "total_used_pairs": 1966080,
      "fobp_rate_percent": 1.3942633734809027
    },
    "scheme3": {
      "images_evaluated": 15,
      "total_fobp": 90115,
      "mean_fobp_per_image": 6007.666666666667,
      "per_channel_fobp": {
        "R": 32589,
        "G": 11978,
        "B": 45548
      },
      "total_used_pairs": 1966080,
      "fobp_rate_percent": 1.5278286404079862
    }
  },
  "megamendung": {
    "scheme1": {
      "images_evaluated": 15,
      "total_fobp": 5746,
      "mean_fobp_per_image": 383.06666666666666,
      "per_channel_fobp": {
        "R": 0,
        "G": 2919,
        "B": 2827
      },
      "total_used_pairs": 898544,
      "fobp_rate_percent": 0.639478979326555
    },
    "scheme2": {
      "images_evaluated": 15,
      "total_fobp": 163937,
      "mean_fobp_per_image": 10929.133333333333,
      "per_channel_fobp": {
        "R": 93526,
        "G": 49674,
        "B": 20737
      },
      "total_used_pairs": 1966080,
      "fobp_rate_percent": 2.779422336154514
    },
    "scheme3": {
      "images_evaluated": 15,
      "total_fobp": 156101,
      "mean_fobp_per_image": 10406.733333333334,
      "per_channel_fobp": {
        "R": 94150,
        "G": 34437,
        "B": 27514
      },
      "total_used_pairs": 1966080,
      "fobp_rate_percent": 2.6465691460503473
    }
  }
}
```
