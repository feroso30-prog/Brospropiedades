// Sensor de metricas anonimo — Bros Propiedades
(function () {
  var EP = "/.netlify/functions/track";
  function send(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(EP, new Blob([body], { type: "application/json" }));
      } else {
        fetch(EP, { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true });
      }
    } catch (e) {}
  }

  var vid = null, newVisitor = false;
  try {
    vid = localStorage.getItem("bp_vid");
    if (!vid) { vid = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem("bp_vid", vid); newVisitor = true; }
  } catch (e) {}
  var newSession = false;
  try { if (!sessionStorage.getItem("bp_s")) { sessionStorage.setItem("bp_s", "1"); newSession = true; } } catch (e) { newSession = true; }

  function origin() {
    try {
      var p = new URLSearchParams(location.search);
      var s = (p.get("utm_source") || "").toLowerCase();
      if (s) {
        if (/insta/.test(s)) return "instagram";
        if (/face|fb/.test(s)) return "facebook";
        if (/goog|bing|search/.test(s)) return "buscador";
        return "otros";
      }
      var r = document.referrer || "";
      if (!r) return "directo";
      var h = ""; try { h = new URL(r).hostname.toLowerCase(); } catch (e) {}
      if (/instagram/.test(h)) return "instagram";
      if (/facebook|fb\.com|l\.facebook/.test(h)) return "facebook";
      if (/google|bing|yahoo|duckduck/.test(h)) return "buscador";
      if (h && h.indexOf("brospropiedades") < 0) return "otros";
      return "directo";
    } catch (e) { return "directo"; }
  }

  send({ type: "pageview", origin: origin(), vid: vid, newSession: newSession, path: location.pathname });

  function hookDetalle() {
    if (typeof window.abrirDetalle === "function" && !window.__abD) {
      window.__abD = window.abrirDetalle;
      window.abrirDetalle = function (id) {
        var r;
        try { r = window.__abD.apply(this, arguments); } catch (e) { r = undefined; }
        try {
          window.__curProp = id;
          var name = ""; try { name = document.getElementById("detTitulo").innerText; } catch (e) {}
          send({ type: "property_view", id: id, name: name });
        } catch (e) {}
        return r;
      };
      return true;
    }
    return false;
  }
  if (!hookDetalle()) { var n = 0; var iv = setInterval(function () { if (hookDetalle() || ++n > 40) clearInterval(iv); }, 500); }

  document.addEventListener("click", function (e) {
    var m = document.getElementById("modalDetalle");
    if (!m || m.classList.contains("hidden")) return;
    var t = e.target;
    var isGal = (t.closest && (t.closest("#detPrev,#detNext,.gal-arrow") || (t.tagName === "IMG" && t.closest("#modalDetalle"))));
    if (isGal) {
      var name = ""; try { name = document.getElementById("detTitulo").innerText; } catch (e) {}
      send({ type: "photo_click", id: (window.__curProp != null ? window.__curProp : name), name: name });
    }
  }, true);

  var maxScroll = 0, start = Date.now(), sent = false;
  function trackScroll() {
    try {
      var h = document.documentElement;
      var pct = Math.round((h.scrollTop + window.innerHeight) / h.scrollHeight * 100);
      if (pct > maxScroll) maxScroll = Math.min(100, pct);
    } catch (e) {}
  }
  window.addEventListener("scroll", trackScroll, { passive: true });
  function endSession() {
    if (sent) return; sent = true;
    var secs = Math.round((Date.now() - start) / 1000);
    send({ type: "session", scroll: maxScroll, seconds: secs });
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") endSession(); });
  window.addEventListener("pagehide", endSession);
})();
placeholder
