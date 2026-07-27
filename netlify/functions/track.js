// Metricas Bros Propiedades — recibe eventos anonimos y los agrega en Netlify Blobs (por dia).
const { getStore, connectLambda } = require("@netlify/blobs");

function dayKey(ts) {
  const s = new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }); // YYYY-MM-DD
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

  // Lectura protegida (para verificacion y tablero)
  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    if (q.token !== process.env.ADMIN_TOKEN) return { statusCode: 401, headers: CORS, body: JSON.stringify({ ok: false }) };
    const key = dayKey(Date.now());
    let d = null;
    try { d = await store.get(key, { type: "json" }); } catch (e) { d = null; }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, day: key, data: d }) };
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
