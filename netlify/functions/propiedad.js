// Netlify Function v2: página individual por propiedad con CARRUSEL e interfaz del sitio BROS.
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
  const path=(event.path||'').split('?')[0];
  const m=path.match(/propiedad\/(\d+)/);
  if(m) return m[1];
  const q=event.queryStringParameters||{}; return q.id||q.prop||'';
}
async function getProps(){
  const r=await fetch(SITE+'/api/propiedades',{headers:{'accept':'application/json'}});
  if(!r.ok) throw new Error('api '+r.status);
  const j=await r.json(); return j.propiedades||j||[];
}

function buildHTML(p){
  const id=p.id;
  const slug=slugify(p.nombre)||'propiedad';
  const url=SITE+'/propiedad/'+id+'/'+slug;
  const ciudad=p.ciudad||p.estadoubi||'Antofagasta';
  const fotos=Array.isArray(p.fotos)&&p.fotos.length?p.fotos:[SITE+'/bros-logo.png'];
  const foto=fotos[0];
  const precioTxt=fmtPrecio(p.precio,p.moneda);
  const monTxt = p.moneda==='UF' ? 'VALOR UF' : 'VALOR CLP';
  const op=p.operacion||'';
  const disp = String(p.estado||'').toLowerCase()==='disponible';
  const specsArr=[];
  if(p.recamaras) specsArr.push(['fa-bed',p.recamaras,'Dorm.']);
  if(p.banos) specsArr.push(['fa-bath',p.banos,'Baños']);
  if(p.estacionamientos) specsArr.push(['fa-car',p.estacionamientos,'Est.']);
  if(p.bodega) specsArr.push(['fa-box-archive',p.bodega,'Bodega']);
  if(p.m2total) specsArr.push(['fa-vector-square',p.m2total,'m²']);
  const specTxtSeo=specsArr.map(s=>s[1]+' '+s[2]).join(' · ');
  const title=`${p.nombre} — ${ciudad} | BROS Propiedades`;
  const descRaw=(p.descripcion||'').replace(/\s+/g,' ').trim();
  const metaDesc=(`${op} de ${p.tipo||'propiedad'} en ${ciudad}. ${specTxtSeo}. ${descRaw}`)
                 .replace(/\s+/g,' ').trim().slice(0,300);

  const jsonld={"@context":"https://schema.org","@type":"Product","name":p.nombre,
    "image":fotos.slice(0,10),"description":metaDesc,"category":p.tipo||'Inmueble',
    "brand":{"@type":"Brand","name":"BROS Propiedades"},"url":url,
    "offers":{"@type":"Offer","price":p.precio||0,
      "priceCurrency":(p.moneda==='UF'?'CLF':'CLP'),
      "availability":(disp?"https://schema.org/InStock":"https://schema.org/OutOfStock"),"url":url,
      "businessFunction":(op.toLowerCase()==='arriendo'?"http://purl.org/goodrelations/v1#LeaseOut":"http://purl.org/goodrelations/v1#Sell")}};
  const breadcrumb={"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
    {"@type":"ListItem","position":1,"name":"Inicio","item":SITE+"/"},
    {"@type":"ListItem","position":2,"name":"Propiedades","item":SITE+"/#propiedades"},
    {"@type":"ListItem","position":3,"name":p.nombre,"item":url}]};

  const wa='https://wa.me/56952046918?text='+encodeURIComponent(`Hola, me interesa la propiedad: ${p.nombre} (${url})`);
  const slides=fotos.map((f,i)=>`<img class="slide${i===0?' on':''}" src="${esc(f)}" alt="${esc(p.nombre)} foto ${i+1}" ${i===0?'':'loading="lazy"'}>`).join('');
  const thumbs=fotos.map((f,i)=>`<button class="thumb${i===0?' on':''}" onclick="go(${i})"><img src="${esc(f)}" alt="mini ${i+1}" loading="lazy"></button>`).join('');
  const specsHTML=specsArr.map(s=>`<div class="spec"><i class="fa-solid ${s[0]}"></i><b>${esc(s[1])}</b> <span>${s[2]}</span></div>`).join('');

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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
<style>
  :root{--oro:#D0AA70;--oro2:#8a6a2f;--neg:#0E0D0D;--panel:#141313;--txt:#1a1a1a;--mut:#6b6b6b}
  *{box-sizing:border-box}
  body{font-family:'Inter',system-ui,Arial,sans-serif;margin:0;background:#0b0a0a;color:var(--txt)}
  a{color:inherit;text-decoration:none}
  .topbar{background:var(--neg);padding:14px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #241f16}
  .topbar img{height:30px}
  .topbar .back{margin-left:auto;color:var(--oro);font-size:13px;font-weight:600}
  .shell{max-width:940px;margin:26px auto;padding:0 16px}
  .card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  .gal{position:relative;background:#000}
  .stage{position:relative;width:100%;aspect-ratio:20/9;background:#000}
  .slide{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .25s}
  .slide.on{opacity:1}
  .badge{position:absolute;top:16px;left:16px;z-index:3;background:rgba(14,13,13,.9);color:var(--oro);
          font-size:12px;font-weight:800;letter-spacing:1.5px;padding:7px 14px;border-radius:999px;text-transform:uppercase}
  .nav{position:absolute;top:50%;transform:translateY(-50%);z-index:3;width:46px;height:46px;border:none;
       border-radius:50%;background:rgba(14,13,13,.6);color:#fff;font-size:16px;cursor:pointer;display:flex;
       align-items:center;justify-content:center;transition:background .2s}
  .nav:hover{background:var(--oro);color:var(--neg)}
  .nav.prev{left:14px}.nav.next{right:14px}
  .count{position:absolute;bottom:14px;right:16px;z-index:3;background:rgba(14,13,13,.75);color:#fff;
         font-size:12px;padding:4px 10px;border-radius:999px}
  .thumbs{display:flex;gap:8px;padding:12px;overflow-x:auto;background:#fafafa}
  .thumb{flex:0 0 auto;width:82px;height:60px;border:2px solid transparent;border-radius:8px;padding:0;
         cursor:pointer;overflow:hidden;background:none}
  .thumb.on{border-color:var(--oro)}
  .thumb img{width:100%;height:100%;object-fit:cover;display:block}
  .body{padding:22px 26px 28px}
  h1{font-size:26px;font-weight:800;margin:0 0 4px}
  .ubi{color:var(--mut);margin:0 0 14px;font-size:14px}
  .row{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px}
  .actions{display:flex;gap:10px}
  .btn{padding:10px 16px;border-radius:999px;font-weight:700;font-size:14px;cursor:pointer;border:1px solid #ddd;
       background:#fff;color:#333;display:inline-flex;align-items:center;gap:8px}
  .btn-wa{background:#25D366;border-color:#25D366;color:#fff}
  .price .lbl{font-size:11px;color:var(--mut);letter-spacing:1px;font-weight:700}
  .price .val{font-size:30px;font-weight:800;color:var(--oro2);line-height:1}
  .price .disp{color:#16a34a;font-weight:700;font-size:13px}
  .specs{display:flex;flex-wrap:wrap;gap:22px;margin:16px 0 6px;padding-top:16px;border-top:1px solid #ececec}
  .spec{display:inline-flex;align-items:center;gap:7px;font-size:14.5px;color:#2a2a2a}
  .spec i{color:var(--oro2);font-size:15px}
  .spec b{font-weight:700}
  .spec span{color:#2a2a2a}
  .lbl-sec{color:var(--oro2);font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:22px 0 8px}
  .desc{line-height:1.75;white-space:pre-line;color:#333;font-size:15px}
  .cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
  .btn-oro{background:var(--oro);border-color:var(--oro);color:var(--neg)}
  .btn-ghost2{background:#fff;border-color:#ddd;color:#333}
  footer{color:#8f8778;font-size:12px;text-align:center;padding:22px}
  @media(max-width:560px){ h1{font-size:22px} .price .val{font-size:26px} }
</style>
</head>
<body>
  <div class="topbar">
    <a href="${SITE}/"><img src="${SITE}/bros-logo.png" alt="BROS Propiedades"></a>
    <a class="back" href="${SITE}/#propiedades"><i class="fa-solid fa-arrow-left"></i> Ver todas las propiedades</a>
  </div>
  <div class="shell">
    <div class="card">
      <div class="gal">
        <div class="stage" id="stage">
          <span class="badge">${esc(op)}</span>
          ${slides}
          <button class="nav prev" onclick="move(-1)" aria-label="Anterior"><i class="fa-solid fa-chevron-left"></i></button>
          <button class="nav next" onclick="move(1)" aria-label="Siguiente"><i class="fa-solid fa-chevron-right"></i></button>
          <span class="count" id="count">1 / ${fotos.length}</span>
        </div>
        <div class="thumbs" id="thumbs">${thumbs}</div>
      </div>
      <div class="body">
        <h1>${esc(p.nombre)}</h1>
        <p class="ubi"><i class="fa-solid fa-location-dot" style="color:#c0392b"></i> ${esc(ciudad)}${p.colonia?', '+esc(p.colonia):''}</p>
        <div class="row">
          <div class="actions">
            <button class="btn" onclick="copiar()"><i class="fa-solid fa-link"></i> Copiar link</button>
            <a class="btn btn-wa" href="${esc(wa)}" rel="nofollow"><i class="fa-brands fa-whatsapp"></i> Compartir</a>
          </div>
          <div class="price">
            <div class="lbl">${monTxt}</div>
            <div class="val">${esc(precioTxt)}</div>
            ${disp?'<div class="disp">DISPONIBLE</div>':''}
          </div>
        </div>
        <div class="specs">${specsHTML}</div>
        <div class="lbl-sec"><i class="fa-solid fa-align-left"></i> Descripción</div>
        <div class="desc">${esc(descRaw)||'Contáctanos para más información sobre esta propiedad.'}</div>
        <div class="cta">
          <a class="btn btn-oro" href="${esc(wa)}" rel="nofollow"><i class="fa-solid fa-calendar-check"></i> Agendar visita</a>
          <a class="btn btn-ghost2" href="${SITE}/#propiedades"><i class="fa-solid fa-grip"></i> Ver más propiedades</a>
        </div>
      </div>
    </div>
  </div>
  <footer>© ${new Date().getFullYear()} BROS Propiedades · <a href="${SITE}/" style="color:var(--oro)">www.brospropiedades.cl</a> · Antofagasta</footer>
<script>
  var i=0, n=${fotos.length};
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  var thumbs=[].slice.call(document.querySelectorAll('.thumb'));
  function render(){
    slides.forEach(function(s,k){ s.classList.toggle('on',k===i); });
    thumbs.forEach(function(t,k){ t.classList.toggle('on',k===i); });
    document.getElementById('count').textContent=(i+1)+' / '+n;
    var act=thumbs[i]; if(act&&act.scrollIntoView) act.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});
  }
  function move(d){ i=(i+d+n)%n; render(); }
  function go(k){ i=k; render(); }
  document.addEventListener('keydown',function(e){ if(e.key==='ArrowLeft')move(-1); if(e.key==='ArrowRight')move(1); });
  function copiar(){ navigator.clipboard&&navigator.clipboard.writeText(location.href).then(function(){
    var b=event.target.closest('.btn'); if(b){var t=b.innerHTML; b.innerHTML='<i class="fa-solid fa-check"></i> Copiado'; setTimeout(function(){b.innerHTML=t;},1500);} }); }
</script>
</body>
</html>`;
}
function notFoundHTML(){
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Propiedad no disponible | BROS Propiedades</title><meta name="robots" content="noindex,follow">
<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:system-ui;text-align:center;padding:60px 20px">
<img src="${SITE}/bros-logo.png" alt="BROS" style="height:40px"><h1>Esta propiedad ya no está disponible</h1>
<p>Puede haberse vendido o arrendado. Mira nuestras propiedades disponibles.</p>
<p><a href="${SITE}/#propiedades" style="background:#D0AA70;color:#0E0D0D;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Ver propiedades</a></p>
</body></html>`;
}
exports.handler = async (event) => {
  const id=idFromEvent(event);
  try{
    const props=await getProps();
    const p=props.find(x=>String(x.id)===String(id));
    if(!p) return { statusCode:404, headers:{'content-type':'text/html; charset=utf-8'}, body:notFoundHTML() };
    return { statusCode:200, headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=900'}, body:buildHTML(p) };
  }catch(e){
    return { statusCode:200, headers:{'content-type':'text/html; charset=utf-8'}, body:notFoundHTML() };
  }
};
module.exports.buildHTML = buildHTML;
