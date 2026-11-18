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

// ---------- Analisis ringan (indikatif) ----------
const POS = "apresiasi dukung dukungan sukses berhasil prestasi bantu bantuan peduli raih menang solid inovasi positif bangga meningkat peningkatan resmikan sejahtera kolaborasi gotong royong berdaya penghargaan terbaik optimis harmonis membangun maju kompak".split(" ");
const NEG = "kritik kecam tolak penolakan kasus korupsi dugaan tersangka diperiksa periksa kpk gugat gugatan polemik kontroversi skandal mundur pecat konflik bantah tuding tudingan hoaks ricuh demo protes gagal kalah anjlok rugi tuntut desak kisruh ancam lapor laporan bermasalah cekcok".split(" ");
const STOP = new Set("dan di ke dari yang untuk dengan pada ini itu dalam akan jadi soal oleh atas tak tidak bisa ada usai kata sebut minta beri jadi juga para jelang hingga agar sudah masih lebih baru kini saat terkait bagi as vs ri pdip pdi perjuangan".split(" "));

function sentimen(teks) {
  const t = ` ${teks.toLowerCase()} `;
  let s = 0;
  for (const w of POS) if (t.includes(` ${w}`)) s++;
  for (const w of NEG) if (t.includes(` ${w}`)) s--;
  return s > 0 ? "positif" : s < 0 ? "negatif" : "netral";
}

function analisis(items, topikId) {
  const perHari = {};
  const perMedia = {};
  const kata = {};
  const sent = { positif: 0, netral: 0, negatif: 0 };
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

  const orang = PENGURUS.pengurus.map((p) => ({ nama: p.nama, kunci: kunciOrang(p).map((k) => k.toLowerCase()) }));
  items = items.map((it) => {
    const teks = `${it.judul} ${it.ringkasan}`;
    const lower = teks.toLowerCase();
    const tokoh = topik.pakai_pengurus ? orang.filter((o) => o.kunci.some((k) => lower.includes(k))).map((o) => o.nama) : [];
    return { ...it, sentimen: sentimen(it.judul), tokoh };
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

module.exports = { ambilBerita, parseRss, bangunKueri, TOPIK };
