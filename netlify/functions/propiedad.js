// Netlify Function: página individual por propiedad (SEO).
// Lee /api/propiedades (mismo puente KiteProp existente) y devuelve HTML con
// título, meta descripción, Open Graph, JSON-LD y contenido visible por propiedad.
// No toca la home ni la ventana (modal): es una página nueva y adicional.

const SITE = "https://www.brospropiedades.cl";

function esc(s){ return String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function slugify(s){ return String(s||'').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-')
  .replace(/^-+|-+$/g,'').slice(0,80); }

function fmtPrecio(precio, moneda){
  if(!precio) return 'Consultar';
  if(moneda==='UF') return Number(precio).toLocaleString('es-CL',{maximumFractionDigits:2})+' UF';
  return '$'+Number(precio).toLocaleString('es-CL');
}

function idFromEvent(event){
  const path = (event.path||'').split('?')[0];
  const m = path.match(/propiedad\/(\d+)/);
  if(m) return m[1];
  const q = event.queryStringParameters||{};
  return q.id || q.prop || '';
}

async function getProps(){
  const r = await fetch(SITE+'/api/propiedades', {headers:{'accept':'application/json'}});
  if(!r.ok) throw new Error('api '+r.status);
  const j = await r.json();
  return j.propiedades || j || [];
}

function buildHTML(p){
  const id = p.id;
  const slug = slugify(p.nombre) || 'propiedad';
  const url = SITE+'/propiedad/'+id+'/'+slug;
  const ciudad = p.ciudad || p.estadoubi || 'Antofagasta';
  const fotos = Array.isArray(p.fotos) && p.fotos.length ? p.fotos : [SITE+'/bros-logo.png'];
  const foto = fotos[0];
  const precioTxt = fmtPrecio(p.precio, p.moneda);
  const op = p.operacion || '';
  const specs = [];
  if(p.recamaras) specs.push(p.recamaras+' Dorm.');
  if(p.banos) specs.push(p.banos+' Baños');
  if(p.estacionamientos) specs.push(p.estacionamientos+' Est.');
  if(p.bodega) specs.push(p.bodega+' Bodega');
  if(p.m2total) specs.push(p.m2total+' m²');
  const specTxt = specs.join(' · ');
  const title = `${p.nombre} — ${ciudad} | BROS Propiedades`;
  const descRaw = (p.descripcion||'').replace(/\s+/g,' ').trim();
  const metaDesc = (`${op} de ${p.tipo||'propiedad'} en ${ciudad}. ${specTxt}. ${descRaw}`)
                    .replace(/\s+/g,' ').trim().slice(0,300);

  const jsonld = {
    "@context":"https://schema.org",
    "@type":"Product",
    "name": p.nombre,
    "image": fotos.slice(0,10),
    "description": metaDesc,
    "category": p.tipo || 'Inmueble',
    "brand": {"@type":"Brand","name":"BROS Propiedades"},
    "url": url,
    "offers": {
      "@type":"Offer",
      "price": p.precio || 0,
      "priceCurrency": (p.moneda==='UF' ? 'CLF' : 'CLP'),
      "availability": (String(p.estado||'').toLowerCase()==='disponible'
                        ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"),
      "url": url,
      "businessFunction": (op.toLowerCase()==='arriendo'
                        ? "http://purl.org/goodrelations/v1#LeaseOut"
                        : "http://purl.org/goodrelations/v1#Sell")
    }
  };
  const breadcrumb = {
    "@context":"https://schema.org","@type":"BreadcrumbList",
    "itemListElement":[
      {"@type":"ListItem","position":1,"name":"Inicio","item":SITE+"/"},
      {"@type":"ListItem","position":2,"name":"Propiedades","item":SITE+"/#propiedades"},
      {"@type":"ListItem","position":3,"name":p.nombre,"item":url}
    ]
  };

  const wa = 'https://wa.me/56952046918?text='+encodeURIComponent(
    `Hola, me interesa la propiedad: ${p.nombre} (${url})`);
  const thumbs = fotos.slice(0,6).map(f=>`<img src="${esc(f)}" alt="${esc(p.nombre)}" loading="lazy">`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="BROS Propiedades">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(foto)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(metaDesc)}">
<meta name="twitter:image" content="${esc(foto)}">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
<style>
  :root{--oro:#D0AA70;--oro2:#8a6a2f;--neg:#0E0D0D;--txt:#1a1a1a;--mut:#666}
  *{box-sizing:border-box}
  body{font-family:'Inter',system-ui,Arial,sans-serif;margin:0;color:var(--txt);background:#fff}
  a{color:inherit}
  .top{background:var(--neg);padding:14px 20px}
  .top img{height:30px}
  .wrap{max-width:920px;margin:0 auto;padding:20px}
  .badge{display:inline-block;background:var(--neg);color:var(--oro);font-size:12px;font-weight:700;
         letter-spacing:1px;padding:5px 12px;border-radius:999px;text-transform:uppercase}
  h1{font-size:26px;margin:12px 0 4px}
  .ubi{color:var(--mut);margin:0 0 10px}
  .precio{font-size:30px;font-weight:800;color:var(--oro2);margin:8px 0}
  .estado{color:#1a7a3a;font-weight:700;font-size:13px}
  .hero{width:100%;max-height:460px;object-fit:cover;border-radius:14px;margin:12px 0}
  .thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin:10px 0}
  .thumbs img{width:100%;height:90px;object-fit:cover;border-radius:8px}
  .specs{display:flex;flex-wrap:wrap;gap:14px;margin:14px 0;padding:14px;border:1px solid #eee;border-radius:12px}
  .specs b{display:block;font-size:18px}
  .specs span{color:var(--mut);font-size:12px}
  .desc{line-height:1.7;white-space:pre-line;margin:14px 0;color:#333}
  .cta{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}
  .btn{padding:12px 20px;border-radius:999px;font-weight:700;text-decoration:none;display:inline-block}
  .btn-oro{background:var(--oro);color:var(--neg)}
  .btn-wa{background:#25D366;color:#fff}
  .btn-ghost{border:1px solid #ddd;color:#333}
  footer{border-top:1px solid #eee;margin-top:24px;padding:16px 0;color:var(--mut);font-size:12px;text-align:center}
</style>
</head>
<body>
  <div class="top"><a href="${SITE}/"><img src="${SITE}/bros-logo.png" alt="BROS Propiedades"></a></div>
  <div class="wrap">
    <span class="badge">${esc(op)}</span>
    <h1>${esc(p.nombre)}</h1>
    <p class="ubi">📍 ${esc(ciudad)}${p.colonia? ', '+esc(p.colonia):''}</p>
    <img class="hero" src="${esc(foto)}" alt="${esc(p.nombre)}">
    ${thumbs? '<div class="thumbs">'+thumbs+'</div>':''}
    <div class="precio">${esc(precioTxt)} <span class="estado">${String(p.estado||'').toLowerCase()==='disponible'?'· Disponible':''}</span></div>
    <div class="specs">
      ${p.recamaras?`<div><b>${esc(p.recamaras)}</b><span>Dormitorios</span></div>`:''}
      ${p.banos?`<div><b>${esc(p.banos)}</b><span>Baños</span></div>`:''}
      ${p.estacionamientos?`<div><b>${esc(p.estacionamientos)}</b><span>Estac.</span></div>`:''}
      ${p.bodega?`<div><b>${esc(p.bodega)}</b><span>Bodega</span></div>`:''}
      ${p.m2total?`<div><b>${esc(p.m2total)}</b><span>m² totales</span></div>`:''}
    </div>
    <div class="cta">
      <a class="btn btn-oro" href="${SITE}/?prop=${esc(id)}">Ver galería completa y agendar visita</a>
      <a class="btn btn-wa" href="${esc(wa)}" rel="nofollow">Consultar por WhatsApp</a>
      <a class="btn btn-ghost" href="${SITE}/#propiedades">Ver más propiedades</a>
    </div>
    <h2>Descripción</h2>
    <div class="desc">${esc(descRaw)||'Contáctanos para más información sobre esta propiedad.'}</div>
  </div>
  <footer>© ${new Date().getFullYear()} BROS Propiedades · <a href="${SITE}/">www.brospropiedades.cl</a> · Antofagasta</footer>
</body>
</html>`;
}

function notFoundHTML(){
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Propiedad no disponible | BROS Propiedades</title>
<meta name="robots" content="noindex,follow">
<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:system-ui;text-align:center;padding:60px 20px">
<img src="${SITE}/bros-logo.png" alt="BROS" style="height:40px"><h1>Esta propiedad ya no está disponible</h1>
<p>Puede haberse vendido o arrendado. Mira nuestras propiedades disponibles.</p>
<p><a href="${SITE}/#propiedades" style="background:#D0AA70;color:#0E0D0D;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Ver propiedades</a></p>
</body></html>`;
}

exports.handler = async (event) => {
  const id = idFromEvent(event);
  try{
    const props = await getProps();
    const p = props.find(x => String(x.id) === String(id));
    if(!p){
      return { statusCode:404, headers:{'content-type':'text/html; charset=utf-8'}, body:notFoundHTML() };
    }
    return {
      statusCode:200,
      headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=900'},
      body: buildHTML(p)
    };
  }catch(e){
    return { statusCode:200, headers:{'content-type':'text/html; charset=utf-8'}, body:notFoundHTML() };
  }
};

// Export para pruebas locales
module.exports.buildHTML = buildHTML;
module.exports.slugify = slugify;
