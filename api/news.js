// GET /api/news?topik=tmp|megawati|puan|pdip&hari=7
const { ambilBerita } = require("../lib/news");

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://x");
  const topik = url.searchParams.get("topik") || "tmp";
  const hari = Math.min(Math.max(parseInt(url.searchParams.get("hari") || "7", 10) || 7, 1), 30);
  try {
    const data = await ambilBerita(topik, hari);
    // cache di edge Vercel 15 menit, boleh sajikan versi lama 1 jam sambil refresh
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = e.status || 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: e.message || "Gagal mengambil berita" }));
  }
};
