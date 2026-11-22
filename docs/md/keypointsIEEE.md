# BLUEPRINT FINAL KEY POINTS & DAFTAR ASET JURNAL IEEE (ITSMART)
**Judul (EN):** Asymmetric Range Table Quantization Based on Human Visual System for RGB Image Steganography Using Pixel-Value Differencing and Modulus Function on Indonesian Batik Images  
**Judul (ID):** Steganografi Citra Batik Nusantara Menggunakan Metode Pixel-Value Differencing dan Fungsi Modulus (PVDM) dengan Tabel Rentang Kuantisasi Asimetris Berbasis Human Visual System pada Ruang Warna RGB  
**Ruang Lingkup:** Pengolahan Citra Digital (*Pure Digital Image Processing*) — tanpa tambahan kriptografi eksternal (XOR).

---

## ABSTRACT & KEYWORDS
* **Key Points:**
  * **Masalah (*Gap*):** Keterbatasan kapasitas PVDM *grayscale* klasik serta inefisiensi pemanfaatan kanal dan perlakuan tabel rentang seragam pada perluasan PVDM RGB berbasis *Pixel Indicator*.
  * **Metode Usulan:** Skema PVDM RGB penuh (3 kanal aktif simultan) dengan **tabel rentang kuantisasi asimetris berbasis *Human Visual System* (HVS)** — Green 7-level (protektif), Red 6-level (standar), dan Blue 5-level (ekspansif) — yang diuji pada **45 citra Batik Nusantara** ($512 \times 512$, 24-bit PNG).
  * **Hasil Kuantitatif Utama:**
    * Peningkatan kapasitas **+519,29%–566,33%** dibanding *Modified Pixel Indicator* (Awate & Patil, 2016) dan **+1,34%–2,09%** dibanding PVDM RGB Simetris (**162,2–171,5 KB** atau **4,95–5,23 bpp**).
    * Validasi HVS: $\text{PSNR}_G$ selalu tertinggi di seluruh motif & payload (**40,43–53,09 dB**), $\text{SSIM}_Y$ unggul (**0,9969–0,9981**), dan $\text{SSIM}_{\text{RGB}} > 0{,}99$ hingga 100 KB.
    * Ekstraksi 100% *lossless* (**$\text{BER} = 0{,}0\%$**) pada seluruh 45 citra, dengan korelasi tekstur-kapasitas sangat kuat (**$r = 0{,}9574$**).
  * **Keywords:** *Image Steganography, Pixel-Value Differencing and Modulus Function (PVDM), Human Visual System (HVS), Asymmetric Range Table, RGB Color Space, Batik Nusantara.*
* **Aset yang Dicantumkan:** Tidak ada tabel/gambar (1 paragraf padat 150–250 kata).

---

## I. INTRODUCTION (PENDAHULUAN)
* **Key Points:**
  * **Konteks:** Urgensi steganografi domain spasial pada citra berwarna (RGB) dan tantangan menjaga keseimbangan antara kapasitas (*payload*) dan kualitas visual (*imperceptibility*).
  * **Identifikasi *Research Gap*:**
    * *Wang et al. (2008):* PVDM efektif meminimalkan distorsi lewat fungsi modulus, namun masih terbatas pada citra *grayscale* (1 kanal).
    * *Awate & Patil (2016):* Perluasan RGB berbasis *Modified Pixel Indicator* (2 LSB kanal Red) membuang **>83% potensi kapasitas** (50% piksel dilewati saat LSB Red `00`/`11`, hanya 1 kanal aktif per piksel) dan tetap memakai tabel 6-level seragam tanpa mempertimbangkan sensitivitas HVS.
  * **Solusi Usulan:** Mengaktifkan ketiga kanal RGB secara simultan dengan **tabel rentang asimetris berbasis HVS** (Green protektif, Red standar, Blue ekspansif).
  * **Justifikasi Dataset Batik Nusantara (4 Pilar):**
    1. *Dualitas Frekuensi Spasial:* Memadukan area latar halus (*Megamendung*) dan ornamen geometris rapat berfrekuensi tinggi (*Parang, Kawung / isen-isen*) dalam satu kanvas.
    2. *Stress-Test Alami FOBP:* Kontras tajam antara garis motif putih/lilin malam dan warna dasar gelap/sogan memicu kasus *Falling-Off-Boundary Problem* secara intensif.
    3. *Ketimpangan Distribusi Warna (Chroma Skewness):* Pewarnaan Batik klasik/sogan didominasi pigmen cokelat dan gelap dengan intensitas kanal **Blue sangat rendah (mendekati 0)**, menjadikannya medan uji paling valid bagi stabilitas tabel ekspansif kanal Blue.
    4. *Relevansi Domain:* Mendukung penyisipan metadata kepemilikan/hak cipta warisan budaya Batik tanpa merusak estetika motif.
  * **Kontribusi Utama:** Poin-poin ringkas kontribusi penelitian.
* **Aset yang Dicantumkan:** Tidak wajib ada tabel/gambar (narasi + sitasi `[1]`, `[2]`).

---

## II. RELATED WORK AND THEORETICAL FOUNDATION
* **Key Points:**
  * **A. PVDM (Wang et al., 2008):** Pemartisian pasangan piksel tidak tumpang tindih, selisih $d_i$ untuk menentukan kapasitas $t$ bit, dan penyisipan ke sisa bagi $\text{FREM}_i = (P_x + P_y) \bmod 2^t$.
  * **B. Steganografi RGB & *Modified Pixel Indicator* (Awate & Patil, 2016):** Mekanisme 2 LSB kanal Red (`00`/`11` = lewati, `01` = Green, `10` = Blue) yang membuat $\text{MSE}_R = 0$ namun memangkas kapasitas ekstrem dan mengabaikan perbedaan sensitivitas spektral.
  * **C. HVS, ITU-R BT.601-7, & Keseimbangan Luminansi:**
    * *Standar ITU-R BT.601-7 & CIE 1931:* Bobot 8-bit Green = **$150/256$ (58,7%)**, Red = **$77/256$ (29,9%)**, Blue = **$29/256$ (11,4%)**.
    * *Neurobiologi Retina (Roorda & Williams, 1999 — Nature):* Sel kerucut biru (**S-cones**) hanya **$<6\text{--}10\%$** dan absen di *foveola*; **M-cones (Hijau)** dan **L-cones (Merah)** mendominasi **$>90\%$** dengan puncak sensitivitas fotopik di spektrum hijau ($\approx 555\text{ nm}$).
    * *Hukum JND (Weber-Fechner) & Spatial Masking:* Di area halus, pergeseran maksimal Green ($\pm 1$), Red ($\pm 2$), dan Blue ($\pm 4$) menghasilkan kontribusi perubahan luminansi tiap kanal yang hampir setara ($\approx 0{,}5$ poin/kanal) dengan total $\Delta Y = 1{,}641$ (**0,6%** dari rentang $0\text{--}255$), sehingga **tidak memicu pergeseran rona warna (*no hue shift*)**. Di area tepi tajam, pergeseran lebih besar tertutup alami oleh *contrast masking*.
* **Aset yang Perlu Dicantumkan:**
  * **[Persamaan 1]** Rumus luminansi ITU-R BT.601-7: $Y = 0{,}299R + 0{,}587G + 0{,}114B$.
  * **[Tabel I — Posisi Riset / *Research Gap*]** Perbandingan *Wang et al. (2008)* vs *Awate & Patil (2016)* vs *Proposed Method*.

---

## III. PROPOSED METHODOLOGY
* **Key Points:**
  * **A. Arsitektur Sistem:** Split RGB ($512 \times 512 \times 3$) $\to$ penyisipan **Header Panjang Pesan 32-bit (`uint32` *big-endian*, *MSB-first*)** untuk *blind extraction* $\to$ PVDM Asimetris 3 kanal $\to$ Merge ke `.png` *lossless*.
  * **B. Desain Tabel Rentang Asimetris HVS:**
    * *Green (7 Level — Protektif):* $R_1=[0,3](w=4, t=2)$, $R_2=[4,7](w=4, t=2)$, s/d $R_7=[128,255](w=128, t=7)$ — mengunci pergeseran area halus maksimal $\pm 1$.
    * *Red (6 Level — Standar Wang et al.):* $R_1=[0,7](t=3)$ s/d $R_6=[128,255](t=7)$.
    * *Blue (5 Level — Ekspansif):* $R_1=[0,15](w=16, t=4)$, $R_2=[16,31](w=16, t=4)$, s/d $R_5=[128,255](w=128, t=7)$ — menyerap minimal 4 bit di area halus.
  * **C. Algoritma *Embedding* (Step 1–4):**
    * Pemartisian blok pasangan piksel horizontal $i = 1, 2, \dots, \frac{M \times N}{2}$ pada tiap kanal.
    * *Step 1–2:* Hitung $d_i = |P_{(i,x)} - P_{(i,y)}|$, cari $w_j$ & $t$, hitung $\text{FREM}_i = (P_{(i,x)} + P_{(i,y)}) \bmod 2^t$.
    * *Step 3 (8 Kasus Optimal):* Jelaskan **alasan matematis pembulatan bersilang $\lceil m/2 \rceil$ dan $\lfloor m/2 \rfloor$** berdasarkan urutan $P_{(i,x)} \ge P_{(i,y)}$ — menjaga agar selisih baru $d' = |P'_{(i,x)} - P'_{(i,y)}|$ tetap rapat dan tidak melompat keluar dari sub-rentang $R_j$ aslinya.
    * *Step 4 (3 Kasus FOBP + Sub-range Guard):* Koreksi *underflow* ($<0$), *overflow* ($>255$), kontras ekstrem ($d_i > 128$), serta mekanisme *Sub-range Guard* (`_safe_embed`) agar $|P''_x - P''_y|$ tetap di dalam $[l_j, u_j]$ (menjamin ekstraksi 100% *lossless*).
  * **D. Algoritma *Extraction*:** Ekstraksi buta dari pasangan piksel stego $(P^*_x, P^*_y)$ dan pembacaan header 32-bit.
  * **E. Skenario Eksperimen & Metrik:**
    * *Dataset:* **45 citra Batik Nusantara** ($512 \times 512$, 24-bit PNG): 15 Parang, 15 Kawung, 15 Megamendung (menekankan keragaman tekstur, kontras batas FOBP, dan *chroma skewness* sogan).
    * *Skenario:* 3 Skema (**Skema 1:** *Awate & Patil 2016*, **Skema 2:** *Symmetric 6-level*, **Skema 3:** *Proposed Asymmetric HVS*) $\times$ 4 Payload (`10 KB`, `50 KB`, `100 KB`, `Full`).
* **Aset yang Perlu Dicantumkan:**
  * **[Gambar 1 — Diagram Baru]** *Flowchart* Arsitektur Sistem (*Embedding* & *Extraction*).
  * **[Gambar 2 — Opsional/Disarankan]** Sampel Dataset Batik Nusantara (`parang_01.png`, `kawung_01.png`, `megamendung_01.png`).
  * **[Tabel II]** Tabel Rentang Kuantisasi Asimetris HVS (Green 7-level, Red 6-level, Blue 5-level).
  * **[Tabel III / Pseudocode]** Ringkasan 8 Kasus Pergeseran Optimal (Step 3) dan 3 Kasus FOBP (Step 4).
  * **[Persamaan 2–11]** Rumus $d_i$, $w_j$, $t$, $\text{FREM}_i$, ekstraksi $b$, **Rumus Kapasitas Total** ($\text{Capacity}_{\text{Total}} = \sum_{i=1}^{MN/2} t_{R,i} + \sum_{i=1}^{MN/2} t_{G,i} + \sum_{i=1}^{MN/2} t_{B,i}$), serta rumus metrik: $\text{bpp}$, $\text{MSE}_c$, $\text{MSE}_{\text{RGB}}$, $\text{PSNR}$ (eksplisit berbasis $\text{MSE}_{\text{RGB}}$), $\text{SSIM}$ (Wang et al., 2004) per kanal & $\text{SSIM}_Y$, $\text{BER}$, $\text{FOBP Rate}$, dan Korelasi Pearson ($r$).

---

## IV. EXPERIMENTAL RESULTS AND DISCUSSION
### A. Verifikasi Implementasi & Uji *Lossless*
* **Key Points:** Validasi **89 *unit & integration tests* (89 passed, 0 failed)** termasuk replikasi Tabel 2 & 3 Wang et al. (2008), serta konfirmasi **$\text{BER} = 0{,}0\%$** pada seluruh 45 citra, 3 skema, dan semua variasi payload.
* **Aset:** *(Opsional untuk laporan lengkap)* Tabel ringkasan grup *unit test* (`resultsfinal.md` Bagian 3.5).

### B. Analisis Kapasitas Maksimum per Kanal
* **Key Points:** Skema 3 mencapai rata-rata **168,2 KB (5,13 bpp)** pada Parang, **171,5 KB (5,23 bpp)** pada Kawung, dan **162,2 KB (4,95 bpp)** pada Megamendung — unggul **+519,29%–566,33%** vs Skema 1 dan **+1,34%–2,09%** vs Skema 2; distribusi asimetris terbukti (Blue ~67–68 KB terbesar, Red ~54–56 KB, Green ~41–48 KB terproteksi); Skema 1 gagal pada payload 50 KB & 100 KB (*Exceeds Capacity*).
* **Aset yang Perlu Dicantumkan:**
  * **[Tabel IV]** Tabel 1 Kapasitas Maksimum per Kanal (`results/tables/table1_capacity_summary.csv`).
  * **[Gambar 3]** `results/figures/fig1_capacity_comparison.png`.

### C. Evaluasi Kualitas Citra Multimetrik & Validasi HVS
* **Key Points:** $\text{PSNR}_G$ Skema 3 selalu tertinggi di 100% motif & payload (**40,43–53,09 dB**, unggul `+0,59` s/d `+1,06 dB` dari Skema 2); $\text{MSE}_G$ terendah dan $\text{SSIM}_G$ tertinggi (**0,9953–0,9998**); $\text{SSIM}_Y$ Skema 3 selalu unggul/setara hingga *Full Capacity* (**0,9969–0,9981**); $\text{SSIM}_{\text{RGB}} > 0{,}99$ terjaga hingga payload **100 KB** (`0,9902–0,9996`).
* **Aset yang Perlu Dicantumkan:**
  * **[Tabel V]** Tabel 2 Evaluasi Kualitas Citra Multimetrik pada Variasi Payload (`results/tables/table2_quality_payload_summary.csv`).
  * **[Tabel VI — Opsional/Pelengkap]** Rincian $\text{MSE}$ dan $\text{SSIM}$ per kanal (R, G, B) dari Bagian 3.2b `resultsfinal.md`.
  * **[Gambar 4]** `results/figures/fig2_psnr_per_channel_vs_payload.png`.
  * **[Gambar 5]** `results/figures/fig3_ssim_vs_payload.png`.

### D. Analisis Korelasi Tekstur Batik & *Stress-Test* FOBP
* **Key Points:** Korelasi Pearson **`r = 0,9574`** (*Edge Area %* vs *S3 BPP*) membuktikan motif rapat (*Kawung* 27,65%, *Parang* 21,36%) berkapasitas lebih besar dari *Megamendung* (14,71%); korelasi *Edge Area %* vs FOBP **`r = -0,1933`** (FOBP dipicu kedekatan piksel ke `0`/`255`, terlihat pada Megamendung dengan *Extreme Edge* 0,5407%); kanal Green memiliki FOBP terendah pada Parang (`1.435,67`) & Kawung (`798,53`); seluruh FOBP (1,53%–2,65%) tertangani Step 4 dengan `BER = 0,0%`.
* **Aset yang Perlu Dicantumkan:**
  * **[Tabel VII]** Tabel 3 Korelasi Kerapatan Tekstur Batik terhadap Kapasitas & Kasus FOBP (`results/tables/table3_texture_fobp_summary.csv`).
  * **[Gambar 6]** `results/figures/fig4_texture_vs_capacity_fobp.png`.

### E. Inspeksi Visual & Histogram RGB
* **Key Points:** Perbandingan *side-by-side* Cover vs Stego (50 KB, Skema 3) membuktikan tidak ada *color shifting* maupun artefak visual (mengonfirmasi perhitungan keseimbangan $\Delta Y$), dan histogram RGB citra stego berimpit rapat dengan citra asli.
* **Aset yang Perlu Dicantumkan:**
  * **[Gambar 7 — Prioritas Jurnal IEEE]** `results/figures/fig6_combined_visual_comparison.png`.
  * *(Alternatif Laporan Tugas Akhir)* `fig5_visual_histogram_parang.png`, `fig5_visual_histogram_kawung.png`, dan `fig5_visual_histogram_megamendung.png`.

---

## V. CONCLUSION (KESIMPULAN)
* **Key Points:**
  * Rangkuman kuantitatif 4 temuan utama: peningkatan kapasitas (+519%–566% vs S1, +1,34%–2,09% vs S2), efektivitas proteksi Green ($\text{PSNR}_G$ tertinggi & $\text{SSIM}_Y$ unggul), imperseptibilitas & *lossless* ($\text{SSIM}_{\text{RGB}} > 0{,}99$ hingga 100 KB, $\text{BER}=0{,}0\%$), serta korelasi tekstur Batik ($r=0{,}9574$) & ketahanan FOBP.
  * *Future Work:* Uji ketahanan terhadap kompresi *lossy* (JPEG) atau steganalisis statistik (*RS analysis* / *PDH analysis*).
* **Aset yang Dicantumkan:** Tidak ada tabel/gambar baru.

---

## REFERENCES & CATATAN PERTAHANAN SIDANG
* **References (Format IEEE):** `[1]` Wang et al. (2008), `[2]` Awate & Patil (2016), `[3]` ITU-R BT.601-7 (2011), `[4]` Roorda & Williams (1999), `[5]` Wang et al. (2004).
* **Appendix (Hanya untuk Laporan Tugas Akhir):** Tabel lengkap 45 citra Batik per gambar (Bagian 4 `resultsfinal.md`) dan ringkasan `FOBPMotifCounter` (Bagian 3.4 `resultsfinal.md`).
* **Catatan Sidang / Presentasi (Tidak perlu di teks jurnal):**
  * *Sanggahan Lampu Rem Merah vs. Hijau:* Bedakan fisika atmosfer jarak jauh (*Rayleigh Scattering* pada panjang gelombang merah) dengan resolusi spasial & sensitivitas luminansi layar digital jarak dekat (HVS).
  * *Komparasi Dataset Standar (Lena, Baboon, dll.):* Jika dosen penguji meminta *benchmark* langsung pada citra standar, skrip yang sama (`run_experiments.py`) bersifat *dataset-agnostic* dan dapat langsung dijalankan pada folder citra standar tanpa mengubah kode.
```[cite: 1, 2]