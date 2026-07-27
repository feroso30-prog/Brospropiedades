// Reportes automaticos de metricas — semanal (lunes) y mensual (dia 1).
// Envia por correo (Resend) y WhatsApp (CallMeBot). Tambien permite prueba manual con ?token=...&force=weekly|monthly
const { getStore, connectLambda } = require("@netlify/blobs");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DESTINO = "conversemos@brospropiedades.cl";
const FROM = "BROS Propiedades <onboarding@resend.dev>";
const WA_KEY = process.env.WHATSAPP_APIKEY;
const WA_PHONE = "56952046918";
const O_NOMBRES = { instagram: "Instagram", facebook: "Facebook", buscador: "Buscador", directo: "Directo", otros: "Otros" };

function santParts() {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const parts = ymd.split("-").map(Number);
  const dow = new Date(ymd + "T12:00:00Z").getUTCDay();
  return { ymd: ymd, y: parts[0], m: parts[1], d: parts[2], dow: dow };
}

function weeklyKeys() {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const base = new Date(ymd + "T12:00:00Z");
  const keys = [];
  for (let i = 1; i <= 7; i++) {
    const dd = new Date(base.getTime() - i * 86400000);
    keys.push("stats:" + dd.toISOString().slice(0, 10));
  }
  return keys.reverse();
}

async function aggregate(store, keys) {
  const agg = { visits: 0, pageviews: 0, uniques: 0, origins: {}, props: {}, scrollAvg: 0, timeAvg: 0, dias: 0 };
  let ss = 0, sn = 0, ts = 0, tn = 0; const vset = {};
  for (const k of keys) {
    let d = null;
    try { d = await store.get(k, { type: "json" }); } catch (e) {}
    if (!d) continue;
    agg.dias++;
    agg.visits += d.visits || 0;
    agg.pageviews += d.pageviews || 0;
    for (const o in (d.origins || {})) agg.origins[o] = (agg.origins[o] || 0) + d.origins[o];
    for (const id in (d.props || {})) {
      if (!agg.props[id]) agg.props[id] = { name: d.props[id].name || id, views: 0, photoClicks: 0 };
      agg.props[id].views += d.props[id].views || 0;
      agg.props[id].photoClicks += d.props[id].photoClicks || 0;
      if (d.props[id].name) agg.props[id].name = d.props[id].name;
    }
    ss += d.scrollSum || 0; sn += d.scrollN || 0; ts += d.timeSum || 0; tn += d.timeN || 0;
    (d.vids || []).forEach(function (v) { vset[v] = 1; });
  }
  agg.uniques = Object.keys(vset).length;
  agg.scrollAvg = sn ? Math.round(ss / sn) : 0;
  agg.timeAvg = tn ? Math.round(ts / tn) : 0;
  return agg;
}

function fmtTime(s) { s = s || 0; const m = Math.floor(s / 60), r = s % 60; return m + ":" + (r < 10 ? "0" : "") + r; }

function topProps(agg, n) {
  const arr = [];
  for (const id in agg.props) arr.push(agg.props[id]);
  arr.sort(function (a, b) { return b.views - a.views; });
  return arr.slice(0, n);
}
function fichasVistas(agg) { let t = 0; for (const id in agg.props) t += agg.props[id].views || 0; return t; }
function origenTxt(agg) {
  const arr = [];
  for (const o in agg.origins) arr.push([O_NOMBRES[o] || o, agg.origins[o]]);
  arr.sort(function (a, b) { return b[1] - a[1]; });
  return arr;
}

async function sendEmail(subject, html) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [DESTINO], subject: subject, html: html })
  }).catch(function () {});
}
async function sendWhatsApp(text) {
  if (!WA_KEY) return;
  const url = "https://api.callmebot.com/whatsapp.php?phone=" + WA_PHONE + "&text=" + encodeURIComponent(text) + "&apikey=" + WA_KEY;
  await fetch(url).catch(function () {});
}

async function hacer(tipo, store) {
  const p = santParts();
  let keys, periodo;
  if (tipo === "mensual") {
    let py = p.y, pm = p.m - 1; if (pm === 0) { pm = 12; py = py - 1; }
    const pref = "stats:" + py + "-" + String(pm).padStart(2, "0");
    try { const l = await store.list({ prefix: pref }); keys = (l.blobs || []).map(function (b) { return b.key; }); } catch (e) { keys = []; }
    periodo = pref.replace("stats:", "");
  } else {
    keys = weeklyKeys();
    periodo = keys[0].replace("stats:", "") + " a " + keys[keys.length - 1].replace("stats:", "");
  }
  const agg = await aggregate(store, keys);
  const top = topProps(agg, 3);
  const ori = origenTxt(agg);
  const fichas = fichasVistas(agg);
  const titulo = tipo === "mensual" ? "Reporte mensual de tu sitio" : "Reporte semanal de tu sitio";

  const li = top.length
    ? top.map(function (t, i) { return "<li><strong>" + (i + 1) + ". " + t.name + "</strong> — " + t.views + " vistas, " + t.photoClicks + " clics en fotos</li>"; }).join("")
    : "<li>Sin fichas vistas en el periodo.</li>";
  const oriLi = ori.length ? ori.map(function (o) { return o[0] + ": " + o[1]; }).join(" · ") : "sin datos";

  const html = "<div style='font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#111'>"
    + "<h2 style='color:#956932'>" + titulo + "</h2>"
    + "<p style='color:#666'>Periodo: " + periodo + "</p>"
    + "<table style='border-collapse:collapse;width:100%;margin:10px 0'>"
    + "<tr><td style='padding:6px 0;color:#666'>Visitantes únicos</td><td style='text-align:right;font-weight:bold'>" + agg.uniques + "</td></tr>"
    + "<tr><td style='padding:6px 0;color:#666'>Visitas</td><td style='text-align:right;font-weight:bold'>" + agg.visits + "</td></tr>"
    + "<tr><td style='padding:6px 0;color:#666'>Fichas vistas</td><td style='text-align:right;font-weight:bold'>" + fichas + "</td></tr>"
    + "<tr><td style='padding:6px 0;color:#666'>Tiempo promedio</td><td style='text-align:right;font-weight:bold'>" + fmtTime(agg.timeAvg) + "</td></tr>"
    + "<tr><td style='padding:6px 0;color:#666'>Scroll promedio</td><td style='text-align:right;font-weight:bold'>" + agg.scrollAvg + "%</td></tr>"
    + "</table>"
    + "<h3 style='color:#956932;font-size:14px'>Top propiedades</h3><ol>" + li + "</ol>"
    + "<p style='color:#666;font-size:13px'><strong>Origen del tráfico:</strong> " + oriLi + "</p>"
    + "<p style='color:#999;font-size:12px'>Ve el detalle en tu panel: www.brospropiedades.cl/admin-metricas.html</p></div>";

  const subject = (tipo === "mensual" ? "📊 Reporte mensual Bros — " : "📊 Reporte semanal Bros — ") + periodo;
  const wa = "📊 " + (tipo === "mensual" ? "Reporte mensual" : "Reporte semanal") + " (" + periodo + ")\n"
    + "Visitantes: " + agg.uniques + " · Visitas: " + agg.visits + " · Fichas vistas: " + fichas + "\n"
    + "Tiempo prom: " + fmtTime(agg.timeAvg) + " · Scroll: " + agg.scrollAvg + "%\n"
    + (top.length ? ("Top: " + top.map(function (t) { return t.name; }).join(" | ")) : "Sin fichas vistas") + "\n"
    + "Detalle: www.brospropiedades.cl/admin-metricas.html";

  await sendEmail(subject, html);
  await sendWhatsApp(wa);
  return { tipo: tipo, periodo: periodo, uniques: agg.uniques, visits: agg.visits, fichas: fichas };
}

exports.handler = async (event) => {
  connectLambda(event);
  const store = getStore("metricas");

  if (event && event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    if (q.token !== process.env.ADMIN_TOKEN) return { statusCode: 401, body: JSON.stringify({ ok: false }) };
    if (q.force === "weekly") { const r = await hacer("semanal", store); return { statusCode: 200, body: JSON.stringify({ ok: true, sent: r }) }; }
    if (q.force === "monthly") { const r = await hacer("mensual", store); return { statusCode: 200, body: JSON.stringify({ ok: true, sent: r }) }; }
    return { statusCode: 200, body: JSON.stringify({ ok: true, uso: "agrega &force=weekly o &force=monthly para enviar una prueba" }) };
  }

  const p = santParts();
  const done = [];
  if (p.dow === 1) { await hacer("semanal", store); done.push("semanal"); }
  if (p.d === 1) { await hacer("mensual", store); done.push("mensual"); }
  return { statusCode: 200, body: JSON.stringify({ ok: true, enviados: done, fecha: p.ymd }) };
};
