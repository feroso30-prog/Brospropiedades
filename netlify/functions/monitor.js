// Monitor de salud del sitio Bros Propiedades — corre cada hora (Netlify Scheduled Function)
// Avisa por correo (Resend) y WhatsApp (CallMeBot) SOLO cuando hay un problema real y sostenido.
// Anti-saturacion: alerta una vez al iniciar el incidente y una vez al recuperarse. No repite.
const { getStore, connectLambda } = require("@netlify/blobs");

const SITE = "https://www.brospropiedades.cl";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DESTINO = "conversemos@brospropiedades.cl";
const FROM = "BROS Propiedades <onboarding@resend.dev>";
const WA_KEY = process.env.WHATSAPP_APIKEY; // apikey de CallMeBot (opcional; si no esta, se omite WhatsApp)
const WA_PHONE = "56952046918";

const NOMBRES = {
  HOME_DOWN: "Sitio caido",
  HOME_TAMPER: "Posible alteracion del sitio",
  HOME_ERR: "Sitio inaccesible",
  API_DOWN: "Integracion caida",
  API_BAD: "Integracion con datos invalidos",
  KITE_DEGRADED: "KiteProp intermitente",
  API_ERR: "Integracion inaccesible",
  PHOTOS_DOWN: "Fotos no cargan"
};

async function checkHome() {
  try {
    const r = await fetch(SITE + "/?mon=" + Date.now(), { headers: { "Cache-Control": "no-cache" } });
    if (r.status !== 200) return { ok: false, code: "HOME_DOWN", detail: "El sitio respondio HTTP " + r.status + "." };
    const t = await r.text();
    if (!t.includes("BROS Propiedades") || !t.includes("kiteprop-loader"))
      return { ok: false, code: "HOME_TAMPER", detail: "La pagina principal cargo pero le faltan elementos propios del sitio (posible alteracion del contenido)." };
    return { ok: true };
  } catch (e) {
    return { ok: false, code: "HOME_ERR", detail: "No se pudo conectar al sitio: " + e.message };
  }
}

async function checkApi() {
  try {
    const r = await fetch(SITE + "/.netlify/functions/propiedades?mon=" + Date.now());
    if (r.status !== 200) return { ok: false, code: "API_DOWN", detail: "La integracion de propiedades respondio HTTP " + r.status + "." };
    const j = await r.json().catch(() => null);
    if (!j || j.ok !== true) return { ok: false, code: "API_BAD", detail: "La integracion de propiedades no devolvio datos validos." };
    if (!String(j.source || "").includes("vivo"))
      return { ok: false, code: "KITE_DEGRADED", detail: "La API de KiteProp no responde en vivo; el sitio esta mostrando datos de respaldo (fuente: " + (j.source || "desconocida") + "). Intermitencia detectada.", props: j.propiedades };
    return { ok: true, props: j.propiedades };
  } catch (e) {
    return { ok: false, code: "API_ERR", detail: "No se pudo consultar la integracion de propiedades: " + e.message };
  }
}

async function checkPhotos(props) {
  try {
    const urls = [];
    for (const p of (props || [])) {
      const f = p && p.fotos;
      if (Array.isArray(f)) for (const u of f) if (typeof u === "string" && /^https?:/.test(u)) urls.push(u);
    }
    if (!urls.length) return { ok: true };
    const sample = urls.slice(0, 6);
    let fail = 0;
    for (const u of sample) {
      try { const r = await fetch(u, { method: "GET" }); if (!r.ok) fail++; }
      catch (e) { fail++; }
    }
    if (fail >= Math.ceil(sample.length / 2))
      return { ok: false, code: "PHOTOS_DOWN", detail: "Las fotografias de las propiedades no estan cargando (" + fail + " de " + sample.length + " fallaron)." };
    return { ok: true };
  } catch (e) {
    return { ok: true };
  }
}

async function sendEmail(subject, html) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [DESTINO], subject, html })
  }).catch(() => {});
}

async function sendWhatsApp(text) {
  if (!WA_KEY) return;
  const url = "https://api.callmebot.com/whatsapp.php?phone=" + WA_PHONE + "&text=" + encodeURIComponent(text) + "&apikey=" + WA_KEY;
  await fetch(url).catch(() => {});
}

exports.handler = async (event) => {
  connectLambda(event);
  const store = getStore("monitor-estado");
  let prev = {};
  try { prev = (await store.get("estado", { type: "json" })) || {}; } catch (e) { prev = {}; }

  const home = await checkHome();
  let api = { ok: true }, photos = { ok: true };
  if (home.ok) api = await checkApi();
  if (home.ok && api.ok) photos = await checkPhotos(api.props);

  const problems = [];
  if (!home.ok) problems.push(home);
  if (!api.ok) problems.push(api);
  if (!photos.ok) problems.push(photos);

  const nowBad = problems.length > 0;
  const wasBad = !!prev.bad;
  const prevCodes = (prev.codes || []).slice().sort().join(",");
  const nowCodes = problems.map(p => p.code).sort().join(",");
  const stamp = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });

  let action = null;
  if (nowBad && (!wasBad || prevCodes !== nowCodes)) action = "ALERT";
  else if (!nowBad && wasBad) action = "RECOVER";

  if (action === "ALERT") {
    const li = problems.map(p => "<li><strong>" + (NOMBRES[p.code] || "Problema") + ":</strong> " + p.detail + "</li>").join("");
    const html = "<div style='font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#111'>"
      + "<h2 style='color:#b00020'>&#9888; Alerta &mdash; brospropiedades.cl</h2>"
      + "<p>Se detecto un problema que requiere tu atencion (revision de las " + stamp + "):</p>"
      + "<ul>" + li + "</ul>"
      + "<p style='color:#666;font-size:13px'>Te avisare cuando el sitio se recupere. No enviare correos repetidos por este mismo incidente.</p></div>";
    const subject = "⚠️ Alerta sitio Bros — " + problems.map(p => (NOMBRES[p.code] || "problema").toLowerCase()).join(" + ");
    await sendEmail(subject, html);
    await sendWhatsApp("⚠️ BROS Propiedades: " + problems.map(p => p.detail).join(" | ") + " (" + stamp + ")");
  } else if (action === "RECOVER") {
    const html = "<div style='font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#111'>"
      + "<h2 style='color:#0a7d2c'>&#9989; Recuperado &mdash; brospropiedades.cl</h2>"
      + "<p>El sitio y la integracion de KiteProp volvieron a la normalidad (" + stamp + "). Todo operando correctamente.</p></div>";
    await sendEmail("✅ Recuperado sitio Bros — todo normal", html);
    await sendWhatsApp("✅ BROS Propiedades: el sitio se recupero, todo normal (" + stamp + ").");
  }

  try { await store.setJSON("estado", { bad: nowBad, codes: problems.map(p => p.code), last: stamp }); } catch (e) {}

  return { statusCode: 200, body: JSON.stringify({ checked: stamp, bad: nowBad, action: action, codes: problems.map(p => p.code) }) };
};
