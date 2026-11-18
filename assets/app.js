/* Taruna Merah Putih – Monitoring (SPA tanpa build step) */
(() => {
  "use strict";

  const TOPIK = [
    { id: "tmp", judul: "Berita Taruna Merah Putih", pendek: "Taruna Merah Putih", ikon: "news", desk: "Organisasi & seluruh jajaran pengurus pusat" },
    { id: "pdip", judul: "PDI Perjuangan", pendek: "PDI Perjuangan", ikon: "flag", desk: "PDI Perjuangan · PDIP" },
    { id: "megawati", judul: "Megawati Soekarnoputri", pendek: "Megawati", ikon: "user", desk: "Megawati Soekarnoputri · Ketum PDIP · Ketum PDI Perjuangan" },
    { id: "puan", judul: "Puan Maharani", pendek: "Puan Maharani", ikon: "user", desk: "Puan Maharani · Ketua DPR RI" },
    { id: "pinka", judul: "Pinka Haprani", pendek: "Pinka Haprani", ikon: "user", desk: "Diah Pikatan Hapsari · Pinka Haprani · Anak Puan" },
    { id: "rio", judul: "Rio Dondokambey", pendek: "Rio Dondokambey", ikon: "user", desk: "Rio Dondokambey · Anak Olly Dondokambey" },
  ];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const view = $("#view");
  const ico = (n, cls = "") => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^(https?:\/\/|\/)/i.test(u || "") ? u : "#");
  const fmt = new Intl.NumberFormat("id-ID");

  // ---------- util tanggal ----------
  const tglPanjang = (d) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const tglPendek = (d) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  function relatif(d) {
    if (!d) return "";
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return "baru saja";
    if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
    if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)} hari lalu`;
    return tglPendek(d);
  }
  const RENTANG = [
    { jam: 6, label: "6 jam" }, { jam: 12, label: "12 jam" }, { jam: 24, label: "24 jam" },
    { jam: 72, label: "3 hari" }, { jam: 168, label: "7 hari" }, { jam: 336, label: "14 hari" }, { jam: 720, label: "30 hari" },
  ];
  const labelRentang = (jam) => (RENTANG.find((r) => r.jam === jam) || {}).label || `${jam} jam`;
  const ymd = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };

  // ---------- markdown mini ----------
  function inline(s) {
    return esc(s)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener">${t}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }
  function md(src = "") {
    const out = [];
    let list = null, para = [];
    const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
    const flushL = () => { if (list) { out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`); list = null; } };
    for (const raw of String(src).split("\n")) {
      const line = raw.trim();
      if (!line) { flushP(); flushL(); continue; }
      if (/^#{1,3}\s/.test(line)) { flushP(); flushL(); out.push(`<h2>${inline(line.replace(/^#+\s/, ""))}</h2>`); continue; }
      if (/^[-*]\s/.test(line)) { flushP(); (list ||= []).push(line.slice(2)); continue; }
      flushL(); para.push(line);
    }
    flushP(); flushL();
    return out.join("");
  }

  // ---------- UI helpers ----------
  const toastEl = $("#toast");
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }
  async function salin(teks) {
    try { await navigator.clipboard.writeText(teks); toast("Tersalin ke clipboard"); }
    catch { toast("Gagal menyalin"); }
  }
  const tip = $("#tip");
  document.addEventListener("mousemove", (e) => {
    const t = e.target.closest("[data-tip]");
    if (!t) return tip.classList.remove("show");
    tip.innerHTML = t.dataset.tip;
    tip.classList.add("show");
    const r = tip.getBoundingClientRect();
    let x = e.clientX - r.width / 2, y = e.clientY - r.height - 14;
    x = Math.max(8, Math.min(window.innerWidth - r.width - 8, x));
    if (y < 8) y = e.clientY + 18;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  });

  const sentBadge = (s) => s === "positif" ? `<span class="badge b-pos">Positif</span>` : s === "negatif" ? `<span class="badge b-neg">Negatif</span>` : `<span class="badge b-neu">Netral</span>`;
  function sbar(s) {
    const tot = s.positif + s.netral + s.negatif || 1;
    const seg = (k, c) => s[k] ? `<i class="${c}" style="width:${(s[k] / tot) * 100}%"></i>` : "";
    return `<div class="sbar">${seg("positif", "p")}${seg("netral", "n")}${seg("negatif", "x")}</div>`;
  }
  const slegend = (s) => `<div class="slegend"><span><i class="dot" style="background:var(--pos)"></i>Positif <b>${s.positif}</b></span><span><i class="dot" style="background:var(--neu-bg);box-shadow:inset 0 0 0 1px var(--line-2)"></i>Netral <b>${s.netral}</b></span><span><i class="dot" style="background:var(--neg)"></i>Negatif <b>${s.negatif}</b></span></div>`;
  const empty = (msg, icon = "search") => `<div class="empty">${ico(icon)}${esc(msg)}</div>`;

  // ---------- data ----------
  const cache = {};
  async function getJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(`Gagal memuat ${url} (${r.status})`);
    return r.json();
  }
  const dataStatis = {};
  const loadData = (nama) => (dataStatis[nama] ||= getJSON(`/data/${nama}.json`).catch((e) => { delete dataStatis[nama]; throw e; }));

  async function loadBerita(topik, jam, paksa = false) {
    const key = `${topik}:${jam}`;
    const c = cache[key];
    if (!paksa && c && Date.now() - c.at < 5 * 60e3) return c.data;
    const data = await getJSON(`/api/news?topik=${topik}&jam=${jam}${paksa ? `&_=${Date.now()}` : ""}`);
    cache[key] = { at: Date.now(), data };
    return data;
  }

  function analisisLokal(items, topikId) {
    const s = { positif: 0, netral: 0, negatif: 0 };
    const tokoh = {}, kata = {};
    const STOP = new Set("dan di ke dari yang untuk dengan pada ini itu dalam akan jadi soal oleh atas tak tidak bisa ada usai kata sebut minta beri juga para jelang hingga agar sudah masih lebih baru kini saat terkait bagi pdip perjuangan".split(" "));
    for (const it of items) {
      s[it.sentimen] = (s[it.sentimen] || 0) + 1;
      for (const t of it.tokoh || []) tokoh[t] = (tokoh[t] || 0) + 1;
      for (const w of it.judul.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/))
        if (w.length > 3 && !STOP.has(w) && !/^\d+$/.test(w)) kata[w] = (kata[w] || 0) + 1;
    }
    const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
    return { s, tokoh: topikId === "tmp" ? top(tokoh, 40) : [], kata: top(kata, 14) };
  }

  // ---------- artikel ----------
  const artikelHTML = (it, showTopik) => `
    <article class="art">
      <span class="rail ${it.sentimen}"></span>
      <div>
        <h3><a href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener">${esc(it.judul)}</a></h3>
        <div class="meta">
          <span class="src">${esc(it.media)}</span><span>·</span>
          <span title="${it.tanggal ? new Date(it.tanggal).toLocaleString("id-ID") : ""}">${relatif(it.tanggal)}</span>
          ${sentBadge(it.sentimen)}
          ${showTopik ? `<span class="badge b-line">${esc(showTopik)}</span>` : ""}
        </div>
        ${it.tokoh && it.tokoh.length ? `<div class="tokoh">${it.tokoh.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      </div>
      <a class="open" href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener" aria-label="Buka">${ico("ext")}</a>
    </article>`;

  function csv(items, nama) {
    const kol = ["tanggal", "judul", "media", "sentimen", "tokoh", "url"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [kol.join(","), ...items.map((it) => kol.map((k) => q(Array.isArray(it[k]) ? it[k].join("; ") : it[k])).join(","))];
    const blob = new Blob(["\ufeff" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${nama}-${ymd(Date.now())}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // =====================================================================
  //  VIEW: DASHBOARD
  // =====================================================================
  async function viewDashboard() {
    const jam = new Date().getHours();
    const sapa = jam < 11 ? "Selamat pagi" : jam < 15 ? "Selamat siang" : jam < 19 ? "Selamat sore" : "Selamat malam";
    view.innerHTML = `
      <section class="hero fade-in">
        <div>
          <div class="eyebrow">${esc(tglPanjang(Date.now()))}</div>
          <h1>${sapa}, Tim Monitoring</h1>
          <p>Jumlah pemberitaan 7 hari terakhir, isu yang perlu dijawab, dan capaian kerja organisasi dalam satu layar.</p>
        </div>
        <div class="hero-logo"><img src="/assets/logo-tmp.png" alt="Taruna Merah Putih" /></div>
      </section>

      <div class="grid g-3" id="dTopik">
        ${TOPIK.map((t) => `
          <a class="card topic-card" href="#/berita/${t.id}">
            <div class="row-between"><span class="ic">${ico(t.ikon)}</span><span class="link">Buka ${ico("arrow")}</span></div>
            <div><div class="num" data-num="${t.id}"><span class="skel" style="display:inline-block;width:56px;height:28px"></span></div><div class="lbl">${esc(t.pendek)}</div></div>
            <div data-sent="${t.id}"><div class="skel" style="height:6px"></div></div>
          </a>`).join("")}
      </div>

      <div class="grid g-2 section-gap" style="align-items:start">
        <div class="card">
          <div class="card-head"><h2>Counter Issue Aktif</h2><a class="link" href="#/counter-issue">Semua ${ico("arrow")}</a></div>
          <div class="mini-list" id="dCI">${skeletonMini(3)}</div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Prestasi Kerja Terbaru</h2><a class="link" href="#/prestasi">Semua ${ico("arrow")}</a></div>
          <div class="mini-list" id="dPK">${skeletonMini(3)}</div>
        </div>
      </div>`;

    loadData("counter-issue").then((list) => {
      const aktif = list.filter((x) => x.status !== "Selesai").sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 4);
      $("#dCI").innerHTML = aktif.length ? aktif.map((x) => `
        <a href="#/counter-issue/${encodeURIComponent(x.id)}"><span class="ix">${ico("shield")}</span>
        <div><div class="t">${esc(x.judul)}</div><div class="m"><span class="badge st-${esc(x.status)}">${esc(x.status)}</span> · ${tglPendek(x.tanggal)}</div></div></a>`).join("") : empty("Tidak ada isu aktif", "check");
    }).catch((e) => ($("#dCI").innerHTML = empty(e.message, "alert")));

    loadData("prestasi-kerja").then((list) => {
      const top = [...list].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 4);
      $("#dPK").innerHTML = top.length ? top.map((x) => `
        <a href="#/prestasi/${encodeURIComponent(x.id)}"><span class="ix">${ico("award")}</span>
        <div><div class="t">${esc(x.judul)}</div><div class="m">${esc(x.bidang)} · ${tglPendek(x.tanggal)}</div></div></a>`).join("") : empty("Belum ada data");
    }).catch((e) => ($("#dPK").innerHTML = empty(e.message, "alert")));

    const hasil = await Promise.allSettled(TOPIK.map((t) => loadBerita(t.id, 168)));
    hasil.forEach((h, i) => {
      const t = TOPIK[i];
      const num = $(`[data-num="${t.id}"]`), sent = $(`[data-sent="${t.id}"]`);
      if (!num) return;
      if (h.status === "fulfilled") {
        const a = h.value.analisis;
        num.textContent = fmt.format(a.total);
        sent.innerHTML = sbar(a.sentimen) + `<div style="margin-top:8px">${slegend(a.sentimen)}</div>`;
      } else {
        num.textContent = "–";
        sent.innerHTML = `<span class="muted" style="font-size:12px">Gagal memuat</span>`;
      }
    });
  }
  const skeletonArt = (n) => Array.from({ length: n }, () => `<div class="art"><span class="rail"></span><div><div class="skel" style="height:16px;width:85%"></div><div class="skel" style="height:12px;width:40%;margin-top:10px"></div></div></div>`).join("");
  const skeletonMini = (n) => Array.from({ length: n }, () => `<div style="padding:12px"><div class="skel" style="height:14px;width:90%"></div><div class="skel" style="height:11px;width:40%;margin-top:8px"></div></div>`).join("");

  // =====================================================================
  //  VIEW: BERITA
  // =====================================================================
  const stBerita = { jam: 168, q: "", sent: "semua", media: "semua", tokoh: null };
  let beritaData = null;

  async function viewBerita(id, opt = {}) {
    const paksa = !!opt.force;
    const t = TOPIK.find((x) => x.id === id) || TOPIK[0];
    if (!opt.keep) Object.assign(stBerita, { q: "", sent: "semua", media: "semua", tokoh: null });
    view.innerHTML = `
      <div class="page-head fade-in">
        <div><div class="eyebrow">Pemberitaan</div><h1>${esc(t.judul)}</h1><p class="sub">${esc(t.desk)}</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="bCsv">${ico("down")}Ekspor CSV</button>
          <button class="btn btn-red" id="bRefresh">${ico("refresh")}Perbarui</button>
        </div>
      </div>
      <div class="toolbar">
        <label class="search">${ico("search")}<input class="input" id="fQ" placeholder="Cari judul atau media…" value="${esc(stBerita.q)}" /></label>
        <div class="seg seg-scroll" id="fHari">${RENTANG.map((r) => `<button data-h="${r.jam}" class="${r.jam === stBerita.jam ? "on" : ""}">${r.label}</button>`).join("")}</div>
        <select class="select" id="fSent">
          <option value="semua">Semua sentimen</option><option value="positif">Positif</option><option value="netral">Netral</option><option value="negatif">Negatif</option>
        </select>
        <select class="select" id="fMedia"><option value="semua">Semua media</option></select>
      </div>
      <div id="bNotice"></div>
      <div class="grid g-4" id="bKpi">${Array.from({ length: 4 }, () => `<div class="card kpi"><div class="skel" style="height:12px;width:50%"></div><div class="skel" style="height:28px;width:40%;margin-top:10px"></div></div>`).join("")}</div>
      ${t.id === "tmp" ? `<div class="card section-gap"><div class="card-head"><h2>Pengurus yang Disebut</h2><span class="muted">klik untuk menyaring</span></div><div class="card-pad" id="bTokoh"><div class="skel" style="height:60px"></div></div></div>` : ""}
      ${t.id !== "tmp" ? `<div class="card section-gap"><div class="card-head"><h2>Kata Kunci Dominan</h2><span class="muted">dari judul berita</span></div><div class="card-pad" id="bKata"><div class="skel" style="height:40px"></div></div></div>` : ""}
      <div class="card section-gap">
        <div class="card-head"><h2>Daftar Berita</h2><span class="muted" id="bCount"></span></div>
        <div class="articles" id="bList" style="margin-top:8px">${skeletonArt(6)}</div>
      </div>
      <p class="small-note" style="padding:12px 4px">Sumber: Google News (Indonesia). Sentimen dihitung otomatis dari kata kunci judul, sifatnya indikatif.</p>`;

    $("#fSent").value = stBerita.sent;
    $("#fQ").addEventListener("input", (e) => { stBerita.q = e.target.value; renderBerita(t); });
    $("#fSent").addEventListener("change", (e) => { stBerita.sent = e.target.value; renderBerita(t); });
    $("#fMedia").addEventListener("change", (e) => { stBerita.media = e.target.value; renderBerita(t); });
    $("#fHari").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      stBerita.jam = +b.dataset.h; viewBerita(t.id, { keep: true });
    });
    $("#bRefresh").addEventListener("click", () => { delete cache[`${t.id}:${stBerita.jam}`]; viewBerita(t.id, { keep: true, force: true }); });
    $("#bCsv").addEventListener("click", () => beritaData && csv(filterBerita(beritaData.artikel), `berita-${t.id}`));

    const btn = $("#bRefresh");
    btn.classList.add("spin");
    try {
      beritaData = await loadBerita(t.id, stBerita.jam, paksa);
      if (!location.hash.startsWith(`#/berita/${t.id}`)) return;
      btn.classList.remove("spin");
      const medias = [...new Set(beritaData.artikel.map((a) => a.media))].sort();
      $("#fMedia").innerHTML = `<option value="semua">Semua media (${medias.length})</option>` + medias.map((m) => `<option>${esc(m)}</option>`).join("");
      $("#fMedia").value = medias.includes(stBerita.media) ? stBerita.media : "semua";
      $("#bNotice").innerHTML = beritaData.kueriGagal ? `<div class="notice">${ico("alert")}${beritaData.kueriGagal} dari ${beritaData.jumlahKueri} kueri gagal diambil — data mungkin belum lengkap. Coba perbarui beberapa saat lagi.</div>` : "";
      renderBerita(t);
    } catch (e) {
      btn.classList.remove("spin");
      beritaData = null;
      $("#bNotice").innerHTML = `<div class="notice">${ico("alert")}Gagal mengambil berita: ${esc(e.message)}</div>`;
      ["#bKpi", "#bKata", "#bList", "#bTokoh"].forEach((s) => { const el = $(s); if (el) el.innerHTML = s === "#bKpi" ? "" : empty("Tidak ada data", "alert"); });
    }
  }

  function filterBerita(items) {
    const q = stBerita.q.trim().toLowerCase();
    return items.filter((it) =>
      (stBerita.sent === "semua" || it.sentimen === stBerita.sent) &&
      (stBerita.media === "semua" || it.media === stBerita.media) &&
      (!stBerita.tokoh || (it.tokoh || []).includes(stBerita.tokoh)) &&
      (!q || `${it.judul} ${it.media}`.toLowerCase().includes(q)));
  }

  function renderBerita(t) {
    if (!beritaData) return;
    const items = filterBerita(beritaData.artikel);
    const a = analisisLokal(items, t.id);
    const tot = items.length;
    const pct = (v) => (tot ? Math.round((v / tot) * 100) : 0);
    $("#bKpi").innerHTML = `
      <div class="card kpi"><div class="lbl">${ico("news")}Total artikel</div><div class="val">${fmt.format(tot)}</div></div>
      <div class="card kpi"><div class="lbl">${ico("eye")}Media unik</div><div class="val">${new Set(items.map((i) => i.media)).size}</div></div>
      <div class="card kpi"><div class="lbl"><i class="dot" style="background:var(--pos)"></i>Positif</div><div class="val">${a.s.positif}<small>${pct(a.s.positif)}%</small></div></div>
      <div class="card kpi"><div class="lbl"><i class="dot" style="background:var(--neg)"></i>Negatif</div><div class="val">${a.s.negatif}<small>${pct(a.s.negatif)}%</small></div></div>`;
    if ($("#bKata")) $("#bKata").innerHTML = a.kata.length ? `<div class="chips">${a.kata.map(([w, n]) => `<button class="chip" data-kw="${esc(w)}">${esc(w)} <span class="c">${n}</span></button>`).join("")}</div>` : `<span class="muted">Belum ada data</span>`;
    $$("#bKata [data-kw]").forEach((b) => b.addEventListener("click", () => { stBerita.q = b.dataset.kw; $("#fQ").value = stBerita.q; renderBerita(t); }));

    const tk = $("#bTokoh");
    if (tk) {
      const semuaTokoh = analisisLokal(beritaData.artikel, "tmp").tokoh;
      tk.innerHTML = semuaTokoh.length
        ? `<div class="chips">${stBerita.tokoh ? `<button class="chip" data-tk="">✕ Hapus filter</button>` : ""}${semuaTokoh.map(([n, c]) => `<button class="chip ${stBerita.tokoh === n ? "on" : ""}" data-tk="${esc(n)}">${esc(n)} <span class="c">${c}</span></button>`).join("")}</div>`
        : `<span class="muted">Belum ada pengurus yang disebut dalam rentang ini.</span>`;
      $$("[data-tk]", tk).forEach((b) => b.addEventListener("click", () => { stBerita.tokoh = b.dataset.tk && stBerita.tokoh !== b.dataset.tk ? b.dataset.tk : null; renderBerita(t); }));
    }

    $("#bCount").textContent = `${fmt.format(tot)} dari ${fmt.format(beritaData.artikel.length)} artikel · ${labelRentang(stBerita.jam)} terakhir · diperbarui ${relatif(beritaData.diperbarui)}`;
    let tampil = 30;
    const isiList = () => {
      $("#bList").innerHTML = tot
        ? items.slice(0, tampil).map((it) => artikelHTML(it)).join("") +
          (tot > tampil ? `<div style="padding:16px;text-align:center;border-top:1px solid var(--line)"><button class="btn" id="bMore">Muat ${Math.min(30, tot - tampil)} berita lagi</button></div>` : "")
        : empty("Tidak ada berita yang cocok dengan filter.");
      const m = $("#bMore");
      if (m) m.addEventListener("click", () => { tampil += 30; isiList(); });
    };
    isiList();
  }

  // =====================================================================
  //  VIEW: COUNTER ISSUE
  // =====================================================================
  const stCI = { q: "", status: "Semua" };
  async function viewCounterList() {
    view.innerHTML = `
      <div class="page-head fade-in">
        <div><div class="eyebrow">Respons Isu</div><h1>Counter Issue</h1><p class="sub">Daftar isu yang beredar beserta kontra-narasi, poin kunci, dan rujukan. Klik kartu untuk membuka detail.</p></div>
      </div>
      <div class="toolbar">
        <label class="search">${ico("search")}<input class="input" id="ciQ" placeholder="Cari isu…" value="${esc(stCI.q)}" /></label>
        <div class="seg" id="ciSt">${["Semua", "Aktif", "Dipantau", "Selesai"].map((s) => `<button data-s="${s}" class="${s === stCI.status ? "on" : ""}">${s}</button>`).join("")}</div>
      </div>
      <div class="grid g-4" id="ciKpi"></div>
      <div class="grid g-3 section-gap" id="ciGrid">${Array.from({ length: 3 }, () => `<div class="card ci-card"><div class="skel" style="height:120px"></div></div>`).join("")}</div>`;
    let list;
    try { list = await loadData("counter-issue"); }
    catch (e) { $("#ciGrid").innerHTML = `<div class="card">${empty(e.message, "alert")}</div>`; return; }
    const cnt = (s) => list.filter((x) => x.status === s).length;
    $("#ciKpi").innerHTML = `
      <div class="card kpi"><div class="lbl">${ico("shield")}Total isu</div><div class="val">${list.length}</div></div>
      <div class="card kpi"><div class="lbl">${ico("alert")}Aktif</div><div class="val" style="color:var(--red)">${cnt("Aktif")}</div></div>
      <div class="card kpi"><div class="lbl">${ico("eye")}Dipantau</div><div class="val">${cnt("Dipantau")}</div></div>
      <div class="card kpi"><div class="lbl">${ico("check")}Selesai</div><div class="val" style="color:var(--pos)">${cnt("Selesai")}</div></div>`;
    const render = () => {
      const q = stCI.q.toLowerCase();
      const prio = { Tinggi: 0, Sedang: 1, Rendah: 2 };
      const f = list
        .filter((x) => (stCI.status === "Semua" || x.status === stCI.status) && (!q || `${x.judul} ${x.ringkasan} ${x.kategori} ${(x.tags || []).join(" ")}`.toLowerCase().includes(q)))
        .sort((a, b) => (a.status === "Selesai") - (b.status === "Selesai") || (prio[a.prioritas] ?? 3) - (prio[b.prioritas] ?? 3) || b.tanggal.localeCompare(a.tanggal));
      $("#ciGrid").innerHTML = f.length ? f.map((x) => `
        <a class="card ci-card prio-${esc(x.prioritas)}" href="#/counter-issue/${encodeURIComponent(x.id)}">
          <div
