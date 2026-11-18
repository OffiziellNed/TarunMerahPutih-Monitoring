# Taruna Merah Putih – Monitoring

Portal monitoring berisi:

1. **Pemberitaan** (4 kanal): Berita Taruna Merah Putih (organisasi + semua pengurus pusat), Megawati Soekarnoputri, Puan Maharani, PDI Perjuangan. Datanya diambil langsung dari Google News RSS (Indonesia), lengkap dengan grafik volume per hari, media teratas, sentimen indikatif, kata kunci dominan, filter pengurus, dan ekspor CSV.
2. **Counter Issue**: daftar isu → bisa dibuka satu per satu (narasi isu, kontra-narasi, poin kunci yang bisa disalin, referensi).
3. **Prestasi Kerja**: daftar program → bisa dibuka satu per satu (capaian angka, isi, galeri, liputan media).

Tanpa build step dan tanpa dependency. Cukup HTML/CSS/JS statis + 1 serverless function.

## Struktur

```
index.html              # aplikasi (SPA, routing pakai #)
assets/                 # CSS, JS, logo (sudah dibersihkan dari ikon pojok)
api/news.js             # GET /api/news?topik=tmp|pdip|megawati|puan&jam=168 (6, 12, 24, 72, 168, 336, 720)
lib/news.js             # scraping Google News RSS + analisis
data/pengurus.json      # nama pengurus pusat → otomatis jadi kata kunci scraping
data/topik.json         # kata kunci untuk 4 kanal berita
data/counter-issue.json # isi menu Counter Issue
data/prestasi-kerja.json# isi menu Prestasi Kerja
scripts/                # server lokal, data mock, tes parser
```

## Upload ke GitHub

```bash
cd tmp-monitoring
git init && git add . && git commit -m "TMP Monitoring v1"
git branch -M main
git remote add origin https://github.com/<akun-anda>/tmp-monitoring.git
git push -u origin main
```

Disarankan repo **Private**.

## Deploy ke Vercel

1. Buka vercel.com → **Add New… → Project** → pilih repo `tmp-monitoring`.
2. Framework Preset: **Other**. Build Command & Output Directory: biarkan kosong.
3. Klik **Deploy**. Selesai — setiap `git push` ke `main` otomatis deploy ulang.

Hasil berita di-cache 15 menit di edge Vercel supaya cepat dan tidak membebani sumber.

## Mengubah data (lewat GitHub)

Edit file di folder `data/` langsung dari GitHub (ikon pensil) → Commit → Vercel deploy otomatis ±30 detik.

**Counter Issue** (`data/counter-issue.json`) – satu objek per isu:

| field | keterangan |
|---|---|
| `id` | unik, huruf kecil-strip, dipakai di URL (`#/counter-issue/<id>`) |
| `status` | `Aktif` · `Dipantau` · `Selesai` |
| `prioritas` | `Tinggi` · `Sedang` · `Rendah` |
| `narasi_isu`, `kontra_narasi` | teks; mendukung `## Judul`, `- daftar`, `**tebal**`, `[tautan](url)` |
| `poin_kunci` | daftar pesan kunci (ada tombol salin) |
| `referensi` | `[{ "judul": "...", "url": "..." }]` |

**Prestasi Kerja** (`data/prestasi-kerja.json`): `capaian` = `[{ "label": "Peserta", "nilai": "1.200" }]`, `sampul` & `galeri` = URL gambar (atau taruh foto di folder `uploads/` lalu tulis `/uploads/nama.jpg`).

Entri berlabel `[CONTOH]` hanya contoh format — hapus/ganti.

**Pengurus** (`data/pengurus.json`): tambah `kata_kunci` bila seseorang lebih dikenal dengan nama lain (mis. nama panggilan) supaya beritanya ikut tertangkap.

**Kata kunci kanal** (`data/topik.json`): ubah `kueri` sesuai kebutuhan. Pakai tanda kutip untuk frasa persis.

## Jalan di komputer sendiri

```bash
npm run dev            # http://localhost:3000 (butuh internet untuk berita)
MOCK=1 npm run dev     # pakai berita contoh, tanpa internet
npm test               # tes parser
```

## Catatan

- Sentimen dihitung dari kata kunci di judul (positif/negatif sederhana) — sifatnya indikatif, bukan penilaian final.
- Nama yang umum (mis. “Ahmad Rizal”) dicari bersama konteks *Taruna Merah Putih / TMP / PDIP / PDI Perjuangan* agar tidak tercampur orang lain dengan nama sama.
- Situs diberi `noindex` agar tidak muncul di mesin pencari.
