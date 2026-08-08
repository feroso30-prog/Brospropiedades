/* ============================================================
 * BROS PROPIEDADES · Botón de postulación por publicación
 * Aditivo: NO modifica renderProperties(). Inyecta un botón en
 * cada tarjeta enlazando al formulario de postulación del CRM,
 * usando el ID de KiteProp que ya viene en la foto de la ficha.
 * ============================================================ */
(function () {
  "use strict";
  var BASE = "https://script.google.com/macros/s/AKfycbySwhhsGHFwVnsh8vzyWEIbk3P3il4ZZRmkTqAURk0icUauzSbFs4PIlRWvGo8T8LXt/exec";

  function kpId(card) {
    var img = card.querySelector("img");
    var m = img ? String(img.getAttribute("src") || "").match(/properties\/(\d+)/) : null;
    return m ? m[1] : null;
  }

  function esArriendo(card) {
    var els = card.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || "").trim().toLowerCase();
      if (t === "arriendo") return true;
      if (t === "venta") return false;
    }
    return /^\s*arriendo/i.test(card.textContent || "");
  }

  function inyectar() {
    var cards = document.querySelectorAll("#propertiesGrid .property-card");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.querySelector(".bros-postular")) continue;
      var id = kpId(card);
      if (!id) continue;
      var arr = esArriendo(card);
      var a = document.createElement("a");
      a.className = "bros-postular";
      a.href = BASE + "?page=postular&prop=" + encodeURIComponent(id);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = arr ? "Postular a arriendo" : "Cargar aprobación / respaldo";
      a.style.cssText = "display:block;margin:10px 16px 14px;text-align:center;background:#0E0D0D;color:#D0AA70;font-weight:700;font-size:13px;padding:11px 10px;border-radius:12px;text-decoration:none;border:1px solid #D0AA70";
      card.appendChild(a);
    }
  }

  function start() {
    inyectar();
    var grid = document.getElementById("propertiesGrid");
    if (grid && window.MutationObserver) {
      new MutationObserver(function () { inyectar(); }).observe(grid, { childList: true });
    }
    var n = 0, iv = setInterval(function () { inyectar(); if (++n > 30) clearInterval(iv); }, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
