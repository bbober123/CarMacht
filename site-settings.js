(function () {
  "use strict";
  if (typeof SUPABASE_URL === "undefined" || typeof window.supabase === "undefined") return;

  var cleanUrl = SUPABASE_URL.trim().replace(/\/+$/, "");
  var cleanKey = SUPABASE_ANON_KEY.trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)) return;

  // Uzywamy wspolnego klienta (patrz supabase-client.js), zeby nie tworzyc
  // drugiej instancji GoTrueClient obok tej z auth.js/script.js/itd.
  var client = window.__supabaseClient || window.supabase.createClient(cleanUrl, cleanKey);
  if (!window.__supabaseClient) window.__supabaseClient = client;
  var currentTheme = localStorage.getItem("veloce_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  function applyLogo(url) {
    if (!url) return;
    document.querySelectorAll(".site-logo").forEach(function (img) { img.src = url; });
  }

  function applySettings(settings) {
    window.__siteSettings = settings;

    if (settings.accent_color) {
      document.documentElement.style.setProperty("--accent", settings.accent_color);
    }
    if (window.CM_APPEARANCE) window.CM_APPEARANCE.reapplyUserAccent();

    applyLogo(currentTheme === "dark" ? settings.logo_dark_url : settings.logo_light_url);

    // Logo w onboardingu (script.js) i innych miejscach doladowywanych pozniej -
    // obserwator lapie nowe obrazki .site-logo dodane do DOM po fakcie.
    var observer = new MutationObserver(function () {
      applyLogo(currentTheme === "dark" ? settings.logo_dark_url : settings.logo_light_url);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (settings.banner_enabled === "true" && settings.banner_text && settings.banner_text.trim()) {
      if (sessionStorage.getItem("cm_banner_dismissed") !== settings.banner_text) {
        var banner = document.createElement("div");
        banner.className = "site-banner";
        var span = document.createElement("span");
        span.textContent = settings.banner_text;
        var closeBtn = document.createElement("button");
        closeBtn.setAttribute("aria-label", "Zamknij");
        closeBtn.textContent = "✕";
        closeBtn.addEventListener("click", function () {
          sessionStorage.setItem("cm_banner_dismissed", settings.banner_text);
          banner.remove();
        });
        banner.appendChild(span);
        banner.appendChild(closeBtn);
        document.body.prepend(banner);
      }
    }
  }

  client.from("site_settings").select("*").then(function (res) {
    var settings = {};
    (res.data || []).forEach(function (s) { settings[s.key] = s.value; });
    applySettings(settings);
  });
})();
