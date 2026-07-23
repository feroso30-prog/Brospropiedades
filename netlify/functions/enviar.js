// Envío de correos de los formularios del sitio vía Resend
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DESTINO = "conversemos@brospropiedades.cl";
const FROM = "BROS Propiedades <onboarding@resend.dev>";
const ASUNTOS = {
  tasacion: "Solicitud tasación",
  captacion: "Solicitud de Captación",
  hipotecario: "Solicitud Crédito Hipotecario",
  arriendo: "Consulta de valor arriendo",
  evaluacion: "Evaluación clientes"
};
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function resp(code, obj){ return { statusCode: code, headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" }, body: JSON.stringify(obj) }; }
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return resp(405, { ok:false, error:"Method not allowed" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch(e){ return resp(400, { ok:false, error:"bad json" }); }
  const tipo = body.tipo || "otro";
  const campos = body.campos || {};
  const asunto = ASUNTOS[tipo] || "Solicitud sitio web";
  if (!RESEND_API_KEY) return resp(200, { ok:false, motivo:"sin_api_key" });
  const filas = Object.keys(campos).map(function(k){ return "<tr><td style=\"padding:5px 16px 5px 0;color:#888;vertical-align:top\">"+esc(k)+"</td><td style=\"padding:5px 0\"><strong>"+esc(campos[k]||"-")+"</strong></td></tr>"; }).join("");
  const html = "<div style=\"font-family:Arial,Helvetica,sans-serif;max-width:580px;margin:auto\"><h2 style=\"color:#0E0D0D;border-bottom:3px solid #D0AA70;padding-bottom:8px\">"+asunto+"</h2><table style=\"font-size:14px;width:100%\">"+filas+"</table><p style=\"color:#aaa;font-size:12px;margin-top:22px\">Enviado automáticamente desde brospropiedades.cl</p></div>";
  const payload = { from: FROM, to: [DESTINO], subject: asunto, html: html };
  const replyTo = campos.Correo || campos.correo;
  if (replyTo) payload.reply_to = replyTo;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(function(){ return {}; });
    return resp(r.ok ? 200 : 502, { ok: r.ok, id: data.id || null, error: data.message || null });
  } catch(e) {
    return resp(500, { ok:false, error: String(e) });
  }
};
