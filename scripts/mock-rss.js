// Generator RSS palsu untuk uji tampilan tanpa internet.
const MEDIA = ["Kompas.com", "detikNews", "CNN Indonesia", "Tempo.co", "Antara News", "Liputan6.com", "Tribunnews.com", "Kumparan"];
const POLA = [
  "{n} hadiri dialog kebangsaan bersama pemuda",
  "{n} apresiasi program pelatihan UMKM digital",
  "Kritik {n} soal kebijakan anggaran daerah",
  "{n} dukung gerakan tanam pohon nasional",
  "Polemik pernyataan {n} ramai di media sosial",
  "{n} resmikan posko bantuan bencana",
  "{n} bertemu tokoh lintas agama",
];
function mockRss(url) {
  const names = [...url.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((n) => !/OR/.test(n));
  const pool = names.length ? names : ["PDIP"];
  let seed = [...url].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const n = 6 + Math.floor(rnd() * 8);
  let items = "";
  for (let i = 0; i < n; i++) {
    const nama = pool[Math.floor(rnd() * pool.length)];
    const media = MEDIA[Math.floor(rnd() * MEDIA.length)];
    const judul = POLA[Math.floor(rnd() * POLA.length)].replace("{n}", nama);
    const d = new Date(Date.now() - rnd() * 6.5 * 864e5).toUTCString();
    items += `<item><title>${judul} - ${media}</title><link>https://news.google.com/rss/articles/mock${i}${seed}</link><pubDate>${d}</pubDate><description>&lt;a href="#"&gt;${judul}&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;${media}&lt;/font&gt;</description><source url="https://${media.toLowerCase()}">${media}</source></item>`;
  }
  return `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`;
}
module.exports = { mockRss };
