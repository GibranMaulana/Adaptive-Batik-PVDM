export function MessageTrace() {
  return <>
    <h3>Dari empat pasangan ke satu huruf</h3>
    <p>Satu bit bernilai 0 atau 1. Delapan bit membentuk satu byte. Baca isi tabel dari kiri ke kanan, baris demi baris. Tiap sel berisi bit yang dititipkan pada satu kanal. Panjang tiap kelompok mengikuti tabel rentang kanal tersebut.</p>
    <table><caption>Seluruh penyisipan huruf A pada Kawung 01, Skema 3, baris 0</caption>
      <thead><tr><th>Kolom piksel</th><th>R</th><th>G</th><th>B</th></tr></thead>
      <tbody>{[
        ['0 dan 1','0000','0000','0000'],
        ['2 dan 3','0000','0000','0000'],
        ['4 dan 5','000','00','0010'],
        ['6 dan 7','10000','01000','—'],
      ].map(([pair,r,g,b]) => <tr key={pair}><th>{pair}</th><td><code>{r}</code></td><td><code>{g}</code></td><td><code>{b}</code></td></tr>)}</tbody>
    </table>
    <p>Pada kolom 4 dan 5, kelompok biru <code>0010</code> membawa tiga bit terakhir header (001) dan bit pertama huruf A (0). Di pasangan berikutnya, merah membawa lima bit pesan (10000). Hijau membawa dua bit terakhir (01) dan tiga nol pengisi (000). Pesan sudah habis sehingga biru dilewati.</p>
    <p>Saat membaca PNG, susun kembali bagian pesan itu sesuai urutannya.</p>
    <code className="equation">0 + 10000 + 01 → 01000001 → A</code>
    <p>Tanda + di sini berarti menyambung potongan bit. Dalam mode otomatis, demo mencoba tiap skema dan memeriksa apakah header masuk akal serta byte dapat dibaca sebagai UTF-8. Jika beberapa skema lolos, pilih skema yang dipakai saat penyisipan.</p>
  </>;
}

const shifts = [
  ['1','F > b','m ≤ h','P ≥ Q','−U','−L'],
  ['2','F > b','m ≤ h','P < Q','−L','−U'],
  ['3','F > b','m > h','P ≥ Q','+L','+U'],
  ['4','F > b','m > h','P < Q','+U','+L'],
  ['5','F ≤ b','m ≤ h','P ≥ Q','+L','+U'],
  ['6','F ≤ b','m ≤ h','P < Q','+U','+L'],
  ['7','F ≤ b','m > h','P ≥ Q','−U','−L'],
  ['8','F ≤ b','m > h','P < Q','−L','−U'],
];

export function ShiftTable() {
  return <>
    <h3>Delapan aturan pergeseran</h3>
    <p>F adalah sisa awal (FREM), b target bit dalam desimal, dan h separuh modulus. Pilih jarak k yang lebih kecil antara m dan m₁. Bagi k menjadi dua bagian, U = ⌈k/2⌉ dibulatkan ke atas dan L = ⌊k/2⌋ dibulatkan ke bawah. Dua kolom terakhir menunjukkan perubahan yang ditambahkan pada intensitas awal.</p>
    <table><caption>Pilih baris yang memenuhi ketiga kondisi</caption>
      <thead><tr><th>Kasus</th><th>Kondisi</th><th>ΔP</th><th>ΔQ</th></tr></thead>
      <tbody>{shifts.map(([id,f,d,order,p,q]) => <tr key={id}><th>{id}</th><td>{[f,d,order].join(', ')}</td><td>{p}</td><td>{q}</td></tr>)}</tbody>
    </table>
    <p>Contoh merah Kawung memakai kasus 6. F = 14, b = 16, m = 2, h = 16, dan 178 &lt; 220. Dengan k = 2, U dan L sama-sama 1. Itu asal kenaikan satu pada setiap piksel.</p>
  </>;
}

export function TextureResults() {
  return <>
    <h3>Bagaimana tekstur batik memengaruhi kapasitas?</h3>
    <p>Penelitian menghitung selisih setiap pasangan per kanal. Selisih di bawah 16 dikelompokkan sebagai area halus, sedangkan 16 ke atas sebagai tepi. Pada citra 512 × 512, setiap baris memiliki 256 pasangan. Berarti ada 131.072 pasangan spasial yang bisa diperiksa, masing-masing dengan tiga kanal.</p>
    <table><caption>Rata-rata per motif, Skema 3 pada kapasitas penuh</caption>
      <thead><tr><th>Motif</th><th>Area tepi</th><th>Bit/piksel</th><th>Laju FOBP</th></tr></thead>
      <tbody>{[['Parang','21,36%','5,13','2,50%'],['Kawung','27,65%','5,23','1,53%'],['Megamendung','14,71%','4,95','2,65%']].map(([motif,edge,bpp,rate]) =>
        <tr key={motif}><th>{motif}</th><td>{edge}</td><td>{bpp}</td><td>{rate}</td></tr>)}</tbody>
    </table>
    <p>Kawung memiliki proporsi tepi dan kapasitas rata-rata tertinggi di dataset ini. Megamendung memiliki proporsi tepi terendah tetapi laju koreksi batas tertinggi. Koreksi batas terjadi saat pergeseran mendorong intensitas melewati 0 atau 255. Laju Skema 3 dihitung sebagai 100% × jumlah koreksi / (3 × pasangan terpakai).</p>
    <h3>Membaca kemiripan struktur</h3>
    <p>SSIM membandingkan potongan kecil citra asli x dengan lokasi yang sama pada hasil y. Pada jendela Gaussian 11 × 11, μ adalah rata-rata intensitas, σ² adalah varians, dan σxy adalah kovarians kedua potongan. Program menggabungkan kesamaan terang dan kesamaan pola, lalu merata-ratakan hasilnya.</p>
    <code className="equation">Terang = (2μxμy + C₁) / (μx² + μy² + C₁)<br/>Pola = (2σxy + C₂) / (σx² + σy² + C₂)<br/>SSIM lokal = Terang × Pola</code>
    <p>C₁ = (0,01 × 255)² dan C₂ = (0,03 × 255)² menjaga pembagian tetap stabil pada bagian yang rata. Pada Kawung 10 KiB, rata-rata SSIM RGB Skema 3 adalah 0,9996. BER 0% pada pengujian PNG menunjukkan bit pesan pulih. Ketahanan setelah kompresi JPEG dan deteksi statistik merupakan pertanyaan lanjutan dalam paper.</p>
  </>;
}
