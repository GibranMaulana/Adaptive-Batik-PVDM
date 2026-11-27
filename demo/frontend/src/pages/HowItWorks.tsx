import './how-it-works.css';
import { RangeTables } from './RangeTables';
import { MessageTrace, ShiftTable, TextureResults } from './MethodDetails';
import kawung from '../assets/kawung-guide.webp';

const chapters = [
  ['citra', 'Citra dan pesan'],
  ['skema', 'Tiga skema RGB'],
  ['rentang', 'Tabel rentang lengkap'],
  ['hitung', 'Perhitungan piksel'],
  ['ekstraksi', 'Ekstraksi pesan'],
  ['eksperimen', 'Hasil penelitian'],
];

export function HowItWorks() {
  return <div className="batik-guide" lang="id">
    <header><a className="font-editorial" href="/">BATIK PVDM</a><a href="/">Kembali ke converter ↗</a></header>
    <main>
      <div className="guide-intro"><div><h1 className="font-editorial">How It Works</h1>
        <p>Bagaimana sepotong pesan tersimpan di dalam motif batik?</p>
        <p>Penelitian ini mengukur ruang yang tersedia untuk pesan, perubahan pada gambar, dan ketepatan saat pesan dibaca kembali. Ikuti huruf A dari teks hingga menjadi perubahan kecil pada dua piksel Kawung.</p></div>
        <figure><img src={kawung} alt="Sampel Kawung dengan pola geometris berulang" width="512" height="512"/><figcaption>Kawung 01 · citra asli · 512 × 512 piksel</figcaption></figure>
      </div>
      <div className="guide-body"><nav aria-label="Isi halaman"><b>Isi halaman</b>{chapters.map(([id, title]) => <a key={id} href={'#' + id}>{title}</a>)}</nav>
      <article>
      <section id="citra"><h2>Citra dan pesan</h2>
        <p>Steganografi menyimpan pesan lewat perubahan kecil pada gambar. Di sini pertanyaannya adalah seberapa banyak data yang bisa dititipkan, kanal warna mana yang menanggung perubahan, dan apakah penerima dapat membaca pesannya kembali. Pola geometris Parang dan Kawung serta gradasi Megamendung memberi contoh tekstur berbeda untuk menguji hubungan antara kontras dan kapasitas.</p>
        <p>Setiap piksel menyimpan tiga intensitas dari 0 sampai 255 untuk merah (R), hijau (G), dan biru (B). Gambar awal disebut <i>cover</i>, pesan yang dibawa disebut <i>payload</i>, dan hasil penyisipan disebut citra <i>stego</i>.</p>
        <p>Program mengubah A menjadi satu byte UTF-8, yaitu <code>01000001</code>. Di depannya program menaruh 32 bit yang menyatakan panjang pesan dalam byte. Untuk A, header itu berisi 31 nol diikuti angka satu. Totalnya 40 bit.</p>
        <p>Program memeriksa kapasitas, lalu membaca pasangan horizontal per baris dari kiri ke kanan, dua piksel sekali jalan. Untuk Skema 3, setiap pasangan dikunjungi dalam urutan R, G, B sampai semua bit tertulis.</p>
      </section>
      <section id="skema"><h2>Mengapa tiga skema RGB?</h2>
        <p>Pixel-Value Differencing and Modulus Function (PVDM) menyesuaikan jumlah bit dengan kontras lokal. Pasangan di dalam bidang warna yang rata cenderung menampung lebih sedikit bit daripada pasangan yang melintasi tepi motif. Sisa bagi jumlah kedua intensitas membawa nilai bit tersebut.</p>
        <dl><dt>Skema 1 · Pixel Indicator</dt><dd>Dua bit terendah kanal merah piksel pertama menentukan tujuan. Untuk 01 program memakai hijau, untuk 10 memakai biru, dan untuk 00 atau 11 pasangan dilewati.</dd>
        <dt>Skema 2 · RGB simetris</dt><dd>Semua kanal aktif memakai tabel enam rentang yang sama. Ini memberi dasar untuk mengukur dampak perlakuan berbeda pada setiap kanal.</dd>
        <dt>Skema 3 · RGB asimetris berbasis HVS</dt><dd>Pada model luminansi Y = 0,299R + 0,587G + 0,114B, hijau memiliki bobot terbesar. Tim menggunakan pertimbangan sistem penglihatan manusia (HVS) ini untuk merancang rentang lebih sempit pada hijau dan lebih lebar pada biru di area halus. Geser selisih di bawah untuk melihat efeknya.</dd></dl>

      </section>
      <RangeTables/>
      <section id="hitung"><h2>Ikuti satu pasangan piksel</h2>
        <p>Pada baris pertama Kawung 01, kolom 6 dan 7 (indeks mulai dari nol) memiliki RGB (178, 131, 80) dan (220, 175, 117). Saat Skema 3 mencapai kanal merah pasangan ini, program telah membaca header dan bit pertama A. Lima bit berikutnya adalah <code>10000</code>, bernilai 16.</p>
        <div className="pixel-pair" aria-label="Dua piksel asli yang diperbesar"><span><i style={{backgroundColor:'rgb(178,131,80)'}}/>Kolom 6 · R = 178</span><span><i style={{backgroundColor:'rgb(220,175,117)'}}/>Kolom 7 · R = 220</span></div>
        <ol><li><b>Ukur selisih.</b> P dan Q adalah intensitas merah kedua piksel.<code className="equation">d = |P − Q| = |178 − 220| = 42</code></li>
        <li><b>Tentukan kapasitas.</b> Selisih 42 masuk rentang [32, 63]. Lebar w menghitung kedua ujung rentang. Jumlah bit t bergantung pada lebar itu.<code className="equation">w = 63 − 32 + 1 = 32<br/>t = ⌊log₂(w)⌋ = 5 bit</code></li>
        <li><b>Hitung perubahan.</b> Target b adalah 16. Operasi mod mengambil sisa pembagian. Jarak langsung dari sisa awal ke target adalah 2, sedangkan jarak memutar melalui batas modulus adalah 30. Aturan pergeseran memilih kenaikan 2 dan membaginya rata ke kedua piksel.<code className="equation">FREM = (178 + 220) mod 2⁵ = 14<br/>m = |14 − 16| = 2<br/>m₁ = 32 − 2 = 30<br/>(178 + 1, 220 + 1) = (179, 221)</code></li>
        <li><b>Periksa hasil.</b> Selisih baru masih 42. Saat ekstraksi, rentangnya memberi t = 5 lagi. Sisa bagi 16 ditulis dengan lima bit sehingga potongan pesan pulih.<code className="equation">(179 + 221) mod 32 = 16 = 10000₂</code></li></ol>
        <ShiftTable/>
        <details><summary>Bagaimana program memilih pergeseran dan menjaga batas piksel?</summary>
        <p>Delapan kasus berasal dari tiga keputusan. Program membandingkan FREM dengan b, memilih jarak langsung m jika m ≤ 2ᵗ/2 atau komplemen m₁ jika lebih pendek, lalu membandingkan P dengan Q. Melalui komplemen, arah perubahan berbalik. Saat menambah, piksel lebih kecil mendapat pembulatan ke atas dari separuh jarak. Saat mengurangi, piksel lebih besar mendapat pembulatan ke atas. Pasangannya menerima pembulatan ke bawah.</p>
        <p>Jika intensitas keluar dari 0–255 (FOBP) dan selisih awal ≤ 128, program menambah setengah modulus ke keduanya saat terjadi nilai negatif, atau menguranginya saat melewati 255. Untuk kontras lebih besar, program mengunci nilai yang keluar pada batas dan menyesuaikan pasangannya. Misalnya pada hijau, (0, 0) dengan target 11 mula-mula menjadi (−1, 0). Koreksi menghasilkan (1, 2), dengan jumlah 3 sesuai target.</p>
        <p>Jika selisih berpindah rentang, <i>sub-range guard</i> mencari kandidat sah dengan jumlah kuadrat perubahan terkecil di antara kandidat yang diperiksa. Contoh hijau (104, 100) dengan target 01 semula menjadi (104, 101). Selisih 3 keluar dari [4, 7]. Hasil koreksi (105, 100) punya selisih 5 dan jumlah 205 mod 4 = 1.</p></details>
      </section>
      <section id="ekstraksi"><h2>Membaca pesan dari PNG</h2><p>PNG menyimpan intensitas hasil secara lossless. Dengan skema yang sesuai, penerima menelusuri pasangan dan kanal dalam urutan yang sama, mencari t dari selisih piksel stego, lalu mengambil sisa bagi jumlahnya. Proses ini disebut ekstraksi buta karena cukup memakai gambar hasil.</p>
      <p>Ekstraktor membaca 32 bit awal sebagai panjang pesan. Untuk contoh Kawung, panjangnya satu byte. Delapan bit berikutnya membentuk 01000001, yang dibaca sebagai A. Jika pasangan terakhir punya sisa ruang, header membantu ekstraktor mengabaikan bit pengisi.</p><MessageTrace/></section>
      <ResearchResults/>
      <a href="/">Coba pada converter ↗</a>
      </article></div>
    </main>
  </div>;
}

function ResearchResults() {
  return <section id="eksperimen"><h2>Apa yang ditunjukkan eksperimen?</h2>
    <p>Tim membandingkan tiga skema pada 45 PNG RGB berukuran 512 × 512, masing-masing 15 citra Parang, Kawung, dan Megamendung. Pesan uji berukuran 10, 50, 100 KiB dan kapasitas penuh. Pada 50 dan 100 KiB pesan melampaui kapasitas Skema 1. Pada kapasitas penuh, jumlah byte mengikuti kemampuan setiap skema.</p>
    <dl><dt>Berapa banyak ruang yang tersedia?</dt><dd>Jumlahkan t semua pasangan dan kanal aktif untuk memperoleh kapasitas bruto C dalam bit. Kapasitas pesan dalam byte adalah ⌊C/8⌋ − 4 jika header muat. Laju kapasitas bpp = C / (tinggi × lebar). Pada Kawung, rata-rata kapasitas bruto Skema 3 mencapai 5,23 bpp. Pada 45 citra, korelasi proporsi area tepi dengan bpp Skema 3 mencapai r = 0,9574.</dd>
    <dt>Seberapa besar perubahan gambar?</dt><dd>MSE adalah rata-rata kuadrat selisih intensitas asli dan hasil. PSNR mengubah besarnya galat menjadi desibel. Pada kanal yang sama, PSNR lebih tinggi berarti galat lebih kecil.<code className="equation">MSE = Σ (asli − hasil)² / jumlah nilai<br/>PSNR = 10 log₁₀(255² / MSE)</code>SSIM membandingkan kecerahan, kontras, dan struktur lokal. Nilai mendekati 1 menunjukkan kemiripan tinggi. Paper menghitungnya pada kanal RGB dan luminansi Y.</dd>
    <dt>Apakah pesan kembali utuh?</dt><dd>BER = (jumlah bit salah / jumlah bit pesan) × 100%. Dalam pengujian yang muat, BER mencapai 0%. Angka ini mengukur pemulihan pesan dari PNG hasil.</dd></dl>
    <table><caption>Rata-rata 15 citra Kawung pada payload 10 KiB</caption><thead><tr><th>Skema</th><th>PSNR hijau (dB)</th><th>PSNR RGB (dB)</th><th>BER</th></tr></thead><tbody>{[['1','50,69','52,50'],['2','52,50','52,51'],['3','53,09','51,95']].map(([scheme,g,rgb]) => <tr key={scheme}><th>{scheme}</th><td>{g}</td><td>{rgb}</td><td>0%</td></tr>)}</tbody></table>
    <p>Dibanding Skema 2, Skema 3 menaikkan PSNR hijau pada contoh uji ini, sedangkan PSNR RGB turun. Hasil tersebut memperlihatkan konsekuensi pilihan tabel untuk melindungi hijau.</p>
    <TextureResults/>
    <a href="https://github.com/GibranMaulana/Adaptive-Batik-PVDM/blob/feat/demo/paper/main.tex">Baca metode dan tabel hasil dalam laporan ↗</a>
  </section>;
}
