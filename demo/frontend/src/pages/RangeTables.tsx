import { useState } from 'react';

const standard = [7, 15, 31, 63, 127, 255];
const green = [3, 7, 15, 31, 63, 127, 255];
const blue = [15, 31, 63, 127, 255];

function RangeTable({ title, ends, difference }: { title: string; ends: number[]; difference: number }) {
  return <table className="lookup"><caption>{title}</caption>
    <thead><tr><th>Selisih d</th><th>Lebar w</th><th>Bit t</th></tr></thead>
    <tbody>{ends.map((upper, i) => {
      const lower = (ends[i - 1] ?? -1) + 1;
      const width = upper - lower + 1;
      const selected = lower <= difference && difference <= upper;
      return <tr key={upper} className={selected ? 'matched-range' : ''}>
        <th scope="row">{lower}–{upper}{selected && ' ✓'}</th>
        <td>{width}</td><td>{Math.log2(width)}</td>
      </tr>;
    })}</tbody>
  </table>;
}

export function RangeTables() {
  const [difference, setDifference] = useState(6);
  return <section id="rentang"><h2>Cara membaca tabel rentang</h2>
    <p>Bayangkan dua nilai hijau 100 dan 106. Jarak keduanya adalah 6. Di tabel hijau Skema 3, cari baris yang memuat angka 6, yaitu 4–7. Hitung keempat kemungkinan selisihnya (4, 5, 6, 7). Karena dua bit memiliki empat kombinasi (00, 01, 10, 11), pasangan ini mendapat jatah dua bit pesan.</p>
    <code className="equation">w = batas atas − batas bawah + 1<br/>t = ⌊log₂ w⌋</code>
    <p>Lebar semua rentang di sini adalah pangkat dua. Untuk w = 4, log₂ 4 berarti “dua dipangkatkan berapa agar hasilnya empat?” Jawabannya 2. Simbol ⌊ ⌋ berarti membulatkan ke bawah.</p>
    <div className="range-explorer"><label htmlFor="difference">Sorot baris untuk selisih <strong>{difference}</strong></label>
      <input id="difference" type="range" min="0" max="255" value={difference} onChange={e => setDifference(Number(e.target.value))}/>
      <p>Geser kontrol atau gunakan tombol panah. Tanda ✓ menunjukkan baris yang akan dibaca program pada setiap tabel.</p>
      <RangeTable title="Tabel standar · Skema 1 pada kanal terpilih, Skema 2 pada R/G/B, dan Skema 3 pada R" ends={standard} difference={difference}/>
      <RangeTable title="Tabel hijau · Skema 3 pada G" ends={green} difference={difference}/>
      <RangeTable title="Tabel biru · Skema 3 pada B" ends={blue} difference={difference}/>
    </div>
    <p>Pada d = 6, hasilnya merah 3 bit, hijau 2 bit, dan biru 4 bit. Pada d = 42, ketiganya memberi 5 bit. Dalam citra asli, program menghitung d sendiri untuk tiap kanal. Dua piksel yang sama dapat memiliki selisih merah, hijau, dan biru yang berbeda.</p>
  </section>;
}
