const { getStore , connectLambda } = require("@netlify/blobs");
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DESTINO = "conversemos@brospropiedades.cl";
const FROM = "BROS Propiedades <onboarding@resend.dev>";
const SITE = process.env.URL || "https://www.brospropiedades.cl";

function resp(code, obj){ return { statusCode: code, headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" }, body: JSON.stringify(obj) }; }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

async function loadAll(store){ const d = await store.get("data", { type: "json" }); return Array.isArray(d) ? d : []; }
async function saveAll(store, arr){ await store.setJSON("data", arr); }

async function notify(r){
  if(!RESEND_API_KEY) return;
  const html = "<div style=\"font-family:Arial,sans-serif;max-width:560px\"><h2 style=\"color:#0E0D0D;border-bottom:3px solid #D0AA70;padding-bottom:8px\">Nueva evaluación de cliente</h2>"+
    "<p style=\"font-size:15px\"><strong>"+esc(r.nombre)+"</strong> — "+r.estrellas+" de 5 estrellas</p>"+
    "<p style=\"font-size:14px;color:#333\">"+esc(r.texto)+"</p>"+
    "<p style=\"margin-top:18px\"><a href=\""+SITE+"/admin-resenas.html\" style=\"background:#0E0D0D;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none\">Aprobar o responder</a></p></div>";
  try{ await fetch("https://api.resend.com/emails", { method:"POST", headers:{ "Authorization":"Bearer "+RESEND_API_KEY, "Content-Type":"application/json" }, body: JSON.stringify({ from: FROM, to:[DESTINO], subject:"Evaluación clientes", html: html }) }); }catch(e){}
}

exports.handler = async (event) => {
  connectLambda(event);
  const store = getStore("resenas");
  const method = event.httpMethod;
  if(method === "GET"){
    const all = await loadAll(store);
    const pub = all.filter(function(r){ return r.estado === "aprobada"; }).map(function(r){ return { id:r.id, nombre:r.nombre, estrellas:r.estrellas, texto:r.texto, respuesta:r.respuesta||"", fecha:r.fecha }; });
    return resp(200, { ok:true, reviews: pub });
  }
  if(method === "POST"){
    let body = {}; try{ body = JSON.parse(event.body || "{}"); }catch(e){}
    const action = body.action || "submit";
    if(action === "submit"){
      const nombre = String(body.nombre||"").slice(0,60).trim();
      const texto = String(body.texto||"").slice(0,1000).trim();
      const estrellas = Math.max(1, Math.min(5, parseInt(body.estrellas)||0));
      if(!nombre || !texto || !estrellas) return resp(400, { ok:false, error:"Datos incompletos" });
      const all = await loadAll(store);
      const review = { id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), nombre:nombre, texto:texto, estrellas:estrellas, estado:"pendiente", respuesta:"", fecha:new Date().toISOString() };
      all.unshift(review);
      await saveAll(store, all);
      await notify(review);
      return resp(200, { ok:true });
    }
    if(!ADMIN_TOKEN || body.token !== ADMIN_TOKEN) return resp(401, { ok:false, error:"No autorizado" });
    const all = await loadAll(store);
    if(action === "list"){ return resp(200, { ok:true, reviews: all }); }
    const i = all.findIndex(function(r){ return r.id === body.id; });
    if(i < 0) return resp(404, { ok:false, error:"No existe" });
    if(action === "approve") all[i].estado = "aprobada";
    else if(action === "reject") all[i].estado = "rechazada";
    else if(action === "reply") all[i].respuesta = String(body.respuesta||"").slice(0,1000);
    else if(action === "delete") all.splice(i,1);
    else return resp(400, { ok:false, error:"Acción inválida" });
    await saveAll(store, all);
    return resp(200, { ok:true });
  }
  return resp(405, { ok:false, error:"Method not allowed" });
};
