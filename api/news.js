// GET /api/news?topik=tmp|pdip|megawati|puan&jam=168  (jam: 6, 12, 24, 72, 168, 336, 720)
const { ambilBerita } = require("../lib/scraper");

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://x");
  const topik = url.searchParams.get("topik") || "tmp";
  const jam = Math.min(Math.max(parseInt(url.searchParams.get("jam") || "168", 10) || 168, 1), 720);
  try {
    const data = await ambilBerita(topik, jam);
    // cache di edge Vercel 15 menit, boleh sajikan versi lama 1 jam sambil refresh
    res.setHeader("Cache-Control", `public, s-maxage=${jam <= 24 ? 300 : 900}, stale-while-revalidate=3600`);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = e.status || 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: e.message || "Gagal mengambil berita" }));
  }
};
