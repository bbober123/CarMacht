/* ======================================================================
   CarMatch settings panel — floating launcher available on every page,
   giving the visitor control over language, theme, accent color & text size.
   ====================================================================== */
(function () {
  "use strict";

  function build() {
    if (document.getElementById("cm-settings-launcher")) return;
    var T = window.CM_T || function (k) { return k; };
    var I18N = window.CM_I18N;
    var APP = window.CM_APPEARANCE;

    var launcher = document.createElement("button");
    launcher.id = "cm-settings-launcher";
    launcher.setAttribute("aria-label", T("settings.button_aria"));
    launcher.innerHTML = "⚙";

    var overlay = document.createElement("div");
    overlay.id = "cm-settings-overlay";
    overlay.style.display = "none";

    var panel = document.createElement("div");
    panel.id = "cm-settings-panel";

    function langButtons() {
      return I18N.LANGS.map(function (code) {
        var meta = I18N.LANG_META[code];
        var active = I18N.getLang() === code;
        return "<button type='button' class='cm-lang-btn" + (active ? " active" : "") + "' data-lang='" + code + "'>" +
          "<span class='cm-flag'>" + meta.flag + "</span><span>" + meta.name + "</span></button>";
      }).join("");
    }

    function accentSwatches() {
      var current = APP.getAccent();
      return APP.ACCENT_PRESETS.map(function (p) {
        var active = p.hex === current || (!p.hex && !current);
        if (!p.hex) {
          return "<button type='button' class='cm-accent-swatch cm-accent-reset" + (active ? " active" : "") + "' data-hex='' title='" + T("settings.accent_default") + "'>↺</button>";
        }
        return "<button type='button' class='cm-accent-swatch" + (active ? " active" : "") + "' data-hex='" + p.hex + "' style='background:" + p.hex + "' title='" + p.hex + "'></button>";
      }).join("");
    }

    function themeButtons() {
      var mode = APP.getThemeMode();
      var opts = [
        ["auto", "settings.theme_auto", "🌗"],
        ["light", "settings.theme_light", "☀️"],
        ["dark", "settings.theme_dark", "🌙"],
      ];
      return opts.map(function (o) {
        return "<button type='button' class='cm-seg-btn" + (mode === o[0] ? " active" : "") + "' data-theme-mode='" + o[0] + "'>" + o[2] + " " + T(o[1]) + "</button>";
      }).join("");
    }

    function fontButtons() {
      var size = APP.getFontSize();
      var opts = [["normal", "settings.font_normal"], ["large", "settings.font_large"]];
      return opts.map(function (o) {
        return "<button type='button' class='cm-seg-btn" + (size === o[0] ? " active" : "") + "' data-font-size='" + o[0] + "'>" + T(o[1]) + "</button>";
      }).join("");
    }

    function render() {
      panel.innerHTML =
        "<div class='cm-settings-head'>" +
          "<h3>" + T("settings.title") + "</h3>" +
          "<button type='button' id='cm-settings-close' aria-label='" + T("common.close") + "'>✕</button>" +
        "</div>" +
        "<div class='cm-settings-section'>" +
          "<div class='cm-settings-label'>" + T("settings.language") + "</div>" +
          "<div class='cm-lang-grid'>" + langButtons() + "</div>" +
        "</div>" +
        "<div class='cm-settings-section'>" +
          "<div class='cm-settings-label'>" + T("settings.theme") + "</div>" +
          "<div class='cm-seg-group'>" + themeButtons() + "</div>" +
        "</div>" +
        "<div class='cm-settings-section'>" +
          "<div class='cm-settings-label'>" + T("settings.accent") + "</div>" +
          "<div class='cm-accent-grid'>" + accentSwatches() + "</div>" +
        "</div>" +
        "<div class='cm-settings-section'>" +
          "<div class='cm-settings-label'>" + T("settings.font_size") + "</div>" +
          "<div class='cm-seg-group'>" + fontButtons() + "</div>" +
        "</div>";

      panel.querySelectorAll(".cm-lang-btn").forEach(function (btn) {
        btn.addEventListener("click", function () { I18N.setLang(btn.dataset.lang); render(); });
      });
      panel.querySelectorAll("[data-theme-mode]").forEach(function (btn) {
        btn.addEventListener("click", function () { APP.setThemeMode(btn.dataset.themeMode); render(); });
      });
      panel.querySelectorAll(".cm-accent-swatch").forEach(function (btn) {
        btn.addEventListener("click", function () { APP.setAccent(btn.dataset.hex || null); render(); });
      });
      panel.querySelectorAll("[data-font-size]").forEach(function (btn) {
        btn.addEventListener("click", function () { APP.setFontSize(btn.dataset.fontSize); render(); });
      });
      panel.querySelector("#cm-settings-close").addEventListener("click", close);
    }

    function open() {
      render();
      overlay.style.display = "block";
      requestAnimationFrame(function () { overlay.classList.add("show"); });
    }
    function close() {
      overlay.classList.remove("show");
      setTimeout(function () { overlay.style.display = "none"; }, 200);
    }

    launcher.addEventListener("click", open);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    overlay.appendChild(panel);
    document.body.appendChild(launcher);
    document.body.appendChild(overlay);

    window.addEventListener("veloce:langchange", function () {
      launcher.setAttribute("aria-label", T("settings.button_aria"));
      if (overlay.classList.contains("show")) render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
