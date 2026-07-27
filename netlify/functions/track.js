// Metricas Bros Propiedades — recibe eventos anonimos y los agrega en Netlify Blobs (por dia).
const { getStore, connectLambda } = require("@netlify/blobs");

function dayKey(ts) {
  const s = new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  return 'stats:' + s;
}
function nuevoDia() {
  return { visits: 0, pageviews: 0, vids: [], origins: {}, props: {}, scrollSum: 0, scrollN: 0, timeSum: 0, timeN: 0 };
}
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  connectLambda(event);
  const store = getStore("metricas");

  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    if (q.token !== process.env.ADMIN_TOKEN) return { statusCode: 401, headers: CORS, body: JSON.stringify({ ok: false }) };
    let days = parseInt(q.days || "1", 10);
    if (!(days > 0)) days = 1;
    if (days > 120) days = 120;
    let keys = [];
    try { const l = await store.list({ prefix: "stats:" }); keys = (l.blobs || []).map(function (b) { return b.key; }); } catch (e) {}
    keys.sort();
    const sel = keys.slice(-days);
    const agg = { pageviews: 0, visits: 0, uniques: 0, origins: {}, props: {}, scrollAvg: 0, timeAvg: 0, series: [] };
    let scrollSum = 0, scrollN = 0, timeSum = 0, timeN = 0;
    const vset = {};
    for (const k of sel) {
      let d = null;
      try { d = await store.get(k, { type: "json" }); } catch (e) {}
      if (!d) continue;
      agg.pageviews += d.pageviews || 0;
      agg.visits += d.visits || 0;
      for (const o in (d.origins || {})) agg.origins[o] = (agg.origins[o] || 0) + d.origins[o];
      for (const id in (d.props || {})) {
        if (!agg.props[id]) agg.props[id] = { name: d.props[id].name || id, views: 0, photoClicks: 0 };
        agg.props[id].views += d.props[id].views || 0;
        agg.props[id].photoClicks += d.props[id].photoClicks || 0;
        if (d.props[id].name) agg.props[id].name = d.props[id].name;
      }
      scrollSum += d.scrollSum || 0; scrollN += d.scrollN || 0;
      timeSum += d.timeSum || 0; timeN += d.timeN || 0;
      (d.vids || []).forEach(function (v) { vset[v] = 1; });
      agg.series.push({ day: k.replace("stats:", ""), visits: d.visits || 0, pageviews: d.pageviews || 0 });
    }
    agg.uniques = Object.keys(vset).length;
    agg.scrollAvg = scrollN ? Math.round(scrollSum / scrollN) : 0;
    agg.timeAvg = timeN ? Math.round(timeSum / timeN) : 0;
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, days: days, agg: agg }) };
  }

  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "no" };
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return { statusCode: 400, headers: CORS, body: "bad" }; }
  const events = Array.isArray(body.events) ? body.events : [body];
  const key = dayKey(Date.now());
  let d = null;
  try { d = await store.get(key, { type: "json" }); } catch (e) { d = null; }
  if (!d) d = nuevoDia();
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const t = ev.type;
    if (t === "pageview") {
      d.pageviews++;
      if (ev.newSession) d.visits++;
      if (ev.vid && d.vids.indexOf(ev.vid) < 0) d.vids.push(ev.vid);
      const o = String(ev.origin || "directo");
      d.origins[o] = (d.origins[o] || 0) + 1;
    } else if (t === "property_view") {
      const id = String(ev.id || "?");
      if (!d.props[id]) d.props[id] = { name: ev.name || id, views: 0, photoClicks: 0 };
      d.props[id].views++;
      if (ev.name) d.props[id].name = ev.name;
    } else if (t === "photo_click") {
      const id = String(ev.id || "?");
      if (!d.props[id]) d.props[id] = { name: ev.name || id, views: 0, photoClicks: 0 };
      d.props[id].photoClicks++;
      if (ev.name) d.props[id].name = ev.name;
    } else if (t === "session") {
      if (typeof ev.scroll === "number" && ev.scroll >= 0 && ev.scroll <= 100) { d.scrollSum += ev.scroll; d.scrollN++; }
      if (typeof ev.seconds === "number" && ev.seconds > 0 && ev.seconds < 7200) { d.timeSum += ev.seconds; d.timeN++; }
    }
  }
  if (d.vids.length > 8000) d.vids = d.vids.slice(-8000);
  try { await store.setJSON(key, d); } catch (e) {}
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};
