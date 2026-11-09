/**
 * Аналитика Марины Герман.
 * Подставь ID в window.MG_ANALYTICS ниже или в <script> перед этим файлом.
 * Метрика грузится только после согласия cookie (localStorage mg-cookie-accepted).
 */
(function () {
  var cfg = window.MG_ANALYTICS || {};
  var METRIKA_ID = cfg.metrikaId || ""; // например "12345678"
  var GA_ID = cfg.gaId || ""; // например "G-XXXXXXXX"
  var COOKIE_KEY = "mg-cookie-accepted";

  function consented() {
    try {
      return !!localStorage.getItem(COOKIE_KEY);
    } catch (e) {
      return false;
    }
  }

  function loadMetrika(id) {
    if (!id || window.ym) return;
    (function (m, e, t, r, i, k, a) {
      m[i] =
        m[i] ||
        function () {
          (m[i].a = m[i].a || []).push(arguments);
        };
      m[i].l = 1 * new Date();
      for (var j = 0; j < document.scripts.length; j++) {
        if (document.scripts[j].src === r) return;
      }
      (k = e.createElement(t)), (a = e.getElementsByTagName(t)[0]);
      k.async = 1;
      k.src = r;
      a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    ym(Number(id), "init", {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
    });
  }

  function loadGa(id) {
    if (!id || window.gtag) return;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      dataLayer.push(arguments);
    };
    gtag("js", new Date());
    gtag("config", id);
  }

  function boot() {
    if (!consented()) return;
    if (METRIKA_ID) loadMetrika(METRIKA_ID);
    if (GA_ID) loadGa(GA_ID);
  }

  boot();
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.id === "cookie-accept") setTimeout(boot, 50);
  });
})();
