# Laporan Hasil Eksperimen PVDM RGB Asimetris Berbasis HVS (Output 2)

- **Dataset:** Citra Batik Nusantara 512×512 (24-bit RGB PNG) — `5` sampel per motif (`15` citra total: Parang, Kawung, Megamendung).
- **Skema Uji:** Skema 1 (*Awate & Patil 2016*), Skema 2 (*Symmetric 6-level PVDM*), Skema 3 (*Proposed Asymmetric HVS PVDM: Green 7-level, Red 6-level, Blue 5-level*).
- **Verifikasi Lossless:** Seluruh skema & ukuran payload terverifikasi `BER = 0.0%`.
- **Validasi Hipotesis HVS (Skema 3):** $\text{PSNR}_G$ selalu tertinggi ($\text{PSNR}_G > \max(\text{PSNR}_R, \text{PSNR}_B)$) pada semua tier & motif: **`True`**.

---

## Tabel 1 — Analisis Kapasitas Maksimum per Kanal (Rata-rata per Motif)

| Motif | Scheme | Samples | Mean_R_Bytes | Mean_G_Bytes | Mean_B_Bytes | Mean_Total_Bytes | Mean_Total_Bits | Mean_BPP | Gain_vs_S1_% | Gain_vs_S2_% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Parang | Scheme 1 (Awate & Patil 2016) | 5 | 0.0000 | 13962.60 | 13907.00 | 27870.00 | 222962.80 | 0.8505 | 0.0000 | -83.54 |
| Parang | Scheme 2 (Symmetric PVDM) | 5 | 56538.00 | 56591.20 | 56224.20 | 169354.00 | 1354834.40 | 5.1683 | 507.66 | 0.0000 |
| Parang | Scheme 3 (Proposed HVS PVDM) | 5 | 56538.00 | 46442.20 | 68627.80 | 171608.60 | 1372871.80 | 5.2371 | 515.75 | 1.3300 |
| Kawung | Scheme 1 (Awate & Patil 2016) | 5 | 0.0000 | 13875.80 | 13977.00 | 27853.20 | 222828.80 | 0.8500 | 0.0000 | -83.52 |
| Kawung | Scheme 2 (Symmetric PVDM) | 5 | 56479.40 | 56528.40 | 56047.40 | 169056.20 | 1352454.80 | 5.1592 | 506.95 | 0.0000 |
| Kawung | Scheme 3 (Proposed HVS PVDM) | 5 | 56479.40 | 48289.20 | 67888.00 | 172657.60 | 1381263.60 | 5.2691 | 519.88 | 2.1300 |
| Megamendung | Scheme 1 (Awate & Patil 2016) | 5 | 0.0000 | 12051.00 | 12718.60 | 24770.40 | 198165.40 | 0.7559 | 0.0000 | -84.35 |
| Megamendung | Scheme 2 (Symmetric PVDM) | 5 | 53503.20 | 52973.20 | 51776.60 | 158254.00 | 1266035.40 | 4.8295 | 538.88 | 0.0000 |
| Megamendung | Scheme 3 (Proposed HVS PVDM) | 5 | 53503.20 | 40608.00 | 66506.20 | 160618.60 | 1284951.80 | 4.9017 | 548.43 | 1.4900 |

---

## Tabel 2 — Evaluasi Kualitas Citra Multimetrik pada Variasi Payload (Rata-rata per Motif)

> Catatan: Pada Skema 1 (*Awate & Patil 2016*), payload 50 KB dan 100 KB melebihi kapasitas maksimum (~25–30 KB) sehingga hanya 10 KB dan Full Capacity yang dapat disisipkan.

| Motif | Scheme | Payload_Tier | Mean_Payload_Bytes | Mean_MSE_RGB | Mean_PSNR_R | Mean_PSNR_G | Mean_PSNR_B | Mean_PSNR_RGB | Mean_SSIM_RGB | Mean_SSIM_Y | Max_BER_Pct | Mean_FOBP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Parang | Scheme 1 (Awate & Patil 2016) | 10 KB | 10240.00 | 0.4760 | inf | 50.06 | 50.27 | 51.93 | 0.9994 | 0.9997 | 0.0000 | 322.40 |
| Parang | Scheme 1 (Awate & Patil 2016) | Full | 27866.00 | 1.3957 | inf | 45.51 | 45.71 | 47.37 | 0.9984 | 0.9992 | 0.0000 | 873.20 |
| Parang | Scheme 2 (Symmetric PVDM) | 10 KB | 10240.00 | 0.5046 | 51.65 | 51.70 | 51.92 | 51.75 | 0.9995 | 0.9998 | 0.0000 | 308.40 |
| Parang | Scheme 2 (Symmetric PVDM) | 50 KB | 51200.00 | 2.4242 | 44.71 | 44.84 | 45.04 | 44.86 | 0.9970 | 0.9986 | 0.0000 | 1506.60 |
| Parang | Scheme 2 (Symmetric PVDM) | 100 KB | 102400.00 | 4.9443 | 41.62 | 41.77 | 41.97 | 41.78 | 0.9942 | 0.9973 | 0.0000 | 2961.20 |
| Parang | Scheme 2 (Symmetric PVDM) | Full | 169350.00 | 8.7683 | 39.26 | 39.42 | 39.61 | 39.42 | 0.9908 | 0.9958 | 0.0000 | 5389.00 |
| Parang | Scheme 3 (Proposed HVS PVDM) | 10 KB | 10240.00 | 0.5496 | 51.68 | 52.38 | 50.01 | 51.17 | 0.9993 | 0.9998 | 0.0000 | 290.40 |
| Parang | Scheme 3 (Proposed HVS PVDM) | 50 KB | 51200.00 | 2.6729 | 44.79 | 45.49 | 43.05 | 44.26 | 0.9958 | 0.9991 | 0.0000 | 1478.20 |
| Parang | Scheme 3 (Proposed HVS PVDM) | 100 KB | 102400.00 | 5.4074 | 41.70 | 42.42 | 40.02 | 41.21 | 0.9917 | 0.9982 | 0.0000 | 2966.00 |
| Parang | Scheme 3 (Proposed HVS PVDM) | Full | 171604.60 | 9.6478 | 39.27 | 40.00 | 37.67 | 38.81 | 0.9866 | 0.9971 | 0.0000 | 5510.40 |
| Kawung | Scheme 1 (Awate & Patil 2016) | 10 KB | 10240.00 | 0.4265 | inf | 50.38 | 50.56 | 52.23 | 0.9997 | 0.9998 | 0.0000 | 250.80 |
| Kawung | Scheme 1 (Awate & Patil 2016) | Full | 27849.20 | 1.2183 | inf | 46.00 | 46.04 | 47.78 | 0.9991 | 0.9995 | 0.0000 | 743.00 |
| Kawung | Scheme 2 (Symmetric PVDM) | 10 KB | 10240.00 | 0.4238 | 52.22 | 52.27 | 52.37 | 52.28 | 0.9997 | 0.9998 | 0.0000 | 219.60 |
| Kawung | Scheme 2 (Symmetric PVDM) | 50 KB | 51200.00 | 2.1687 | 45.13 | 45.08 | 45.21 | 45.14 | 0.9983 | 0.9992 | 0.0000 | 1341.40 |
| Kawung | Scheme 2 (Symmetric PVDM) | 100 KB | 102400.00 | 4.5174 | 42.00 | 41.98 | 42.09 | 42.02 | 0.9967 | 0.9985 | 0.0000 | 2972.80 |
| Kawung | Scheme 2 (Symmetric PVDM) | Full | 169052.20 | 7.6746 | 39.81 | 39.81 | 39.91 | 39.84 | 0.9946 | 0.9975 | 0.0000 | 5114.60 |
| Kawung | Scheme 3 (Proposed HVS PVDM) | 10 KB | 10240.00 | 0.4674 | 52.29 | 52.79 | 50.52 | 51.73 | 0.9996 | 0.9999 | 0.0000 | 255.80 |
| Kawung | Scheme 3 (Proposed HVS PVDM) | 50 KB | 51200.00 | 2.3768 | 45.22 | 45.65 | 43.46 | 44.65 | 0.9977 | 0.9994 | 0.0000 | 1503.40 |
| Kawung | Scheme 3 (Proposed HVS PVDM) | 100 KB | 102400.00 | 4.9403 | 42.11 | 42.50 | 40.34 | 41.54 | 0.9955 | 0.9988 | 0.0000 | 3273.40 |
| Kawung | Scheme 3 (Proposed HVS PVDM) | Full | 172653.60 | 8.5811 | 39.81 | 40.21 | 38.05 | 39.23 | 0.9925 | 0.9980 | 0.0000 | 5773.00 |
| Megamendung | Scheme 1 (Awate & Patil 2016) | 10 KB | 10240.00 | 0.3399 | inf | 50.53 | 52.28 | 53.03 | 0.9994 | 0.9997 | 0.0000 | 143.60 |
| Megamendung | Scheme 1 (Awate & Patil 2016) | Full | 24766.40 | 0.8463 | inf | 46.57 | 48.40 | 49.10 | 0.9986 | 0.9993 | 0.0000 | 337.80 |
| Megamendung | Scheme 2 (Symmetric PVDM) | 10 KB | 10240.00 | 0.5296 | 50.43 | 51.95 | 54.30 | 51.81 | 0.9994 | 0.9997 | 0.0000 | 724.20 |
| Megamendung | Scheme 2 (Symmetric PVDM) | 50 KB | 51200.00 | 2.4144 | 43.60 | 44.94 | 47.11 | 44.87 | 0.9968 | 0.9985 | 0.0000 | 4172.20 |
| Megamendung | Scheme 2 (Symmetric PVDM) | 100 KB | 102400.00 | 4.9053 | 40.43 | 41.78 | 43.94 | 41.71 | 0.9936 | 0.9971 | 0.0000 | 8093.20 |
| Megamendung | Scheme 2 (Symmetric PVDM) | Full | 158250.00 | 7.3414 | 38.76 | 40.09 | 42.19 | 40.02 | 0.9902 | 0.9956 | 0.0000 | 11570.60 |
| Megamendung | Scheme 3 (Proposed HVS PVDM) | 10 KB | 10240.00 | 0.5801 | 50.44 | 52.70 | 51.17 | 51.13 | 0.9991 | 0.9998 | 0.0000 | 688.80 |
| Megamendung | Scheme 3 (Proposed HVS PVDM) | 50 KB | 51200.00 | 2.6821 | 43.66 | 45.85 | 43.98 | 44.23 | 0.9951 | 0.9990 | 0.0000 | 4037.20 |
| Megamendung | Scheme 3 (Proposed HVS PVDM) | 100 KB | 102400.00 | 5.4868 | 40.47 | 42.58 | 40.91 | 41.07 | 0.9902 | 0.9981 | 0.0000 | 7900.20 |
| Megamendung | Scheme 3 (Proposed HVS PVDM) | Full | 160614.60 | 8.4316 | 38.70 | 40.81 | 39.04 | 39.27 | 0.9847 | 0.9970 | 0.0000 | 11507.20 |

---

## Tabel 3 — Korelasi Kerapatan Tekstur Batik terhadap Kapasitas & Kasus FOBP (Full Payload)

| Motif | Samples | Mean_Abs_Diff | Smooth_Area_Pct | Edge_Area_Pct | Extreme_Edge_Pct | S3_Mean_Cap_Bytes | S3_Mean_BPP | S1_Mean_FOBP | S2_Mean_FOBP | S3_Mean_FOBP | S3_Mean_FOBP_R | S3_Mean_FOBP_G | S3_Mean_FOBP_B | S3_FOBP_Rate_Pct |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Parang | 5 | 13.71 | 75.05 | 24.95 | 0.0969 | 171608.60 | 5.2371 | 873.20 | 5389.00 | 5510.40 | 1802.40 | 925.60 | 2782.40 | 1.4014 |
| Kawung | 5 | 14.00 | 71.35 | 28.65 | 0.2107 | 172657.60 | 5.2691 | 743.00 | 5114.60 | 5773.00 | 1685.80 | 672.00 | 3415.20 | 1.4682 |
| Megamendung | 5 | 8.6053 | 87.49 | 12.51 | 0.4163 | 160618.60 | 4.9017 | 337.80 | 11570.60 | 11507.20 | 6903.80 | 1765.40 | 2838.00 | 2.9264 |

- **Korelasi Pearson (`Edge_Area_%` vs `S3_BPP`):** `r = 0.9621` (semakin rapat tepi motif Batik, semakin besar kapasitas penyisipan).
- **Korelasi Pearson (`Edge_Area_%` vs `S3_FOBP_Full`):** `r = -0.3793`.

---

## Ringkasan Pencatat FOBP Otomatis (`FOBPMotifCounter` — Full Payload)

```json
{
  "parang": {
    "scheme1": {
      "images_evaluated": 5,
      "total_fobp": 4366,
      "mean_fobp_per_image": 873.2,
      "per_channel_fobp": {
        "R": 0,
        "G": 2069,
        "B": 2297
      },
      "total_used_pairs": 324202,
      "fobp_rate_percent": 1.3466912603870427
    },
    "scheme2": {
      "images_evaluated": 5,
      "total_fobp": 26945,
      "mean_fobp_per_image": 5389.0,
      "per_channel_fobp": {
        "R": 9096,
        "G": 8611,
        "B": 9238
      },
      "total_used_pairs": 655360,
      "fobp_rate_percent": 1.3704935709635415
    },
    "scheme3": {
      "images_evaluated": 5,
      "total_fobp": 27552,
      "mean_fobp_per_image": 5510.4,
      "per_channel_fobp": {
        "R": 9012,
        "G": 4628,
        "B": 13912
      },
      "total_used_pairs": 655360,
      "fobp_rate_percent": 1.4013671875
    }
  },
  "kawung": {
    "scheme1": {
      "images_evaluated": 5,
      "total_fobp": 3715,
      "mean_fobp_per_image": 743.0,
      "per_channel_fobp": {
        "R": 0,
        "G": 800,
        "B": 2915
      },
      "total_used_pairs": 324327,
      "fobp_rate_percent": 1.1454488833800454
    },
    "scheme2": {
      "images_evaluated": 5,
      "total_fobp": 25573,
      "mean_fobp_per_image": 5114.6,
      "per_channel_fobp": {
        "R": 8467,
        "G": 4363,
        "B": 12743
      },
      "total_used_pairs": 655360,
      "fobp_rate_percent": 1.3007100423177083
    },
    "scheme3": {
      "images_evaluated": 5,
      "total_fobp": 28865,
      "mean_fobp_per_image": 5773.0,
      "per_channel_fobp": {
        "R": 8429,
        "G": 3360,
        "B": 17076
      },
      "total_used_pairs": 655360,
      "fobp_rate_percent": 1.4681498209635415
    }
  },
  "megamendung": {
    "scheme1": {
      "images_evaluated": 5,
      "total_fobp": 1689,
      "mean_fobp_per_image": 337.8,
      "per_channel_fobp": {
        "R": 0,
        "G": 830,
        "B": 859
      },
      "total_used_pairs": 309518,
      "fobp_rate_percent": 0.5456871652052546
    },
    "scheme2": {
      "images_evaluated": 5,
      "total_fobp": 57853,
      "mean_fobp_per_image": 11570.6,
      "per_channel_fobp": {
        "R": 34349,
        "G": 13161,
        "B": 10343
      },
      "total_used_pairs": 655360,
      "fobp_rate_percent": 2.9425557454427085
    },
    "scheme3": {
      "images_evaluated": 5,
      "total_fobp": 57536,
      "mean_fobp_per_image": 11507.2,
      "per_channel_fobp": {
        "R": 34519,
        "G": 8827,
        "B": 14190
      },
      "total_used_pairs": 655360,
      "fobp_rate_percent": 2.9264322916666665
    }
  }
}
```
