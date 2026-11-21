# DOKUMEN RANGKUMAN PENELITIAN (MASTER RESEARCH BLUEPRINT)
**Topik:** Steganografi Citra Digital Berwarna (RGB) Berbasis *Human Visual System* (HVS) pada Citra Batik Nusantara  
**Target Publikasi:** Jurnal Ilmiah Nasional Terakreditasi (ITSMART - Format IEEE)  
**Bidang Ilmu:** Pengolahan Citra Digital (*Digital Image Processing*) Murni  

---

## 1. IDENTITAS & RUMUSAN JUDUL PENELITIAN

* **Judul Bahasa Indonesia:**  
  *"Steganografi Citra Batik Nusantara Menggunakan Metode Pixel-Value Differencing dan Fungsi Modulus (PVDM) dengan Tabel Rentang Kuantisasi Asimetris Berbasis Human Visual System pada Ruang Warna RGB"*
* **Judul Bahasa Inggris (IEEE Format):**  
  *"Asymmetric Range Table Quantization Based on Human Visual System for RGB Image Steganography Using Pixel-Value Differencing and Modulus Function on Indonesian Batik Images"*
* **Objek Penelitian (Dataset):**  
  Citra RGB $512 \times 512$ piksel (24-bit) dari berbagai motif **Batik Nusantara** yang mewakili variasi karakteristik frekuensi spasial:
  1. **Motif Geometris Rapat / *High Edge Density*:** Batik Parang, Batik Kawung (kaya akan detail *isen-isen* dan kontras tepi tajam).
  2. **Motif Non-Geometris / Gradasi Halus (*Smooth Area*):** Batik Megamendung (memiliki area transisi warna/gradasi yang luas).

---

## 2. POSISI RISET, *RESEARCH GAP*, DAN KEBARUAN (*NOVELTY*)

Penelitian ini berdiri di atas dua jurnal utama (*baseline*) dengan celah penelitian (*research gap*) yang sangat terukur:

| Aspek Perbandingan | **Jurnal Utama 1: Wang et al. (2008)** *(Elsevier - JSS)* | **Jurnal Utama 2: Awate & Patil (2016)** *(IRF Conf.)* | **Penelitian yang Diusulkan (Proposed Method)** |
| :--- | :--- | :--- | :--- |
| **Ruang Warna** | *Grayscale* (1 kanal monokrom, 8-bit). | RGB (3 kanal, 24-bit) dengan *Modified Pixel Indicator* (PI). | **RGB Penuh (3 kanal aktif, 24-bit)** tanpa pemborosan indikator. |
| **Pemanfaatan Kanal RGB** | Hanya 1 kanal. | Kanal **Red** dikorbankan sebagai indikator (2 bit LSB). Jika LSB Red = `00` atau `11` (50% probabilitas), piksel dilewati (*tidak diisi data*). Jika `01` masuk ke **Green** saja, jika `10` masuk ke **Blue** saja. **>83% potensi kapasitas terbuang** (eksperimen hanya mampu menyisipkan 67 bytes). | **Ketiga kanal (Red, Green, Blue) menyisipkan data secara simultan**, memaksimalkan kapasitas hingga ratusan ribu *bytes*. |
| **Desain Tabel Rentang ($R_j$)** | 1 Tabel Statis 6-level ($R_1=[0,7]$ s/d $R_6=[128,255]$). | Tetap memakai **1 Tabel Statis 6-level yang seragam** untuk kanal Green maupun Blue tanpa membedakan kepekaan mata. | **3 Tabel Rentang Asimetris Berbasis HVS**: Kanal **Green diperketat (7 level)**, **Red standar (6 level)**, dan **Blue diperlonggar (5 level)**. |
| **Analisis Karakteristik Citra** | Citra standar umum (*Lena, Baboon*). | Citra standar umum tanpa analisis tekstur atau batas piksel. | Analisis mendalam terhadap **tekstur geometris Batik Nusantara**, distribusi selisih piksel ($d$), serta frekuensi eksekusi *Falling-Off-Boundary Problem* (FOBP). |

---

## 3. LANDASAN TEORI ILMIAH (JUSTIFIKASI HVS & ITU-R BT.601)

Mengapa kanal **Green** harus diproteksi (dipersempit rentangnya) dan kanal **Blue** boleh diekspansi (diperlebar rentangnya)? Berikut adalah tiga pilar pembuktian ilmiahnya:

### A. Bukti Standar Internasional ITU-R BT.601-7 & CIE 1931
* Dalam dokumen resmi **Recommendation ITU-R BT.601-7** (*Section 2.5.1, Table 1, Table 2, dan Annex 2*), sinyal luminansi ($E'_Y$ atau $D'_Y$) yang merepresentasikan persepsi kecerahan dan ketajaman detail spasial mata manusia dikonstruksi dari sinyal primer Red ($R$), Green ($G$), dan Blue ($B$) melalui persamaan:
  $$Y = 0.299R + 0.587G + 0.114B$$
* Pada kuantisasi digital 8-bit ($2^8 = 256$ level, *Table 2 ITU-R BT.601-7*), pembagian bobot bilangan bulatnya adalah **$150/256$ untuk Green**, **$77/256$ untuk Red**, dan **$29/256$ untuk Blue** ($77 + 150 + 29 = 256$).
* Ketiga koefisien ini diturunkan dari aljabar matriks koordinat kromatisitas **CIE 1931 $(x,y)$** terhadap titik putih acuan (*Reference White*), di mana total bobotnya ternormalisasi menjadi tepat $1.0$ ($0.299 + 0.587 + 0.114 = 1.000$ atau $100\%$).
* **Implikasi Matematis:** Kanal **Green menyumbang $58,7\%$** terhadap total luminansi citra, sedangkan kanal **Blue hanya menyumbang $11,4\%$**. Perubahan nilai piksel yang besar pada kanal Green akan langsung menggeser nilai luminansi $Y$ secara drastis dan memicu *noise* visual (*false contouring*). Sebaliknya, pergeseran nilai piksel yang cukup besar pada kanal Blue hampir tidak mengubah nilai $Y$.

### B. Bukti Anatomi & Neurobiologi Retina (*Roorda & Williams, 1999 - Nature*)
* Pemetaan sel fotoreseptor kerucut (*cone cells*) pada mata manusia hidup membuktikan bahwa sel kerucut penerima gelombang pendek (**S-cones / Biru**) hanya berjumlah **$< 6\%\text{--}10\%$** dari total populasi retina dan absen di pusat fokus penglihatan tajam (*foveola*).
* Sebaliknya, sel kerucut **M-cones (Hijau)** dan **L-cones (Merah)** mendominasi **$> 90\%$** populasi retina, dengan puncak kurva efisiensi luminansi fotopik mata manusia berada tepat pada spektrum warna **Hijau ($\approx 555\text{ nm}$)**.

### C. Argumen Pertahanan Sidang: "Mengapa Lampu Rem Mobil Berwarna Merah, Bukan Hijau?"
* **Perbedaan Konteks Keilmuan:**
  * **Lampu Rem (Merah) = Fisika Atmosfer & Psikologi:** Cahaya merah memiliki panjang gelombang terpanjang ($\approx 620\text{--}750\text{ nm}$). Berdasarkan hukum **Hamburan Rayleigh (*Rayleigh Scattering*)**, gelombang panjang paling tahan terhadap hamburan partikel udara, kabut, hujan, dan debu sehingga dapat terlihat dari jarak ratusan meter, ditambah asosiasi psikologis terhadap tanda bahaya.
  * **Steganografi Citra (Hijau) = Resolusi Spasial & Luminansi Retina (HVS):** Dalam melihat layar digital jarak dekat tanpa kabut, kata "sensitif" merujuk pada kepekaan mata mendeteksi perubahan kontras terang-gelap (*luminance*) dan ketajaman tepi (*edges*) antarpiksel yang $58,7\%$ dikendalikan oleh komponen warna hijau.

---

## 4. SPESIFIKASI METODOLOGI & FORMULASI MATEMATIS

### A. Rancangan Tabel Rentang Kuantisasi Asimetris ($R_j$)
Untuk setiap kanal warna $c \in \{R, G, B\}$, rentang selisih piksel $[0, 255]$ dibagi menjadi sub-rentang $R_j = [l_j, u_j]$ dengan lebar $w_j = u_j - l_j + 1$ yang merupakan perpangkatan dua ($2^t$), di mana jumlah bit yang disisipkan per pasangan piksel adalah $t = \lfloor \log_2(w_j) \rfloor$:

1. **Kanal GREEN (Protektif - 7 Sub-rentang):**  
   Mempersempit rentang area halus ($d \in [0,7]$ dipecah menjadi dua sub-rentang selebar $w=4$) untuk membatasi penyisipan maksimal 2 bit di area mulus guna menjaga nilai $\text{PSNR}_G$.
   * $R_1 = [0, 3] \rightarrow w_1 = 4 \rightarrow \mathbf{t = 2\text{ bit}}$
   * $R_2 = [4, 7] \rightarrow w_2 = 4 \rightarrow \mathbf{t = 2\text{ bit}}$
   * $R_3 = [8, 15] \rightarrow w_3 = 8 \rightarrow \mathbf{t = 3\text{ bit}}$
   * $R_4 = [16, 31] \rightarrow w_4 = 16 \rightarrow \mathbf{t = 4\text{ bit}}$
   * $R_5 = [32, 63] \rightarrow w_5 = 32 \rightarrow \mathbf{t = 5\text{ bit}}$
   * $R_6 = [64, 127] \rightarrow w_6 = 64 \rightarrow \mathbf{t = 6\text{ bit}}$
   * $R_7 = [128, 255] \rightarrow w_7 = 128 \rightarrow \mathbf{t = 7\text{ bit}}$

2. **Kanal RED (Standar / Moderat - 6 Sub-rentang):**  
   Mempertahankan distribusi standar Wang et al. (2008) sebagai penyeimbang kapasitas dan kualitas.
   * $R_1 = [0, 7] \rightarrow w_1 = 8 \rightarrow \mathbf{t = 3\text{ bit}}$
   * $R_2 = [8, 15] \rightarrow w_2 = 8 \rightarrow \mathbf{t = 3\text{ bit}}$
   * $R_3 = [16, 31] \rightarrow w_3 = 16 \rightarrow \mathbf{t = 4\text{ bit}}$
   * $R_4 = [32, 63] \rightarrow w_4 = 32 \rightarrow \mathbf{t = 5\text{ bit}}$
   * $R_5 = [64, 127] \rightarrow w_5 = 64 \rightarrow \mathbf{t = 6\text{ bit}}$
   * $R_6 = [128, 255] \rightarrow w_6 = 128 \rightarrow \mathbf{t = 7\text{ bit}}$

3. **Kanal BLUE (Ekspansif - 5 Sub-rentang):**  
   Menggabungkan dua rentang awal menjadi satu rentang lebar ($w=16$) dan memperluas rentang berikutnya sehingga area halus pun mampu menyerap minimal 4 bit tanpa terlihat oleh mata.
   * $R_1 = [0, 15] \rightarrow w_1 = 16 \rightarrow \mathbf{t = 4\text{ bit}}$
   * $R_2 = [16, 31] \rightarrow w_2 = 16 \rightarrow \mathbf{t = 4\text{ bit}}$
   * $R_3 = [32, 63] \rightarrow w_3 = 32 \rightarrow \mathbf{t = 5\text{ bit}}$
   * $R_4 = [64, 127] \rightarrow w_4 = 64 \rightarrow \mathbf{t = 6\text{ bit}}$
   * $R_5 = [128, 255] \rightarrow w_5 = 128 \rightarrow \mathbf{t = 7\text{ bit}}$

---

### B.Tahapan Algoritma Penyisipan (*Embedding*) - Step 1 s/d Step 4 (Wang et al., 2008)
Untuk setiap pasangan piksel berurutan $(P_{(i,x)}, P_{(i,y)})$ pada masing-masing kanal warna:

* **Step 1 (Hitung Selisih & Kapasitas Bit):**  
  Hitung $d_i = |P_{(i,x)} - P_{(i,y)}|$. Petakan $d_i$ ke tabel rentang kanal terkait untuk memperoleh lebar $w_j$ dan jumlah bit rahasia $t = \lfloor \log_2(w_j) \rfloor$. Ambil $t$ bit dari aliran pesan rahasia dan konversikan ke nilai desimal $b$.
* **Step 2 (Hitung Nilai Sisa Bagi / *Remainder*):**  
  $$\text{FREM}_i = (P_{(i,x)} + P_{(i,y)}) \pmod{2^t}$$
* **Step 3 (Pendekatan Optimal 8 Kasus Pergeseran Piksel):**  
  Hitung jarak pergeseran $m = |\text{FREM}_i - b|$ dan komplemennya $m_1 = 2^t - |\text{FREM}_i - b|$. Modifikasi pasangan piksel menjadi $(P'_{(i,x)}, P'_{(i,y)})$ menggunakan **8 kasus optimal** menggunakan pembulatan $\lceil \cdot \rceil$ dan $\lfloor \cdot \rfloor$:
  1. Jika $\text{FREM}_i > b$ dan $m \le 2^{t-1}$ dan $P_{(i,x)} \ge P_{(i,y)}$: $(P'_{(i,x)}, P'_{(i,y)}) = (P_{(i,x)} - \lceil m/2 \rceil, P_{(i,y)} - \lfloor m/2 \rfloor)$
  2. Jika $\text{FREM}_i > b$ dan $m \le 2^{t-1}$ dan $P_{(i,x)} < P_{(i,y)}$: $(P'_{(i,x)}, P'_{(i,y)}) = (P_{(i,x)} - \lfloor m/2 \rfloor, P_{(i,y)} - \lceil m/2 \rceil)$
  3. Jika $\text{FREM}_i > b$ dan $m > 2^{t-1}$ dan $P_{(i,x)} \ge P_{(i,y)}$: $(P'_{(i,x)}, P'_{(i,y)}) = (P_{(i,x)} + \lfloor m_1/2 \rfloor, P_{(i,y)} + \lceil m_1/2 \rceil)$
  4. Jika $\text{FREM}_i > b$ dan $m > 2^{t-1}$ dan $P_{(i,x)} < P_{(i,y)}$: $(P'_{(i,x)}, P'_{(i,y)}) = (P_{(i,x)} + \lceil m_1/2 \rceil, P_{(i,y)} + \lfloor m_1/2 \rfloor)$
  5. Jika $\text{FREM}_i \le b$ dan $m \le 2^{t-1}$ dan $P_{(i,x)} \ge P_{(i,y)}$: $(P'_{(i,x)}, P'_{(i,y)}) = (P_{(i,x)} + \lfloor m/2 \rfloor, P_{(i,y)} + \lceil m/2 \rceil)$
  6. Jika $\text{FREM}_i \le b$ dan $m \le 2^{t-1}$ dan $P_{(i,x)} < P_{(i,y)}$: $(P'_{(i,x)}, P'_{(i,y)}) = (P_{(i,x)} + \lceil m/2 \rceil, P_{(i,y)} + \lfloor m/2 \rfloor)$
  7. Jika $\text{FREM}_i \le b$ dan $m > 2^{t-1}$ dan $P_{(i,x)} \ge P_{(i,y)}$: $(P'_{(i,x)}, P'_{(i,y)}) = (P_{(i,x)} - \lceil m_1/2 \rceil, P_{(i,y)} - \lfloor m_1/2 \rfloor)$
  8. Jika $\text{FREM}_i \le b$ dan $m > 2^{t-1}$ dan $P_{(i,x)} < P_{(i,y)}$: $(P'_{(i,x)}, P'_{(i,y)}) = (P_{(i,x)} - \lfloor m_1/2 \rfloor, P_{(i,y)} - \lceil m_1/2 \rceil)$
* **Step 4 (Penanganan *Falling-Off-Boundary Problem* / FOBP - 3 Kasus):**  
  Jika $P'_{(i,x)}$ atau $P'_{(i,y)}$ keluar dari batas $[0, 255]$, lakukan revisi menjadi $(P''_{(i,x)}, P''_{(i,y)})$:
  * **Case 1 (Overflow Bawah di Area Gelap):** Jika $P'_{(i,x)} < 0$ atau $P'_{(i,y)} < 0$ dan keduanya dekat $0$, tambahkan $2^{t-1}$ pada kedua piksel: $(P'_{(i,x)} + 2^{t-1}, P'_{(i,y)} + 2^{t-1})$.
  * **Case 2 (Overflow Atas di Area Terang):** Jika $P'_{(i,x)} > 255$ atau $P'_{(i,y)} > 255$ dan keduanya dekat $255$, kurangi $2^{t-1}$ pada kedua piksel: $(P'_{(i,x)} - 2^{t-1}, P'_{(i,y)} - 2^{t-1})$.
  * **Case 3 (Kontras Ekstrem $d_i > 128$):** Geser sisa kelebihan batas ke piksel pasangannya sehingga salah satu bernilai tepat $0$ atau $255$ tanpa mengubah jumlah modulo $(P''_{(i,x)} + P''_{(i,y)}) \pmod{2^t}$.

### C. Tahapan Algoritma Ekstraksi (*Extraction*)
1. Pecah citra stego RGB menjadi kanal $R, G, B$ dan pasangkan piksel secara berurutan $(P^*_{(i,x)}, P^*_{(i,y)})$.
2. Hitung selisih $d^*_i = |P^*_{(i,x)} - P^*_{(i,y)}|$ dan cari sub-rentangnya pada tabel kanal terkait untuk mendapatkan $t = \lfloor \log_2(w_j) \rfloor$.
3. Hitung nilai desimal pesan rahasia:
   $$b = (P^*_{(i,x)} + P^*_{(i,y)}) \pmod{2^t}$$
4. Konversikan nilai desimal $b$ kembali menjadi deretan biner sepanjang $t$ bit.

---

## 5. DAFTAR OUTPUT YANG DIHASILKAN (DELIVERABLES)

Penelitian ini akan menghasilkan **3 kategori *output* utama** yang siap disajikan dalam laporan tugas akhir dan artikel jurnal ITSMART:

### Output 1: Artefak Perangkat Lunak (Kode Program Python)
1. **Modul Steganografi PVDM RGB (`pvdm_rgb_batik.py`):**
   * Fungsi *Embedding* dan *Extraction* untuk 3 skema pembanding:
     * **Skema 1:** PVDM *Modified Pixel Indicator* (Replikasi metode Awate & Patil, 2016).
     * **Skema 2:** PVDM RGB Simetris Standar (Tabel 6-level Wang et al. diterapkan seragam di R, G, B).
     * **Skema 3:** **PVDM RGB Asimetris Berbasis HVS (Metode Usulan: Green 7-level, Red 6-level, Blue 5-level)**.
2. **Modul Evaluasi Citra & Tekstur (`evaluation_metrics.py`):**
   * Perhitungan otomatis kapasitas maksimum (*bits* / *bytes* / *bpp*).
   * Perhitungan **MSE** dan **PSNR** per kanal ($\text{PSNR}_R, \text{PSNR}_G, \text{PSNR}_B$) serta **PSNR Gabungan (RGB)**.
   * Perhitungan **SSIM (*Structural Similarity Index Measure*)** untuk membuktikan keutuhan struktur motif Batik.
   * Perhitungan **BER (*Bit Error Rate*)** untuk membuktikan ekstraksi 100% *lossless* ($\text{BER} = 0\%$).
   * Pencatat otomatis (*counter*) jumlah kejadian *Falling-Off-Boundary Problem* (FOBP) pada setiap motif Batik.

### Output 2: Tabel Data & Grafik Eksperimen (Untuk Bab IV Jurnal)
1. **Tabel 1 (Analisis Kapasitas Maksimum per Kanal):**  
   Menunjukkan peningkatan kapasitas signifikan pada kanal Blue dan total kapasitas RGB metode usulan dibandingkan metode *Pixel Indicator* Awate & Patil (2016) dan PVDM Simetris.
2. **Tabel 2 (Evaluasi Kualitas Citra Multimetrik pada Variasi Payload):**  
   Menampilkan nilai $\text{MSE}, \text{PSNR}_R, \text{PSNR}_G, \text{PSNR}_B, \text{PSNR}_{\text{RGB}}$, dan $\text{SSIM}$ pada berbagai ukuran pesan rahasia (misal: 10 KB, 50 KB, 100 KB, hingga kapasitas penuh). Membuktikan bahwa **$\text{PSNR}_G$ selalu tertinggi** (karena diproteksi tabel 7-level) dan $\text{SSIM} > 0.99$.
3. **Tabel 3 (Korelasi Kerapatan Tekstur Batik terhadap Kapasitas & Kasus FOBP):**  
   Membandingkan proporsi pasangan piksel yang jatuh di area halus vs area tepi pada Batik Parang, Kawung, dan Megamendung, beserta frekuensi terpicunya Step 4 (FOBP).
4. **Visualisasi Citra & Histogram:**  
   Perbandingan berdampingan (*side-by-side*) antara *Cover Image* Batik dan *Stego Image* beserta perbandingan histogram RGB untuk membuktikan tidak adanya anomali visual.

### Output 3: Naskah Artikel Ilmiah Format IEEE (Target Jurnal ITSMART)
Dokumen naskah publikasi yang tersusun atas:
* **Abstract & Keywords**
* **I. Introduction** (Latar belakang, masalah kapasitas & HVS pada PVDM RGB, kontribusi riset).
* **II. Related Work & Theoretical Foundation** (Ulasan Wang et al. [2008], kritik metode Awate & Patil [2016], landasan rumus luminansi ITU-R BT.601-7 & biologi retina HVS Roorda & Williams [1999]).
* **III. Proposed Methodology** (Arsitektur sistem, desain 3 tabel rentang asimetris R-G-B, langkah algoritma *embedding* & *extraction*).
* **IV. Experimental Results and Discussion** (Analisis dataset Batik, pembahasan tabel kapasitas, grafik $\text{PSNR}$ per kanal, $\text{SSIM}$, dan evaluasi FOBP).
* **V. Conclusion**
* **References** (Format sitasi IEEE lengkap).

---

## 6. PETA JALAN EKSEKUSI SELANJUTNYA (NEXT STEPS)

1. **Tahap 1 (Implementasi Kode & Simulasi):** Menulis dan menjalankan skrip Python pada 3–5 sampel citra Batik Nusantara berukuran $512 \times 512$ piksel untuk menghasilkan seluruh angka tabel eksperimen dan grafik.
2. **Tahap 2 (Penyusunan Draf Naskah IEEE / ITSMART):** Menuangkan rumusan Bab I s/d Bab III yang sudah matang ke dalam templat jurnal ITSMART, diikuti pengisian Bab IV berdasarkan hasil eksekusi program Python.