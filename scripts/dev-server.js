// Server lokal sederhana: `npm run dev` lalu buka http://localhost:3000
// MOCK=1 npm run dev  -> pakai data RSS contoh (tanpa internet)
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 3000;

if (process.env.MOCK) {
  const { mockRss } = require("./mock-rss");
  global.fetch = async (url) => ({ ok: true, status: 200, text: async () => mockRss(decodeURIComponent(url)) });
}
const handler = require("../api/news");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/news") return handler(req, res);
  let file = path.normalize(path.join(ROOT, u.pathname === "/" ? "index.html" : u.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end("Not found"); }
  res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`TMP Monitoring jalan di http://localhost:${PORT}${process.env.MOCK ? " (MOCK)" : ""}`));
