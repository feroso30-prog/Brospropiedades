/**
 * ============================================================================
 *  BROS PROPIEDADES  ·  PUENTE SEGURO CON KITEPROP  (Netlify Function)
 * ----------------------------------------------------------------------------
 *  Este archivo es el "puente" entre tu sitio y KiteProp.
 *
 *  ┌── PLAN A ──►  Pide las propiedades EN VIVO a KiteProp (llave oculta).
 *  ├── PLAN B ──►  Si KiteProp falla, devuelve la ÚLTIMA copia buena que
 *  │               este servidor guardó en memoria (mientras sigue "caliente").
 *  └── (PLAN C lo maneja el navegador: kiteprop-loader.js)
 *
 *  SEGURIDAD: la API Key NUNCA está aquí escrita. Se lee desde la variable de
 *  entorno KITEPROP_API_KEY que configuras en el panel de Netlify. Así jamás
 *  aparece en GitHub ni en el navegador del visitante.
 * ============================================================================
 */

// La llave secreta vive SOLO en Netlify (Site configuration → Environment variables)
const API_KEY  = process.env.KITEPROP_API_KEY;
const API_BASE = "https://www.kiteprop.com/api/v1/properties";

// Cuántas páginas máximo recorrer (50 por página = hasta 1000 propiedades)
const MAX_PAGES   = 20;
const PER_PAGE    = 50;
const TIMEOUT_MS  = 9000; // corta si KiteProp tarda demasiado

// Caché en memoria (Plan B del lado servidor). Dura mientras el servidor
// esté "caliente". Guarda la última respuesta correcta.
let cacheBueno = { data: null, timestamp: 0 };

// ---------------------------------------------------------------------------
//  MAPEO DE CAMPOS  ·  KiteProp  ►  el formato que tu index.html ya entiende
//  (Si algún día quieres cambiar cómo se muestra algo, edita SOLO esta función)
// ---------------------------------------------------------------------------
function normalizar(p) {
  // -- Fotos: ordena la principal primero y usa el tamaño grande (lg) --
  const fotos = (p.images_list || [])
    .slice()
    .sort((a, b) => (b.main === true) - (a.main === true))
    .map(img => img.lg || img.md || img.sm)
    .filter(Boolean);

  // -- Precio y operación --
  let precio = 0, operacion = "Venta";
  if (p.for_sale && p.for_sale_price)                 { precio = p.for_sale_price;  operacion = "Venta";   }
  else if (p.for_rent && p.for_rent_price)            { precio = p.for_rent_price;  operacion = "Arriendo";}
  else if (p.for_temp_rental_price_month)             { precio = p.for_temp_rental_price_month; operacion = "Arriendo"; }
  else if (p.for_sale_price)                          { precio = p.for_sale_price;  operacion = "Venta";   }

  // -- Moneda: usd → USD, clp → CLP, uf → UF ... --
  const moneda = (p.currency || "UF").toString().toUpperCase();

  // -- Tipo de inmueble → categorías de tu sitio (Casa/Departamento/Terreno...) --
  const TIPOS = {
    houses: "Casa", apartments: "Departamento", ph: "Departamento",
    offices: "Oficina", residential_lands: "Terreno", industrial_lands: "Terreno",
    farms: "Terreno", warehouses: "Bodega", industrial_warehouses: "Bodega",
    parking_spaces: "Estacionamiento", retail_spaces: "Local",
    medical_spaces: "Local", businesses: "Local", cemetery_lots: "Terreno",
    boat_storages: "Bodega"
  };
  const tipo = TIPOS[p.type] || "Otro";

  // -- Estado → los estados que colorea tu tarjeta --
  const ESTADOS = {
    active: "disponible", active_unpublished: "disponible",
    reserved: "en_proceso", sold: "vendida", rented: "rentada",
    suspended: "inactiva", inactive: "inactiva"
  };
  const estado = ESTADOS[p.status] || "inactiva";

  return {
    id:               p.id,
    codigo:           p.code || "",
    nombre:           p.title || "Propiedad sin título",
    descripcion:      p.description || "",
    fotos,
    precio,
    moneda,
    operacion,
    tipo,
    estado,
    // Ubicación (tu buscador usa colonia + ciudad + estadoubi)
    colonia:          p.neighborhood || "",
    ciudad:           p.city || "",
    estadoubi:        p.state || "",
    // Características
    recamaras:        p.bedrooms ?? p.rooms ?? 0,
    banos:            p.bathrooms ?? 0,
    estacionamientos: p.parkings ?? 0,
    bodega: p.storages ?? p.storerooms ?? p.warehouses ?? p.cellars ?? p.wine_cellars ?? p.bodegas ?? 0,
    m2total:          p.total_meters || p.terrain_size || p.covered_meters || 0,
    // Extras útiles para la ficha de detalle (propiedad.html)
    link_youtube:     p.link_youtube || "",
    link_360:         p.link_360 || "",
    geo:              p.geo || null
  };
}

// ---------------------------------------------------------------------------
//  Trae TODAS las páginas de propiedades desde KiteProp
// ---------------------------------------------------------------------------
async function traerDeKiteProp() {
  const todas = [];
  let page = 1, lastPage = 1;

  do {
    const url = `${API_BASE}?status=active&limit=${PER_PAGE}&page=${page}&order=id:desc`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const resp = await fetch(url, {
      headers: { "X-API-Key": API_KEY, "Accept": "application/json" },
      signal: ctrl.signal
    });
    clearTimeout(t);

    if (!resp.ok) throw new Error(`KiteProp respondió ${resp.status}`);
    const json = await resp.json();

    (json.data || []).forEach(p => todas.push(normalizar(p)));
    lastPage = json.pagination?.last_page || 1;
    page++;
  } while (page <= lastPage && page <= MAX_PAGES);

  return todas;
}

// ---------------------------------------------------------------------------
//  Handler principal de la función
// ---------------------------------------------------------------------------
exports.handler = async () => {
  const headersCORS = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    // Cache de red: sirve al instante y refresca en segundo plano (60s)
    "Cache-Control": "public, max-age=0, must-revalidate"
  };

  // Si falta la llave, avisamos claro (para que sepas configurar Netlify)
  if (!API_KEY) {
    return {
      statusCode: 500,
      headers: headersCORS,
      body: JSON.stringify({
        ok: false, source: "config",
        error: "Falta la variable KITEPROP_API_KEY en Netlify.",
        propiedades: []
      })
    };
  }

  // ---- PLAN A: en vivo ----
  try {
    const propiedades = await traerDeKiteProp();
    cacheBueno = { data: propiedades, timestamp: Date.now() }; // guarda copia buena
    return {
      statusCode: 200,
      headers: headersCORS,
      body: JSON.stringify({
        ok: true, source: "kiteprop-vivo",
        total: propiedades.length, propiedades
      })
    };
  } catch (err) {
    // ---- PLAN B: última copia buena del servidor ----
    if (cacheBueno.data) {
      return {
        statusCode: 200,
        headers: headersCORS,
        body: JSON.stringify({
          ok: true, source: "cache-servidor",
          aviso: "KiteProp no respondió; se usa la última copia buena.",
          total: cacheBueno.data.length, propiedades: cacheBueno.data
        })
      };
    }
    // Sin copia: el navegador aplicará su Plan C
    return {
      statusCode: 502,
      headers: headersCORS,
      body: JSON.stringify({
        ok: false, source: "error",
        error: String(err.message || err), propiedades: []
      })
    };
  }
};

// Exportado solo para pruebas automáticas (no afecta el funcionamiento en Netlify)
exports.normalizar = normalizar;
