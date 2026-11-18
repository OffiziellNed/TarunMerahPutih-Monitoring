// Inti scraping: Google News RSS (Bahasa Indonesia) -> daftar artikel bersih + analisis.
const TOPIK = require("../data/topik.json");
const PENGURUS = require("../data/pengurus.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function rssUrl(q, jam) {
  const when = jam % 24 === 0 && jam > 24 ? `${jam / 24}d` : `${jam}h`;
  const query = `${q} when:${when}`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
}

function decode(s = "") {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&");
}
const strip = (s = "") => decode(decode(s)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : "";
};

function parseRss(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const it = m[1];
    const srcM = it.match(/<source(?:\s+url="([^"]*)")?[^>]*>([\s\S]*?)<\/source>/);
    const media = srcM ? strip(srcM[2]) : "";
    let judul = strip(tag(it, "title"));
    if (media && judul.endsWith(` - ${media}`)) judul = judul.slice(0, -(media.length + 3));
    const tanggal = new Date(strip(tag(it, "pubDate")));
    items.push({
      judul,
      url: strip(tag(it, "link")),
      media: media || "Lainnya",
      mediaUrl: srcM && srcM[1] ? decode(srcM[1]) : "",
      tanggal: isNaN(tanggal) ? null : tanggal.toISOString(),
      ringkasan: strip(tag(it, "description")),
    });
  }
  return items;
}

async function fetchQuery(q, jam) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(rssUrl(q, jam), { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return parseRss(await r.text());
  } finally {
    clearTimeout(t);
  }
}

const kunciOrang = (p) => (p.kata_kunci && p.kata_kunci.length ? p.kata_kunci : [p.nama]);

function bangunKueri(topik) {
  const qs = [...(topik.kueri || [])];
  if (topik.pakai_pengurus) {
    const orang = PENGURUS.pengurus;
    const size = 4;
    for (let i = 0; i < orang.length; i += size) {
      const nama = orang.slice(i, i + size).flatMap(kunciOrang).map((n) => `"${n}"`);
      qs.push(`(${nama.join(" OR ")}) ${topik.konteks_pengurus || ""}`.trim());
    }
  }
  return qs;
}

// ---------- Sentimen (indikatif) ----------
// NEGATIF hanya bila ada SERANGAN yang mengarah KE kubu sendiri (figur / partai yang dipantau).
// Bila kubu sendiri yang menyerang / berkomentar soal pihak lain -> bukan negatif.
const kata = (s) => s.trim().split(/\s+/);
// pasif: subjek kalimat jadi korban (mis. "Puan dikritik")
const NEG_PASIF = kata(`dikritik dikecam disindir diserang dituding dituduh didesak dilaporkan dipolisikan digugat didemo
  dihujat dicibir disentil disemprot dikuliti dicopot dipecat diperiksa ditolak diboikot diserbu dirujak dirundung
  disomasi diolok diejek dicap dikritisi dipersoalkan disalahkan digeruduk diadukan dicecar disoraki ditetapkan`);
// aktif bernada serangan: negatif bila PELAKU bukan kubu sendiri dan kubu jadi objek
const NEG_AKTIF = kata(`kritik kecam sindir serang tuding tuduh desak laporkan polisikan gugat demo hujat cibir sentil semprot
  kuliti copot pecat tolak boikot somasi lawan protes olok ejek salahkan persoalkan pertanyakan geruduk adukan cecar kritisi
  bongkar periksa tetapkan seret`);
// kata kerja ucapan: menandai kubu sendiri sedang berbicara (bukan diserang)
const UCAPAN = kata(`sebut singgung ungkap kata bilang nilai tegaskan respons tanggapi jawab bantah minta ingatkan soroti
  klaim akui beber ajak dukung apresiasi pastikan yakin optimistis heran curiga duga sesalkan`);
// kata benda bernada tuduhan: negatif bila menempel pada kubu sendiri dan kubu bukan pembicara
const NEG_SIFAT = kata(`korupsi suap gratifikasi tersangka skandal polemik kontroversi kontroversial blunder dinasti
  nepotisme oligarki arogan otoriter munafik kisruh ricuh bobrok borok aib`);

const SUFIKS_KERJA = ["", "nya", "kan", "i", "an"];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// cari posisi kata dalam teks (kata kerja boleh berimbuhan akhir, kata benda hanya +nya)
function posisiKata(teks, daftar, sufiks) {
  const pos = [];
  for (const w of daftar) {
    const re = new RegExp(`(^|[^a-z0-9])${esc(w)}(${sufiks.filter(Boolean).join("|") || "(?!)"})?(?=[^a-z0-9]|$)`, "g");
    let m;
    while ((m = re.exec(teks))) pos.push(m.index + m[1].length);
  }
  return pos.sort((a, b) => a - b);
}

function sentimen(judul, kubu = []) {
  const lower = judul.toLowerCase().replace(/[–—]/g, "-");
  // pecah per anak kalimat agar subjek & objek dinilai di klausa yang sama
  const klausa = lower.split(/\s*[,;:|]\s*|\s+-\s+/).filter(Boolean);
  const kubuKecil = kubu.map((x) => x.toLowerCase());
  let negatif = false;

  let subjekKubu = false; // apakah klausa sebelumnya menyebut kubu sendiri
  for (const k of klausa) {
    let pKubu = posisiKata(k, kubuKecil, ["nya"]);
    // Judul sering menghilangkan subjek setelah koma: "Pinka Disorot, Dituding Tak Lulus S1"
    // -> subjek klausa kedua = kubu dari klausa sebelumnya.
    if (!pKubu.length && subjekKubu) pKubu = [-1];
    subjekKubu = pKubu.length > 0;
    if (!pKubu.length) continue; // klausa tidak menyebut kubu sendiri -> bukan serangan ke kita
    const pPasif = posisiKata(k, NEG_PASIF, ["nya"]);
    const pAktif = posisiKata(k, NEG_AKTIF, SUFIKS_KERJA);
    const pUcap = posisiKata(k, UCAPAN, SUFIKS_KERJA);
    const pSifat = posisiKata(k, NEG_SIFAT, ["nya"]);

    // 1) pasif dengan kubu sebagai subjek: "Puan dikritik", "Kebijakan Ketua DPR dikecam"
    if (pPasif.some((v) => pKubu.some((s) => s < v))) { negatif = true; break; }
    // pasif dengan kubu sebagai pelaku: "Jokowi dikritik PDIP" -> kubu yang menyerang
    if (pPasif.length && pKubu.every((s) => s > pPasif[0])) continue;

    // kata kerja pertama di klausa -> siapa pelakunya?
    const kerja = [...pAktif, ...pUcap].sort((a, b) => a - b)[0];
    const kubuPelaku = kerja !== undefined && pKubu.some((s) => s < kerja);
    if (kubuPelaku) continue; // "Hasto tuduh Jokowi ...", "Sekjen PDIP singgung ..." -> kubu yang bicara

    // 2) aktif: pihak lain menyerang kubu ("Pengamat kritik Puan", "KPK periksa Hasto")
    if (pAktif.some((v) => pKubu.some((s) => s > v))) { negatif = true; break; }

    // 3) tuduhan menempel ke kubu: "Polemik pernyataan Puan", "Skandal ... PDIP"
    if (pSifat.length) { negatif = true; break; }
  }
  // selain serangan ke kubu sendiri, semua berita dihitung positif
  return negatif ? "negatif" : "positif";
}

const STOP = new Set("dan di ke dari yang untuk dengan pada ini itu dalam akan jadi soal oleh atas tak tidak bisa ada usai kata sebut minta beri juga para jelang hingga agar sudah masih lebih baru kini saat terkait bagi as vs ri pdip pdi perjuangan".split(" "));

function analisis(items, topikId) {
  const perHari = {};
  const perMedia = {};
  const kata = {};
  const sent = { positif: 0, negatif: 0 };
  const tokoh = {};
  for (const it of items) {
    if (it.tanggal) {
      const d = it.tanggal.slice(0, 10);
      perHari[d] = (perHari[d] || 0) + 1;
    }
    perMedia[it.media] = (perMedia[it.media] || 0) + 1;
    sent[it.sentimen]++;
    for (const w of it.judul.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)) {
      if (w.length > 3 && !STOP.has(w) && !/^\d+$/.test(w)) kata[w] = (kata[w] || 0) + 1;
    }
    for (const n of it.tokoh || []) tokoh[n] = (tokoh[n] || 0) + 1;
  }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, jumlah]) => ({ label, jumlah }));
  return {
    total: items.length,
    jumlahMedia: Object.keys(perMedia).length,
    sentimen: sent,
    perHari: Object.entries(perHari).sort().map(([tanggal, jumlah]) => ({ tanggal, jumlah })),
    topMedia: top(perMedia, 8),
    topKata: top(kata, 15),
    tokoh: topikId === "tmp" ? top(tokoh, 40) : [],
  };
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80);

async function ambilBerita(topikId, jam = 168) {
  const topik = TOPIK.topik.find((t) => t.id === topikId);
  if (!topik) throw Object.assign(new Error("Topik tidak dikenal"), { status: 404 });

  const kueri = bangunKueri(topik);
  const hasil = await Promise.allSettled(kueri.map((q) => fetchQuery(q, jam)));
  const gagal = hasil.filter((h) => h.status === "rejected").length;

  const seen = new Set();
  let items = [];
  for (const h of hasil) {
    if (h.status !== "fulfilled") continue;
    for (const it of h.value) {
      const k = norm(it.judul);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      items.push(it);
    }
  }

  const orang = PENGURUS.pengurus.map((p) => ({
    nama: p.nama,
    kunci: kunciOrang(p).map((k) => k.toLowerCase()),
    kecuali: (p.kecualikan || []).map((k) => k.toLowerCase()),
  }));
  const sasaran = [...new Set([...(TOPIK.kubu || []), ...(topik.sasaran || []), ...(topik.pakai_pengurus ? PENGURUS.pengurus.flatMap(kunciOrang) : [])])];
  items = items.map((it) => {
    const teks = `${it.judul} ${it.ringkasan}`;
    const lower = teks.toLowerCase();
    const tokoh = topik.pakai_pengurus ? orang.filter((o) => o.kunci.some((k) => lower.includes(k)) && !o.kecuali.some((k) => lower.includes(k))).map((o) => o.nama) : [];
    return { ...it, sentimen: sentimen(it.judul, sasaran), tokoh };
  });

  if (topik.pakai_pengurus) {
    // buang hasil yang tidak benar-benar menyebut organisasi / pengurus,
    // dan buang "TMP" yang berarti Taman Makam Pahlawan
    const tolak = new RegExp((topik.kecualikan || []).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "$^", "i");
    items = items.filter((it) => {
      const t = `${it.judul} ${it.ringkasan}`;
      if (/taruna merah putih/i.test(t) || it.tokoh.length) return true;
      // hanya menyebut "TMP": wajib ada konteks partai & bukan Taman Makam Pahlawan
      return /\bTMP\b/.test(t) && /PDIP|PDI[- ]Perjuangan/i.test(t) && !tolak.test(t);
    });
  }

  // pastikan sesuai rentang waktu (Google kadang menyertakan berita lebih lama)
  const batas = Date.now() - jam * 3600e3;
  items = items.filter((it) => !it.tanggal || new Date(it.tanggal).getTime() >= batas);

  items.sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));
  items = items.slice(0, 150);

  return {
    topik: { id: topik.id, judul: topik.judul, deskripsi: topik.deskripsi },
    rentangJam: jam,
    diperbarui: new Date().toISOString(),
    kueriGagal: gagal,
    jumlahKueri: kueri.length,
    analisis: analisis(items, topik.id),
    artikel: items,
  };
}

module.exports = { ambilBerita, parseRss, bangunKueri, sentimen, TOPIK };
