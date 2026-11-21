# DOKUMEN HASIL PENELITIAN LENGKAP
## Steganografi Citra Batik Nusantara Berbasis PVDM RGB Asimetris & Human Visual System (HVS)

Dokumen ini merangkum **seluruh hasil implementasi, formulasi matematis, pengujian unit/integrasi, hasil eksperimen penuh pada 45 citra Batik Nusantara (512×512, 24-bit RGB PNG), serta daftar lengkap lampiran gambar/grafik dan file data** untuk digunakan sebagai bahan penyusunan laporan akhir dan naskah artikel ilmiah (format IEEE / ITSMART).

---

## 1. Ringkasan Eksekutif & Status Verifikasi

| Komponen | Cakupan / Hasil | Sumber / Lokasi |
| :--- | :--- | :--- |
| **Dataset Uji** | **45 citra** Batik Nusantara `512 × 512` piksel, 24-bit RGB lossless PNG (`15` Parang, `15` Kawung, `15` Megamendung) | `data/batik_512/`, [manifest.json](../data/batik_512/manifest.json) |
| **Skema yang Dievaluasi** | **Skema 1** (*Awate & Patil 2016*), **Skema 2** (*Symmetric 6-level PVDM*), **Skema 3 (Metode Usulan)** (*Asymmetric HVS PVDM*) | [pvdm_core.py](../src/pvdm_core.py), [pvdm_rgb_batik.py](../src/pvdm_rgb_batik.py) |
| **Modul Evaluasi** | Kapasitas (`bits`/`bytes`/`bpp`), `MSE`, `PSNR` (R, G, B, RGB), `SSIM` (R, G, B, RGB, Y), `BER`, Tekstur, dan `FOBPMotifCounter` | [evaluation_metrics.py](../src/evaluation_metrics.py) |
| **Unit & Integration Tests** | **89 passed, 0 failed** (replikasi Tabel 2 & 3 Wang et al. 2008, 8 kasus Step 3, 3 kasus FOBP, BER=0% lintas motif, metrik) | `tests/test_wang_paper.py`, `tests/test_schemes.py`, `tests/test_evaluation_metrics.py` |
| **Skrip Eksperimen Penuh** | 45 citra × 3 skema × variasi payload (`10 KB`, `50 KB`, `100 KB`, `Full Capacity`) — durasi eksekusi `913,5 detik` | [run_experiments.py](../scripts/run_experiments.py) |
| **Verifikasi Lossless** | **$\text{BER} = 0{,}0\%$** pada seluruh 45 citra, seluruh skema, dan seluruh ukuran payload | [experiment_report.md](tables/experiment_report.md) |
| **Validasi Hipotesis HVS (Skema 3)** | **$\text{PSNR}_G > \max(\text{PSNR}_R, \text{PSNR}_B)$** terpenuhi konsisten pada **100%** motif dan ukuran payload | Tabel 2 & Gambar 2 |

---

## 2. Metodologi & Perhitungan Matematis yang Diimplementasikan

### 2.1. Landasan Luminansi HVS (ITU-R BT.601-7)
Persepsi kecerahan dan ketajaman tepi mata manusia dikonstruksi dari sinyal RGB melalui persamaan luminansi:
$$Y = 0{,}299\,R + 0{,}587\,G + 0{,}114\,B$$
Kanal **Green** menyumbang **58,7%** terhadap total luminansi (sensitivitas spasial tertinggi), **Red** menyumbang **29,9%**, dan **Blue** hanya menyumbang **11,4%** (sel kerucut S-cones retina $<6\text{--}10\%$ dan absen di *foveola*).

### 2.2. Tabel Rentang Kuantisasi Asimetris ($R_j$) pada Skema 3
Untuk setiap pasangan piksel horizontal berurutan $(P_{(i,x)}, P_{(i,y)})$ dengan selisih mutlak $d_i = |P_{(i,x)} - P_{(i,y)}| \in [0, 255]$, lebar sub-rentang adalah $w_j = u_j - l_j + 1$, dan kapasitas bit yang disisipkan adalah $t = \lfloor \log_2(w_j) \rfloor$:

| Kanal Warna | Sifat Desain HVS | Jumlah Level | Sub-rentang $R_j = [l_j, u_j] \rightarrow w_j \rightarrow t$ bit |
| :--- | :--- | :---: | :--- |
| **Green (G)** | **Protektif** (memecah area halus `[0,7]` menjadi 2 sub-rentang lebar 4) | **7 Level** | $R_1=[0,3]\to 4\to \mathbf{2}$, $R_2=[4,7]\to 4\to \mathbf{2}$, $R_3=[8,15]\to 8\to \mathbf{3}$, $R_4=[16,31]\to 16\to \mathbf{4}$, $R_5=[32,63]\to 32\to \mathbf{5}$, $R_6=[64,127]\to 64\to \mathbf{6}$, $R_7=[128,255]\to 128\to \mathbf{7}$ |
| **Red (R)** | **Standar / Moderat** (Wang et al., 2008) | **6 Level** | $R_1=[0,7]\to 8\to \mathbf{3}$, $R_2=[8,15]\to 8\to \mathbf{3}$, $R_3=[16,31]\to 16\to \mathbf{4}$, $R_4=[32,63]\to 32\to \mathbf{5}$, $R_5=[64,127]\to 64\to \mathbf{6}$, $R_6=[128,255]\to 128\to \mathbf{7}$ |
| **Blue (B)** | **Ekspansif** (menggabung area halus `[0,15]` agar minimal menyerap 4 bit) | **5 Level** | $R_1=[0,15]\to 16\to \mathbf{4}$, $R_2=[16,31]\to 16\to \mathbf{4}$, $R_3=[32,63]\to 32\to \mathbf{5}$, $R_4=[64,127]\to 64\to \mathbf{6}$, $R_5=[128,255]\to 128\to \mathbf{7}$ |

*(Sebagai pembanding: **Skema 2** menggunakan tabel 6-level Red secara seragam untuk R, G, dan B; sedangkan **Skema 1** menggunakan 2 LSB kanal Red sebagai indikator `01`$\to$Green, `10`$\to$Blue, `00`/`11`$\to$lewati.)*

### 2.3. Algoritma Penyisipan & Ekstraksi (Wang et al., 2008 — Step 1 s/d Step 4)
1. **Step 1 (Selisih & Kapasitas):** Hitung $d_i = |P_{(i,x)} - P_{(i,y)}|$, petakan ke tabel kanal untuk memperoleh $t$, lalu baca $t$ bit pesan menjadi nilai desimal $b \in [0, 2^t - 1]$.
2. **Step 2 (Remainder):**
   $$\text{FREM}_i = (P_{(i,x)} + P_{(i,y)}) \bmod 2^t$$
3. **Step 3 (Pergeseran Optimal 8 Kasus):** Hitung $m = |\text{FREM}_i - b|$ dan $m_1 = 2^t - m$:
   - Kasus 1 ($\text{FREM}_i > b,\; m \le 2^{t-1},\; P_x \ge P_y$): $(P_x - \lceil m/2 \rceil,\; P_y - \lfloor m/2 \rfloor)$
   - Kasus 2 ($\text{FREM}_i > b,\; m \le 2^{t-1},\; P_x < P_y$): $(P_x - \lfloor m/2 \rfloor,\; P_y - \lceil m/2 \rceil)$
   - Kasus 3 ($\text{FREM}_i > b,\; m > 2^{t-1},\; P_x \ge P_y$): $(P_x + \lfloor m_1/2 \rfloor,\; P_y + \lceil m_1/2 \rceil)$
   - Kasus 4 ($\text{FREM}_i > b,\; m > 2^{t-1},\; P_x < P_y$): $(P_x + \lceil m_1/2 \rceil,\; P_y + \lfloor m_1/2 \rfloor)$
   - Kasus 5 ($\text{FREM}_i \le b,\; m \le 2^{t-1},\; P_x \ge P_y$): $(P_x + \lfloor m/2 \rfloor,\; P_y + \lceil m/2 \rceil)$
   - Kasus 6 ($\text{FREM}_i \le b,\; m \le 2^{t-1},\; P_x < P_y$): $(P_x + \lceil m/2 \rceil,\; P_y + \lfloor m/2 \rfloor)$
   - Kasus 7 ($\text{FREM}_i \le b,\; m > 2^{t-1},\; P_x \ge P_y$): $(P_x - \lceil m_1/2 \rceil,\; P_y - \lfloor m_1/2 \rfloor)$
   - Kasus 8 ($\text{FREM}_i \le b,\; m > 2^{t-1},\; P_x < P_y$): $(P_x - \lfloor m_1/2 \rfloor,\; P_y - \lceil m_1/2 \rceil)$
4. **Step 4 (Penanganan FOBP — 3 Kasus):** Jika $P'_x$ atau $P'_y$ keluar dari $[0, 255]$:
   - *Case 1 (Underflow, $d_i \le 128$):* tambah $2^{t-1}$ pada kedua piksel.
   - *Case 2 (Overflow, $d_i \le 128$):* kurangi $2^{t-1}$ pada kedua piksel.
   - *Case 3 (Kontras ekstrem, $d_i > 128$):* *clamp* piksel yang keluar ke `0` atau `255` dan geser sisa ke pasangannya sehingga $(P''_x + P''_y) \bmod 2^t$ tetap sama.
   - *Sub-range Guard (`_safe_embed`):* Jika pergeseran membuat $|P''_x - P''_y|$ melintasi batas sub-rentang $[l_j, u_j]$, sistem mencari pasangan terdekat dengan MSE minimum di dalam $[l_j, u_j]$ agar ekstraksi tetap 100% *lossless*.
5. **Ekstraksi Buta (*Blind Extraction*):** Hitung $d^*_i = |P^*_x - P^*_y|$, tentukan $t$ dari tabel kanal, lalu ekstrak $b = (P^*_x + P^*_y) \bmod 2^t$.

### 2.4. Mekanisme Header & Perbandingan Arsitektur 3 Skema
- **Header Panjang Pesan 32-bit (`pack_message` / `unpack_message`):** Sebelum dikonversi ke aliran bit (*MSB-first*), payload diawali 4 byte (`uint32` *big-endian*) yang menyimpan panjang pesan asli. Hal ini memungkinkan *blind extraction* tanpa memerlukan citra *cover* atau informasi panjang pesan secara terpisah.
- **Perbandingan Mekanisme Kanal:**
  - **Skema 1 (Awate & Patil, 2016):** Menggunakan 2 bit LSB kanal Red pada piksel pertama tiap pasangan `(col, col+1)` sebagai indikator: `00` dan `11` dilewati (~50% piksel terbuang), `01` menyisip di Green (6-level), `10` menyisip di Blue (6-level). Kanal Red tidak pernah dimodifikasi ($\text{MSE}_R = 0$, $\text{PSNR}_R = \infty$).
  - **Skema 2 (Symmetric PVDM):** Ketiga kanal R, G, B menyisipkan data secara simultan dengan tabel 6-level Wang et al. yang seragam.
  - **Skema 3 (Proposed Asymmetric HVS PVDM):** Ketiga kanal R, G, B menyisipkan data secara simultan dengan tabel asimetris berbasis HVS (Green 7-level protektif, Red 6-level standar, Blue 5-level ekspansif).

### 2.5. Metrik Evaluasi Kualitas, Kapasitas, Tekstur, & FOBP
- **Bits per Pixel ($\text{bpp}$):** $\text{bpp} = \frac{\text{Total Bit Kapasitas}}{H \times W}$ (untuk citra $512 \times 512$, $H \times W = 262.144$ piksel).
- **Mean Squared Error ($\text{MSE}$):** $\text{MSE}_c = \frac{1}{HW} \sum_{x=0}^{H-1} \sum_{y=0}^{W-1} (I_c(x,y) - S_c(x,y))^2$, dan $\text{MSE}_{\text{RGB}} = \frac{\text{MSE}_R + \text{MSE}_G + \text{MSE}_B}{3}$.
- **Peak Signal-to-Noise Ratio ($\text{PSNR}$):** $\text{PSNR} = 10 \log_{10}\left(\frac{255^2}{\text{MSE}}\right)\text{ dB}$.
- **Structural Similarity Index Measure ($\text{SSIM}$, Wang et al., 2004):**
  $$\text{SSIM}(x, y) = \frac{(2\mu_x\mu_y + C_1)(2\sigma_{xy} + C_2)}{(\mu_x^2 + \mu_y^2 + C_1)(\sigma_x^2 + \sigma_y^2 + C_2)}$$
  dengan jendela Gaussian $11 \times 11$ ($\sigma = 1{,}5$, *truncate* $= 3{,}5$), $L = 255$, $K_1 = 0{,}01$, $K_2 = 0{,}03$, $C_1 = (K_1 L)^2$, $C_2 = (K_2 L)^2$. Dihitung per kanal ($\text{SSIM}_R, \text{SSIM}_G, \text{SSIM}_B$), rata-rata $\text{SSIM}_{\text{RGB}} = \frac{\text{SSIM}_R + \text{SSIM}_G + \text{SSIM}_B}{3}$, dan pada kanal luminansi $\text{SSIM}_Y$ ($Y = 0{,}299R + 0{,}587G + 0{,}114B$).
- **Bit Error Rate ($\text{BER}$):** $\text{BER} = \frac{\text{Jumlah Bit Galat}}{\text{Total Bit Pesan}} \times 100\%$.
- **FOBP Rate (%):** Untuk Skema 2 & 3 (3 kanal aktif): $\text{FOBP Rate} = \frac{\text{Total Kejadian FOBP}}{\text{Total Pasangan Terpakai} \times 3} \times 100\%$. Untuk Skema 1 (1 kanal aktif per pasangan indikator): $\text{FOBP Rate} = \frac{\text{Total Kejadian FOBP}}{\text{Total Pasangan Terpakai}} \times 100\%$.
- **Korelasi Pearson ($r$):** $r = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum (x_i - \bar{x})^2 \sum (y_i - \bar{y})^2}}$ untuk mengukur hubungan kerapatan tepi (`Edge_Area_%`) terhadap kapasitas (`S3_BPP`) dan frekuensi FOBP (`S3_FOBP_Full`).

---

## 3. Hasil Eksperimen Penuh pada 45 Citra Batik Nusantara

### 3.1. Tabel 1 — Analisis Kapasitas Maksimum per Kanal (Rata-rata 15 Citra per Motif)

| Motif (n=15) | Skema | Mean R (Bytes) | Mean G (Bytes) | Mean B (Bytes) | **Mean Total (Bytes)** | Mean Total (Bits) | **Mean BPP** | Gain vs S1 (%) | Gain vs S2 (%) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Parang** | Skema 1 (*Awate & Patil*) | 0,00 | 13.667,40 | 13.488,53 | **27.156,33** | 217.254,00 | 0,8288 | 0,00% | -83,63% |
| **Parang** | Skema 2 (*Symmetric*) | 55.296,73 | 55.433,07 | 55.150,93 | **165.881,60** | 1.327.055,80 | 5,0623 | +510,84% | 0,00% |
| **Parang** | **Skema 3 (*Proposed HVS*)** | 55.296,73 | **44.761,40** | **68.116,27** | **168.175,33** | 1.345.405,93 | **5,1323** | **+519,29%** | **+1,38%** |
| **Kawung** | Skema 1 (*Awate & Patil*) | 0,00 | 13.761,67 | 13.860,67 | **27.622,67** | 220.984,87 | 0,8430 | 0,00% | -83,55% |
| **Kawung** | Skema 2 (*Symmetric*) | 56.057,87 | 56.063,00 | 55.839,07 | **167.960,87** | 1.343.690,80 | 5,1258 | +508,05% | 0,00% |
| **Kawung** | **Skema 3 (*Proposed HVS*)** | 56.057,87 | **47.681,67** | **67.734,80** | **171.475,13** | 1.371.804,93 | **5,2330** | **+520,78%** | **+2,09%** |
| **Megamendung** | Skema 1 (*Awate & Patil*) | 0,00 | 12.160,33 | 12.178,60 | **24.339,47** | 194.718,80 | 0,7428 | 0,00% | -84,79% |
| **Megamendung** | Skema 2 (*Symmetric*) | 53.868,53 | 53.372,00 | 52.792,93 | **160.034,33** | 1.280.278,00 | 4,8839 | +557,51% | 0,00% |
| **Megamendung** | **Skema 3 (*Proposed HVS*)** | 53.868,53 | **41.353,67** | **66.958,53** | **162.181,73** | 1.297.457,27 | **4,9494** | **+566,33%** | **+1,34%** |

> **Temuan Kunci Tabel 1:** Skema 3 meningkatkan kapasitas total sebesar **+519,29% hingga +566,33%** dibandingkan Skema 1 (*Awate & Patil 2016*), serta tetap unggul **+1,34% hingga +2,09%** dibandingkan Skema 2 (*Symmetric PVDM*). Distribusi kanal pada Skema 3 membuktikan alokasi asimetris bekerja sesuai teori HVS: **Blue terbesar (~67–68 KB)**, **Red moderat (~54–56 KB)**, dan **Green terproteksi (~41–48 KB)**.

---

### 3.2. Tabel 2 — Evaluasi Kualitas Citra Multimetrik pada Variasi Payload (Rata-rata 15 Citra per Motif)

> *Catatan: Pada Skema 1, kapasitas maksimum hanya ~24–27 KB sehingga payload 50 KB dan 100 KB tidak dapat disisipkan (`Exceeds Capacity`).*

| Motif | Skema | Payload | Mean Payload (B) | $\text{MSE}_{\text{RGB}}$ | $\text{PSNR}_R$ (dB) | **$\text{PSNR}_G$ (dB)** | $\text{PSNR}_B$ (dB) | $\text{PSNR}_{\text{RGB}}$ (dB) | $\text{SSIM}_{\text{RGB}}$ | $\text{SSIM}_Y$ | BER (%) | Mean FOBP |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Parang** | Skema 1 | 10 KB | 10.240 | 0,5317 | $\infty$ | 50,25 | 50,29 | 52,03 | 0,9994 | 0,9997 | 0,0% | 412,80 |
| | Skema 1 | Full | 27.152 | 1,4867 | $\infty$ | 45,81 | 45,89 | 47,61 | 0,9984 | 0,9992 | 0,0% | 1.197,27 |
| | Skema 2 | 10 KB | 10.240 | 0,5601 | 51,94 | 51,93 | 51,90 | 51,92 | 0,9995 | 0,9998 | 0,0% | 506,13 |
| | Skema 2 | 50 KB | 51.200 | 2,6373 | 44,99 | 45,04 | 45,07 | 45,03 | 0,9970 | 0,9987 | 0,0% | 2.480,93 |
| | Skema 2 | 100 KB | 102.400 | 5,3015 | 41,92 | 41,96 | 42,02 | 41,97 | 0,9940 | 0,9974 | 0,0% | 5.172,40 |
| | Skema 2 | Full | 165.878 | 9,0210 | 39,74 | 39,76 | 39,81 | 39,77 | 0,9903 | 0,9958 | 0,0% | 8.846,80 |
| | **Skema 3** | **10 KB** | **10.240** | **0,6161** | 51,94 | **52,99** | 49,75 | 51,19 | **0,9992** | **0,9998** | **0,0%** | 547,73 |
| | **Skema 3** | **50 KB** | **51.200** | **2,9283** | 45,05 | **46,06** | 42,81 | 44,28 | **0,9952** | **0,9991** | **0,0%** | 2.692,67 |
| | **Skema 3** | **100 KB** | **102.400** | **5,8635** | 41,99 | **42,95** | 39,78 | 41,23 | **0,9902** | **0,9982** | **0,0%** | 5.639,33 |
| | **Skema 3** | **Full** | **168.171** | **10,0900** | 39,74 | **40,69** | 37,53 | 38,97 | **0,9839** | **0,9970** | **0,0%** | 9.822,07 |
| **Kawung** | Skema 1 | 10 KB | 10.240 | 0,4056 | $\infty$ | 50,69 | 50,78 | 52,50 | 0,9997 | 0,9998 | 0,0% | 264,67 |
| | Skema 1 | Full | 27.619 | 1,1125 | $\infty$ | 46,38 | 46,40 | 48,15 | 0,9992 | 0,9995 | 0,0% | 716,47 |
| | Skema 2 | 10 KB | 10.240 | 0,4038 | 52,47 | 52,50 | 52,58 | 52,51 | 0,9997 | 0,9999 | 0,0% | 292,20 |
| | Skema 2 | 50 KB | 51.200 | 2,0281 | 45,43 | 45,47 | 45,53 | 45,48 | 0,9984 | 0,9993 | 0,0% | 1.577,00 |
| | Skema 2 | 100 KB | 102.400 | 4,1794 | 42,33 | 42,39 | 42,43 | 42,39 | 0,9969 | 0,9985 | 0,0% | 3.261,80 |
| | Skema 2 | Full | 167.957 | 6,9227 | 40,20 | 40,27 | 40,30 | 40,25 | 0,9948 | 0,9976 | 0,0% | 5.482,47 |
| | **Skema 3** | **10 KB** | **10.240** | **0,4464** | 52,57 | **53,09** | 50,66 | 51,95 | **0,9996** | **0,9999** | **0,0%** | 314,33 |
| | **Skema 3** | **50 KB** | **51.200** | **2,2459** | 45,53 | **46,07** | 43,65 | 44,93 | **0,9979** | **0,9994** | **0,0%** | 1.697,07 |
| | **Skema 3** | **100 KB** | **102.400** | **4,6325** | 42,43 | **42,95** | 40,55 | 41,83 | **0,9958** | **0,9988** | **0,0%** | 3.509,07 |
| | **Skema 3** | **Full** | **171.471** | **7,8319** | 40,20 | **40,73** | 38,31 | 39,59 | **0,9928** | **0,9981** | **0,0%** | 6.007,67 |
| **Megamendung** | Skema 1 | 10 KB | 10.240 | 0,3882 | $\infty$ | 50,47 | 51,68 | 52,71 | 0,9994 | 0,9997 | 0,0% | 126,64 |
| | Skema 1 | Full | 24.335 | 1,0671 | $\infty$ | 46,16 | 47,37 | 48,40 | 0,9987 | 0,9993 | 0,0% | 383,07 |
| | Skema 2 | 10 KB | 10.240 | 0,5288 | 50,74 | 51,84 | 53,30 | 51,72 | 0,9994 | 0,9997 | 0,0% | 760,87 |
| | Skema 2 | 50 KB | 51.200 | 2,6300 | 43,67 | 44,70 | 46,12 | 44,60 | 0,9969 | 0,9986 | 0,0% | 3.741,00 |
| | Skema 2 | 100 KB | 102.400 | 5,3056 | 40,59 | 41,62 | 43,00 | 41,52 | 0,9938 | 0,9971 | 0,0% | 7.263,20 |
| | Skema 2 | Full | 160.030 | 8,2751 | 38,74 | 39,73 | 41,11 | 39,64 | 0,9903 | 0,9955 | 0,0% | 10.929,13 |
| | **Skema 3** | **10 KB** | **10.240** | **0,5770** | 50,78 | **52,62** | 50,68 | 51,10 | **0,9991** | **0,9998** | **0,0%** | 712,27 |
| | **Skema 3** | **50 KB** | **51.200** | **2,8558** | 43,73 | **45,54** | 43,59 | 44,05 | **0,9954** | **0,9990** | **0,0%** | 3.532,87 |
| | **Skema 3** | **100 KB** | **102.400** | **5,8073** | 40,62 | **42,38** | 40,53 | 40,95 | **0,9909** | **0,9980** | **0,0%** | 6.839,73 |
| | **Skema 3** | **Full** | **162.178** | **9,2332** | 38,71 | **40,43** | 38,54 | 39,00 | **0,9855** | **0,9969** | **0,0%** | 10.406,73 |

> **Temuan Kunci Tabel 2:**
> 1. Pada **Skema 3**, nilai **$\text{PSNR}_G$ selalu tertinggi** di setiap motif dan setiap ukuran payload (mengungguli $\text{PSNR}_R$ maupun $\text{PSNR}_B$ serta selalu lebih tinggi daripada $\text{PSNR}_G$ pada Skema 2 sebesar `+0,59` s/d `+1,06 dB`).
> 2. Kualitas luminansi mata manusia (**$\text{SSIM}_Y$**) pada Skema 3 selalu **lebih unggul atau setara** dibanding Skema 2 bahkan pada *Full Capacity* (`0,9969–0,9981` vs `0,9955–0,9976`).
> 3. Nilai $\text{SSIM}_{\text{RGB}} > 0{,}99$ terpenuhi hingga payload **100 KB** pada seluruh motif (`0,9902–0,9996`).

#### 3.2b. Rincian $\text{MSE}$ dan $\text{SSIM}$ per Kanal (R, G, B) — Rata-rata 15 Citra per Motif

| Motif | Skema | Payload | $\text{MSE}_R$ | **$\text{MSE}_G$** | $\text{MSE}_B$ | $\text{SSIM}_R$ | **$\text{SSIM}_G$** | $\text{SSIM}_B$ |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **Parang** | Skema 1 | 10 KB | 0,0000 | 0,8066 | 0,7886 | 1,0000 | 0,9991 | 0,9991 |
| | Skema 1 | Full | 0,0000 | 2,2558 | 2,2043 | 1,0000 | 0,9976 | 0,9976 |
| | Skema 2 | 10 KB | 0,5554 | 0,5566 | 0,5683 | 0,9995 | 0,9994 | 0,9994 |
| | Skema 2 | 50 KB | 2,6580 | 2,6186 | 2,6352 | 0,9974 | 0,9970 | 0,9967 |
| | Skema 2 | 100 KB | 5,3663 | 5,2937 | 5,2446 | 0,9948 | 0,9940 | 0,9932 |
| | Skema 2 | Full | 9,1051 | 9,0113 | 8,9467 | 0,9917 | 0,9904 | 0,9889 |
| | **Skema 3** | **10 KB** | 0,5553 | **0,5061** | 0,7871 | 0,9995 | **0,9997** | 0,9982 |
| | **Skema 3** | **50 KB** | 2,6198 | **2,3802** | 3,7849 | 0,9974 | **0,9986** | 0,9897 |
| | **Skema 3** | **100 KB** | 5,2726 | **4,7868** | 7,5311 | 0,9949 | **0,9971** | 0,9786 |
| | **Skema 3** | **Full** | 9,1215 | **8,2942** | 12,8409 | 0,9917 | **0,9953** | 0,9648 |
| **Kawung** | Skema 1 | 10 KB | 0,0000 | 0,6170 | 0,5997 | 1,0000 | 0,9995 | 0,9995 |
| | Skema 1 | Full | 0,0000 | 1,6718 | 1,6656 | 1,0000 | 0,9988 | 0,9987 |
| | Skema 2 | 10 KB | 0,4092 | 0,4070 | 0,3953 | 0,9997 | 0,9997 | 0,9997 |
| | Skema 2 | 50 KB | 2,0446 | 2,0417 | 1,9979 | 0,9984 | 0,9984 | 0,9985 |
| | Skema 2 | 100 KB | 4,2228 | 4,1953 | 4,1203 | 0,9968 | 0,9969 | 0,9969 |
| | Skema 2 | Full | 7,0108 | 6,9294 | 6,8280 | 0,9947 | 0,9949 | 0,9949 |
| | **Skema 3** | **10 KB** | 0,3982 | **0,3613** | 0,5797 | 0,9997 | **0,9998** | 0,9993 |
| | **Skema 3** | **50 KB** | 2,0044 | **1,8149** | 2,9185 | 0,9985 | **0,9990** | 0,9962 |
| | **Skema 3** | **100 KB** | 4,1433 | **3,7658** | 5,9884 | 0,9969 | **0,9980** | 0,9924 |
| | **Skema 3** | **Full** | 7,0140 | **6,3651** | 10,1167 | 0,9947 | **0,9966** | 0,9873 |
| **Megamendung** | Skema 1 | 10 KB | 0,0000 | 0,6639 | 0,5006 | 1,0000 | 0,9992 | 0,9991 |
| | Skema 1 | Full | 0,0000 | 1,8059 | 1,3955 | 1,0000 | 0,9980 | 0,9979 |
| | Skema 2 | 10 KB | 0,7037 | 0,5252 | 0,3576 | 0,9993 | 0,9995 | 0,9995 |
| | Skema 2 | 50 KB | 3,3791 | 2,6294 | 1,8815 | 0,9965 | 0,9971 | 0,9971 |
| | Skema 2 | 100 KB | 6,7905 | 5,2837 | 3,8427 | 0,9932 | 0,9942 | 0,9941 |
| | Skema 2 | Full | 10,5385 | 8,2692 | 6,0176 | 0,9895 | 0,9907 | 0,9906 |
| | **Skema 3** | **10 KB** | 0,6865 | **0,4583** | 0,5862 | 0,9993 | **0,9997** | 0,9984 |
| | **Skema 3** | **50 KB** | 3,2910 | **2,2604** | 3,0161 | 0,9966 | **0,9986** | 0,9912 |
| | **Skema 3** | **100 KB** | 6,6938 | **4,6281** | 6,1000 | 0,9933 | **0,9971** | 0,9823 |
| | **Skema 3** | **Full** | 10,6012 | **7,4189** | 9,6795 | 0,9894 | **0,9954** | 0,9717 |

> Terlihat jelas pada Skema 3 bahwa **$\text{MSE}_G$ selalu terendah** dan **$\text{SSIM}_G$ selalu tertinggi** (`0,9953–0,9998`) di semua motif dan semua tier payload, membuktikan proteksi struktur pada kanal hijau bekerja optimal.

---

### 3.3. Tabel 3 — Korelasi Kerapatan Tekstur Batik terhadap Kapasitas & Kasus FOBP (Full Payload, n=15/motif)

| Motif | Mean $|\Delta|$ | Smooth Area ($d<16$) | Edge Area ($d\ge 16$) | Extreme Edge ($d\ge 128$) | S3 Cap (B) | S3 BPP | S1 FOBP | S2 FOBP | **S3 FOBP Total** | S3 FOBP R / G / B | S3 FOBP Rate (%) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Parang** | 12,25 | 78,64% | **21,36%** | 0,3798% | 168.175,33 | 5,1323 | 1.197,27 | 8.846,80 | **9.822,07** | 3.036,33 / **1.435,67** / 5.350,07 | 2,4979% |
| **Kawung** | 13,47 | 72,35% | **27,65%** | 0,1208% | 171.475,13 | 5,2330 | 716,47 | 5.482,47 | **6.007,67** | 2.172,60 / **798,53** / 3.036,53 | 1,5278% |
| **Megamendung** | 9,48 | 85,29% | **14,71%** | 0,5407% | 162.181,73 | 4,9494 | 383,07 | 10.929,13 | **10.406,73** | 6.276,67 / **2.295,80** / 1.834,27 | 2,6466% |

- **Korelasi Pearson (`Edge_Area_%` vs `S3_BPP`):** **`r = 0,9574`** (korelasi positif sangat kuat: motif geometris rapat seperti Kawung dan Parang menghasilkan kapasitas penyisipan lebih besar dibanding Megamendung).
- **Korelasi Pearson (`Edge_Area_%` vs `S3_FOBP_Full`):** **`r = -0,1933`** (FOBP lebih dipengaruhi oleh kedekatan intensitas piksel terhadap batas `0`/`255`, seperti pada area latar terang/gelap Megamendung).
- **Proteksi FOBP Green:** Pada Parang dan Kawung, kanal **Green** memiliki pemicuan FOBP paling rendah (`1.435,67` dan `798,53`). Pada seluruh 45 citra, seluruh kejadian FOBP tertangani Step 4 dengan **`BER = 0,0%`**.

---

### 3.4. Ringkasan Lengkap `FOBPMotifCounter` & Perbandingan Langsung Ketiga Skema (45 Citra, Full Payload)

| Motif (n=15) | Skema | Total Pasangan Terpakai (`used_pairs`) | Total FOBP (15 Citra) | Mean FOBP / Citra | FOBP Red | FOBP Green | FOBP Blue | FOBP Rate (%) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Parang** | Skema 1 (*Awate & Patil*) | 966.239 | 17.959 | 1.197,27 | 0 | 6.271 | 11.688 | 1,8586% |
| **Parang** | Skema 2 (*Symmetric*) | 1.966.080 | 132.702 | 8.846,80 | 45.533 | 34.096 | 53.073 | 2,2499% |
| **Parang** | **Skema 3 (*Proposed HVS*)** | 1.966.080 | 147.331 | 9.822,07 | 45.545 | **21.535** | 80.251 | 2,4979% |
| **Kawung** | Skema 1 (*Awate & Patil*) | 970.072 | 10.747 | 716,47 | 0 | 3.306 | 7.441 | 1,1079% |
| **Kawung** | Skema 2 (*Symmetric*) | 1.966.080 | 82.237 | 5.482,47 | 32.411 | 17.083 | 32.743 | 1,3943% |
| **Kawung** | **Skema 3 (*Proposed HVS*)** | 1.966.080 | 90.115 | 6.007,67 | 32.589 | **11.978** | 45.548 | 1,5278% |
| **Megamendung** | Skema 1 (*Awate & Patil*) | 898.544 | 5.746 | 383,07 | 0 | 2.919 | 2.827 | 0,6395% |
| **Megamendung** | Skema 2 (*Symmetric*) | 1.966.080 | 163.937 | 10.929,13 | 93.526 | 49.674 | 20.737 | 2,7794% |
| **Megamendung** | **Skema 3 (*Proposed HVS*)** | 1.966.080 | 156.101 | 10.406,73 | 94.150 | **34.437** | 27.514 | 2,6466% |

### 3.5. Ringkasan Hasil Pengujian Unit & Integrasi (`89 passed, 0 failed`)

| File Pengujian | Grup Uji | Yang Diverifikasi | Status |
| :--- | :--- | :--- | :---: |
| [test_wang_paper.py](../tests/test_wang_paper.py) | `TestRangeTables`, `TestFindRange`, `TestTable2Replication`, `TestTable3FOBP`, `TestRoundTrip`, `TestBitHelpers`, `TestAllEightCases` | Struktur 3 tabel rentang (`[0,255]`), replikasi persis Tabel 2 & Tabel 3 Wang et al. (2008), validasi individual 8 kasus Step 3 & 3 kasus FOBP, `BER=0%` pada batas ekstrem `(0,255)` | **Lulus** |
| [test_schemes.py](../tests/test_schemes.py) | `TestSmoke`, `TestScheme1BER`, `TestScheme2BER`, `TestPNGRoundTrip`, `TestCrossMotif`, `TestScheme3Proposed` | *Smoke test* & proteksi mutasi, *overflow error*, simpan/muat ulang PNG *lossless*, `BER=0%` lintas 3 motif pada Skema 1, 2, dan 3, serta verifikasi $\text{PSNR}_G > \text{PSNR}_R > \text{PSNR}_B$ & $\text{SSIM} > 0{,}99$ | **Lulus** |
| [test_evaluation_metrics.py](../tests/test_evaluation_metrics.py) | `TestMSEAndPSNR`, `TestSSIM`, `TestBER`, `TestCapacityAndTexture`, `TestFOBPCounterAndEndToEnd` | Akurasi rumus MSE, PSNR per kanal/RGB, SSIM per kanal/RGB/BT.601 Y, BER, kapasitas (`bpp`), analisis tekstur, serta `FOBPMotifCounter` & `evaluate_scheme()` | **Lulus** |

---

## 4. Lampiran Data Lengkap Per Citra untuk Skema 3 (45 Citra)

Berikut adalah data lengkap kapasitas dan tekstur/FOBP (*Full Payload*) dari masing-masing ke-45 citra Batik pada **Skema 3 (Metode Usulan)**:

| Motif | Nama Citra | Cap R (B) | Cap G (B) | Cap B (B) | Total Cap (B) | BPP | Mean $|\Delta|$ | Smooth (%) | Edge (%) | S3 FOBP (R / G / B) | FOBP Rate (%) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Parang | `parang_01.png` | 53.131 | 41.315 | 66.913 | 161.360 | 4,9243 | 8,54 | 84,27 | 15,73 | 5.664 (1.894/1.842/1.928) | 1,4404 |
| Parang | `parang_02.png` | 57.137 | 47.084 | 69.738 | 173.960 | 5,3088 | 15,53 | 75,72 | 24,28 | 3.812 (1.095/822/1.895) | 0,9694 |
| Parang | `parang_03.png` | 52.669 | 40.551 | 65.913 | 159.134 | 4,8564 | 6,70 | 84,00 | 16,00 | 4.479 (1/800/3.678) | 1,1391 |
| Parang | `parang_04.png` | 58.104 | 47.728 | 69.301 | 175.133 | 5,3447 | 16,14 | 72,85 | 27,15 | 5.201 (2.516/1.122/1.563) | 1,3227 |
| Parang | `parang_05.png` | 61.649 | 55.533 | 71.274 | 188.456 | 5,7512 | 21,62 | 58,40 | 41,60 | 8.396 (3.506/42/4.848) | 2,1352 |
| Parang | `parang_06.png` | 56.384 | 48.708 | 67.045 | 172.138 | 5,2533 | 13,13 | 69,50 | 30,50 | 7.065 (2.449/327/4.289) | 1,7967 |
| Parang | `parang_07.png` | 49.638 | 35.007 | 65.554 | 150.200 | 4,5838 | 3,14 | 97,14 | 2,86 | 5.022 (4/103/4.915) | 1,2772 |
| Parang | `parang_08.png` | 57.739 | 49.041 | 70.099 | 176.880 | 5,3980 | 17,35 | 71,86 | 28,14 | 12.195 (4.999/1.114/6.082) | 3,1013 |
| Parang | `parang_09.png` | 58.044 | 49.356 | 70.102 | 177.503 | 5,4170 | 18,63 | 72,24 | 27,76 | 11.071 (4.910/2.528/3.633) | 2,8155 |
| Parang | `parang_10.png` | 54.216 | 41.265 | 69.123 | 164.606 | 5,0234 | 11,90 | 86,50 | 13,50 | 43.290 (13.255/8.472/21.563) | 11,0092 |
| Parang | `parang_11.png` | 49.223 | 33.292 | 65.536 | 148.051 | 4,5182 | 2,14 | 99,71 | 0,29 | 1.875 (37/1.838/0) | 0,4768 |
| Parang | `parang_12.png` | 57.196 | 47.224 | 69.351 | 173.772 | 5,3031 | 15,58 | 76,11 | 23,89 | 12.540 (4.879/955/6.706) | 3,1891 |
| Parang | `parang_13.png` | 53.049 | 42.158 | 66.944 | 162.152 | 4,9485 | 9,08 | 83,77 | 16,23 | 5.227 (3.540/802/885) | 1,3293 |
| Parang | `parang_14.png` | 53.927 | 42.144 | 67.252 | 163.324 | 4,9843 | 9,44 | 82,65 | 17,35 | 16.747 (2.455/639/13.653) | 4,2590 |
| Parang | `parang_15.png` | 57.345 | 51.015 | 67.599 | 175.961 | 5,3699 | 14,85 | 64,93 | 35,07 | 4.747 (5/129/4.613) | 1,2072 |
| Kawung | `kawung_01.png` | 59.103 | 52.935 | 68.249 | 180.289 | 5,5020 | 16,80 | 61,02 | 38,98 | 5.821 (195/46/5.580) | 1,4804 |
| Kawung | `kawung_02.png` | 55.641 | 47.519 | 67.496 | 170.657 | 5,2081 | 12,75 | 73,16 | 26,84 | 4.377 (2.266/20/2.091) | 1,1131 |
| Kawung | `kawung_03.png` | 55.738 | 48.223 | 66.617 | 170.579 | 5,2057 | 12,34 | 69,99 | 30,01 | 3.449 (161/81/3.207) | 0,8771 |
| Kawung | `kawung_04.png` | 58.361 | 50.407 | 69.765 | 178.533 | 5,4484 | 18,31 | 68,99 | 31,01 | 8.846 (3.162/2.411/3.273) | 2,2497 |
| Kawung | `kawung_05.png` | 53.554 | 42.362 | 67.313 | 163.230 | 4,9814 | 9,79 | 83,57 | 16,43 | 6.372 (2.645/802/2.925) | 1,6205 |
| Kawung | `kawung_06.png` | 56.933 | 48.699 | 68.276 | 173.908 | 5,3073 | 14,27 | 69,26 | 30,74 | 6.822 (2.199/1.267/3.356) | 1,7349 |
| Kawung | `kawung_07.png` | 54.568 | 47.172 | 66.586 | 168.327 | 5,1370 | 11,69 | 73,63 | 26,37 | 2.244 (788/0/1.456) | 0,5707 |
| Kawung | `kawung_08.png` | 55.220 | 44.513 | 68.001 | 167.735 | 5,1189 | 11,63 | 78,11 | 21,89 | 4.835 (2.138/1.020/1.677) | 1,2296 |
| Kawung | `kawung_09.png` | 57.089 | 49.022 | 68.889 | 175.001 | 5,3406 | 15,96 | 71,22 | 28,78 | 8.073 (3.988/1.747/2.338) | 2,0531 |
| Kawung | `kawung_10.png` | 58.955 | 51.582 | 68.881 | 179.419 | 5,4754 | 16,83 | 63,77 | 36,23 | 6.602 (2.868/762/2.972) | 1,6790 |
| Kawung | `kawung_11.png` | 52.072 | 42.617 | 65.796 | 160.486 | 4,8977 | 8,47 | 83,32 | 16,68 | 760 (760/0/0) | 0,1933 |
| Kawung | `kawung_12.png` | 55.155 | 47.904 | 66.869 | 169.930 | 5,1859 | 12,39 | 71,81 | 28,19 | 2.428 (767/1/1.660) | 0,6175 |
| Kawung | `kawung_13.png` | 55.648 | 46.027 | 67.772 | 169.447 | 5,1711 | 12,15 | 74,58 | 25,42 | 6.435 (1.982/622/3.831) | 1,6365 |
| Kawung | `kawung_14.png` | 57.179 | 47.959 | 68.950 | 174.088 | 5,3128 | 16,41 | 72,97 | 27,03 | 19.406 (8.512/3.108/7.786) | 4,9352 |
| Kawung | `kawung_15.png` | 55.652 | 48.284 | 66.562 | 170.498 | 5,2032 | 12,32 | 69,91 | 30,09 | 3.645 (158/91/3.396) | 0,9270 |
| Megamendung | `megamendung_01.png` | 51.565 | 37.209 | 65.953 | 154.728 | 4,7220 | 5,39 | 93,02 | 6,98 | 26.182 (12.680/4.197/9.305) | 6,6584 |
| Megamendung | `megamendung_02.png` | 53.286 | 39.580 | 66.289 | 159.156 | 4,8571 | 8,03 | 88,24 | 11,76 | 2.246 (2.208/38/0) | 0,5712 |
| Megamendung | `megamendung_03.png` | 56.134 | 43.308 | 66.397 | 165.841 | 5,0611 | 11,43 | 85,12 | 14,88 | 17.998 (9.004/4.330/4.664) | 4,5771 |
| Megamendung | `megamendung_04.png` | 51.265 | 38.301 | 66.244 | 155.811 | 4,7550 | 6,20 | 92,26 | 7,74 | 10.554 (10.506/35/13) | 2,6840 |
| Megamendung | `megamendung_05.png` | 55.266 | 44.642 | 67.648 | 167.557 | 5,1134 | 11,98 | 78,83 | 21,17 | 556 (121/227/208) | 0,1414 |
| Megamendung | `megamendung_06.png` | 52.960 | 38.707 | 67.776 | 159.444 | 4,8659 | 8,08 | 90,25 | 9,75 | 45.793 (25.390/16.843/3.560) | 11,6458 |
| Megamendung | `megamendung_07.png` | 54.770 | 39.822 | 66.648 | 161.241 | 4,9207 | 9,13 | 84,84 | 15,16 | 3.769 (2.130/280/1.359) | 0,9585 |
| Megamendung | `megamendung_08.png` | 53.863 | 41.504 | 68.386 | 163.755 | 4,9974 | 11,95 | 85,74 | 14,26 | 10.990 (5.965/3.977/1.048) | 2,7949 |
| Megamendung | `megamendung_09.png` | 53.343 | 41.497 | 66.535 | 161.376 | 4,9248 | 9,81 | 87,86 | 12,14 | 8.143 (5.261/2.882/0) | 2,0709 |
| Megamendung | `megamendung_10.png` | 52.668 | 40.643 | 66.749 | 160.060 | 4,8847 | 8,86 | 85,61 | 14,39 | 4.649 (2.989/479/1.181) | 1,1823 |
| Megamendung | `megamendung_11.png` | 55.931 | 47.236 | 68.094 | 171.262 | 5,2265 | 13,14 | 74,91 | 25,09 | 4.063 (1.241/564/2.258) | 1,0333 |
| Megamendung | `megamendung_12.png` | 57.695 | 50.304 | 68.859 | 176.858 | 5,3973 | 15,92 | 66,59 | 33,41 | 8.881 (5.518/30/3.333) | 2,2586 |
| Megamendung | `megamendung_13.png` | 55.674 | 42.101 | 66.852 | 164.628 | 5,0241 | 10,67 | 84,37 | 15,63 | 8.610 (7.648/554/408) | 2,1896 |
| Megamendung | `megamendung_14.png` | 51.708 | 36.261 | 65.947 | 153.917 | 4,6972 | 5,13 | 92,69 | 7,31 | 1 (1/0/0) | 0,0003 |
| Megamendung | `megamendung_15.png` | 51.900 | 39.190 | 66.001 | 157.092 | 4,7941 | 6,54 | 89,09 | 10,91 | 3.666 (3.488/1/177) | 0,9323 |

---

## 5. Lampiran Gambar, Grafik, & File Data Hasil

### 5.1. Grafik Eksperimen 300 DPI (`results/figures/`)
1. **[fig1_capacity_comparison.png](figures/fig1_capacity_comparison.png)**  
   *Kegunaan di Laporan:* Bab IV (Analisis Kapasitas). Menampilkan (a) perbandingan kapasitas total RGB antara Skema 1, Skema 2, dan Skema 3, serta (b) distribusi kapasitas asimetris R/G/B pada **Skema 3** (Blue terbesar, Green terproteksi).
2. **[fig2_psnr_per_channel_vs_payload.png](figures/fig2_psnr_per_channel_vs_payload.png)**  
   *Kegunaan di Laporan:* Bab IV (Pembuktian Proteksi Kanal Green pada **Skema 3**). Menunjukkan grafik $\text{PSNR}_G$ yang selalu berada di posisi paling atas pada seluruh variasi payload (`10 KB` s/d `Full`) di Parang, Kawung, dan Megamendung.
3. **[fig3_ssim_vs_payload.png](figures/fig3_ssim_vs_payload.png)**  
   *Kegunaan di Laporan:* Bab IV (Evaluasi Keutuhan Struktural). Membandingkan kurva $\text{SSIM}_{\text{RGB}}$ terhadap ambang batas kualitas tinggi `0,99`.
4. **[fig4_texture_vs_capacity_fobp.png](figures/fig4_texture_vs_capacity_fobp.png)**  
   *Kegunaan di Laporan:* Bab IV (Analisis Tekstur & FOBP). Menampilkan (a) proporsi area halus vs tepi pada Parang, Kawung, dan Megamendung, serta (b) jumlah kejadian FOBP per kanal pada **Skema 3**.
5. **Visualisasi *Side-by-Side* Cover vs Stego (50 KB, Skema 3) & Histogram RGB:**
   - Batik Parang: [fig5_visual_histogram_parang.png](figures/fig5_visual_histogram_parang.png)
   - Batik Kawung: [fig5_visual_histogram_kawung.png](figures/fig5_visual_histogram_kawung.png)
   - Batik Megamendung: [fig5_visual_histogram_megamendung.png](figures/fig5_visual_histogram_megamendung.png)
   - **Ringkasan Gabungan 3 Motif (untuk Jurnal IEEE):** [fig6_combined_visual_comparison.png](figures/fig6_combined_visual_comparison.png)

### 5.2. Sampel Citra Stego Lossless PNG (`results/stego_samples/` — Skema 3, 50 KB)
- [parang_01_scheme3_50kb.png](stego_samples/parang_01_scheme3_50kb.png)
- [kawung_01_scheme3_50kb.png](stego_samples/kawung_01_scheme3_50kb.png)
- [megamendung_01_scheme3_50kb.png](stego_samples/megamendung_01_scheme3_50kb.png)

### 5.3. File Data Mentah CSV (`results/tables/`)
- [table1_capacity_summary.csv](tables/table1_capacity_summary.csv) & [table1_capacity_per_image.csv](tables/table1_capacity_per_image.csv)
- [table2_quality_payload_summary.csv](tables/table2_quality_payload_summary.csv) & [table2_quality_payload_per_image.csv](tables/table2_quality_payload_per_image.csv)
- [table3_texture_fobp_summary.csv](tables/table3_texture_fobp_summary.csv) & [table3_texture_fobp_per_image.csv](tables/table3_texture_fobp_per_image.csv)
- [experiment_report.md](tables/experiment_report.md) (ringkasan + JSON lengkap `FOBPMotifCounter`)

---

## 6. Kesimpulan Akhir Penelitian (Untuk Bab V Laporan / Artikel IEEE)

1. **Peningkatan Kapasitas Signifikan:** Metode usulan **Skema 3 (PVDM RGB Asimetris Berbasis HVS)** mampu menyisipkan rata-rata **168,2 KB (5,13 bpp)** pada Parang, **171,5 KB (5,23 bpp)** pada Kawung, dan **162,2 KB (4,95 bpp)** pada Megamendung — meningkat **+519% s/d +566%** dibandingkan metode *Modified Pixel Indicator* (Awate & Patil, 2016) dan **+1,34% s/d +2,09%** lebih tinggi dari PVDM RGB Simetris.
2. **Proteksi Kanal Green Terbukti Efektif:** Desain tabel 7-level protektif pada kanal Green berhasil menjaga **$\text{PSNR}_G$ selalu tertinggi** di seluruh motif dan seluruh variasi payload (`40,43–53,09 dB`), sehingga kualitas struktur luminansi manusia (**$\text{SSIM}_Y$**) Skema 3 selalu mengungguli Skema 2 hingga kapasitas penuh (`0,9969–0,9981`).
3. **Imperseptibilitas & Ekstraksi 100% Lossless:** Pada payload hingga `100 KB`, $\text{SSIM}_{\text{RGB}}$ terjaga di atas `0,99`, histogram RGB citra stego berimpit rapat dengan citra cover, dan ekstraksi pesan rahasia mencapai **`BER = 0,0%`** pada seluruh 45 citra uji.
4. **Pengaruh Tekstur Motif Batik:** Kerapatan tepi motif Batik berkorelasi positif sangat kuat terhadap kapasitas penyisipan (**$r = 0,9574$**), sementara penanganan FOBP 3-kasus pada Step 4 berhasil menanggulangi seluruh potensi *overflow/underflow* piksel tanpa satu pun galat bit.
