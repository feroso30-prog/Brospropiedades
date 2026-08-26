// Netlify Function: sitemap.xml dinámico. Incluye home, política y TODAS las propiedades vigentes.
const SITE = "https://www.brospropiedades.cl";
function slugify(s){ return String(s||'').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80); }
async function getProps(){
  const r = await fetch(SITE+'/api/propiedades',{headers:{'accept':'application/json'}});
  const j = await r.json(); return j.propiedades || j || [];
}
exports.handler = async () => {
  let props=[]; try{ props = await getProps(); }catch(e){}
  const now = new Date().toISOString().slice(0,10);
  const urls = [
    {loc:SITE+'/', pr:'1.0', freq:'daily'},
    {loc:SITE+'/politica-de-privacidad', pr:'0.3', freq:'yearly'}
  ].concat(props.map(p=>({
    loc: SITE+'/propiedad/'+p.id+'/'+(slugify(p.nombre)||'propiedad'),
    pr:'0.8', freq:'weekly'
  })));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u=>`  <url><loc>${u.loc}</loc><lastmod>${now}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pr}</priority></url>`).join('\n')
    + '\n</urlset>\n';
  return { statusCode:200, headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=3600'}, body:xml };
};
