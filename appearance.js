/* ======================================================================
   CarMatch appearance — user-controlled theme, accent color & text size.
   Cooperates with site-settings.js (admin-set defaults): a user override
   always wins once set, but falls back to the site default otherwise.
   ====================================================================== */
(function (window) {
  "use strict";

  var THEME_KEY = "veloce_theme";       // resolved value: "light" | "dark"  (kept for backward-compat with page scripts)
  var THEME_MODE_KEY = "veloce_theme_mode"; // "auto" | "light" | "dark"
  var ACCENT_KEY = "veloce_accent_user";
  var FONT_KEY = "veloce_font_size";    // "normal" | "large"

  var ACCENT_PRESETS = [
    { id: "default", hex: null,      label: "settings.accent_default" },
    { id: "blue",    hex: "#2F6FED" },
    { id: "indigo",  hex: "#6C5CE7" },
    { id: "green",   hex: "#22B07D" },
    { id: "teal",    hex: "#0FB5AE" },
    { id: "orange",  hex: "#E8622C" },
    { id: "red",     hex: "#D6543F" },
    { id: "pink",    hex: "#E84393" },
    { id: "yellow",  hex: "#E1B000" },
  ];

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function getThemeMode() {
    return localStorage.getItem(THEME_MODE_KEY) || "auto";
  }

  function resolvedTheme() {
    var mode = getThemeMode();
    if (mode === "light" || mode === "dark") return mode;
    // "auto": prefer a previously resolved value only if no explicit mode was ever set elsewhere;
    // otherwise defer to the system preference live.
    return systemPrefersDark() ? "dark" : "light";
  }

  function applyTheme() {
    var theme = resolvedTheme();
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll(".site-logo").forEach(function (img) {
      // Only swap the built-in logo files - a custom admin logo (absolute/relative
      // non-logo-*.png URL) applied by site-settings.js is left alone.
      if (/logo-(dark|light)\.png$/.test(img.getAttribute("src") || "")) {
        img.src = theme === "dark" ? "logo-dark.png" : "logo-light.png";
      }
    });
    var themeBtn = document.getElementById("theme-btn");
    if (themeBtn) themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  function setThemeMode(mode) {
    localStorage.setItem(THEME_MODE_KEY, mode);
    applyTheme();
    window.dispatchEvent(new CustomEvent("veloce:themechange"));
  }

  function getAccent() {
    return localStorage.getItem(ACCENT_KEY) || null;
  }

  function applyAccent() {
    var accent = getAccent();
    if (accent) document.documentElement.style.setProperty("--accent", accent);
  }

  function setAccent(hex) {
    if (hex) {
      localStorage.setItem(ACCENT_KEY, hex);
      document.documentElement.style.setProperty("--accent", hex);
    } else {
      localStorage.removeItem(ACCENT_KEY);
      document.documentElement.style.removeProperty("--accent");
      // let the admin-configured default (if any) re-apply
      if (window.__siteSettings && window.__siteSettings.accent_color) {
        document.documentElement.style.setProperty("--accent", window.__siteSettings.accent_color);
      }
    }
  }

  function getFontSize() {
    return localStorage.getItem(FONT_KEY) || "normal";
  }

  function applyFontSize() {
    document.documentElement.classList.toggle("fs-large", getFontSize() === "large");
  }

  function setFontSize(size) {
    localStorage.setItem(FONT_KEY, size);
    applyFontSize();
  }

  // Re-apply on first paint
  applyTheme();
  applyAccent();
  applyFontSize();

  // Keep "auto" mode responsive to OS-level changes while the page is open
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onSystemChange = function () { if (getThemeMode() === "auto") applyTheme(); };
    if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }

  window.CM_APPEARANCE = {
    ACCENT_PRESETS: ACCENT_PRESETS,
    getThemeMode: getThemeMode,
    setThemeMode: setThemeMode,
    resolvedTheme: resolvedTheme,
    applyTheme: applyTheme,
    getAccent: getAccent,
    setAccent: setAccent,
    applyAccent: applyAccent,
    getFontSize: getFontSize,
    setFontSize: setFontSize,
    // called by site-settings.js after it applies the admin's default accent,
    // so a user's personal choice still takes priority.
    reapplyUserAccent: function () { if (getAccent()) applyAccent(); },
  };
})(window);
