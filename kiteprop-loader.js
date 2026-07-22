/**
 * ============================================================================
 *  BROS PROPIEDADES · CARGADOR DE PROPIEDADES (lado navegador)
 * ----------------------------------------------------------------------------
 *  Orquesta el puente con tolerancia a fallos:
 *
 *   PLAN A  ►  Pide los datos a tu función de Netlify (/api/propiedades),
 *              que a su vez consulta KiteProp en vivo.
 *   PLAN B  ►  Si eso falla, usa la ÚLTIMA copia buena guardada en este
 *              navegador (localStorage).
 *   PLAN C  ►  Si tampoco hay copia, usa el respaldo local PROPIEDADES
 *              (archivo propiedades.js, si existe).
 *   FINAL   ►  Si nada hay, muestra un mensaje amable con WhatsApp.
 *
 *  No modifica el diseño: solo entrega las propiedades a renderProperties(),
 *  la función que tu index.html ya tiene.
 * ============================================================================
 */
(function () {
  "use strict";

  var ENDPOINT   = "/api/propiedades";           // ruta amistosa (ver netlify.toml)
  var CACHE_KEY  = "bros_cache_propiedades_v1";   // dónde guardamos la copia buena
  var grid       = document.getElementById("propertiesGrid");

  function mostrarCargando() {
    if (grid) {
      grid.innerHTML =
        '<div class="col-span-3 text-center py-16">' +
        '<i class="fa-solid fa-circle-notch fa-spin text-[#D0AA70] text-3xl"></i>' +
        '<p class="text-gray-500 mt-4 font-medium">Cargando propiedades…</p></div>';
    }
  }

  function mensajeFinal() {
    if (grid) {
      grid.innerHTML =
        '<div class="col-span-3 text-center py-16">' +
        '<p class="text-gray-600 font-semibold mb-4">Estamos actualizando nuestro catálogo.</p>' +
        '<a href="https://wa.me/56952046918" target="_blank" ' +
        'class="inline-block bg-[#D0AA70] text-[#0E0D0D] px-6 py-3 rounded-xl font-bold">' +
        '<i class="fa-brands fa-whatsapp"></i> Escríbenos por WhatsApp</a></div>';
    }
  }

  // Pinta las propiedades y las deja disponibles para el buscador del sitio
  function pintar(lista) {
    window.PROPIEDADES = lista;                 // el buscador avanzado usa esta variable
    if (typeof renderProperties === "function") {
      renderProperties(lista);
    }
  }

  function guardarCache(lista) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(lista)); } catch (e) {}
  }
  function leerCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function arrancar() {
    mostrarCargando();

    // -------- PLAN A: datos en vivo vía Netlify --------
    fetch(ENDPOINT, { headers: { "Accept": "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        if (json && json.ok && Array.isArray(json.propiedades) && json.propiedades.length) {
          pintar(json.propiedades);
          guardarCache(json.propiedades);      // actualiza la copia buena (para Plan B)
          console.log("[BROS] Propiedades cargadas (" + json.source + "): " + json.propiedades.length);
        } else {
          throw new Error("Respuesta vacía o inválida");
        }
      })
      .catch(function (err) {
        console.warn("[BROS] Plan A falló:", err.message, "→ intento Plan B/C");

        // -------- PLAN B: última copia buena del navegador --------
        var cache = leerCache();
        if (cache && cache.length) {
          pintar(cache);
          console.log("[BROS] Usando copia local (Plan B): " + cache.length);
          return;
        }

        // -------- PLAN C: respaldo local propiedades.js --------
        if (typeof PROPIEDADES !== "undefined" && PROPIEDADES && PROPIEDADES.length) {
          pintar(PROPIEDADES);
          console.log("[BROS] Usando respaldo propiedades.js (Plan C): " + PROPIEDADES.length);
          return;
        }

        // -------- Nada disponible --------
        mensajeFinal();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else {
    arrancar();
  }
})();
