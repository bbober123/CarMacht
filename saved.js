(function () {
  "use strict";

  var cleanUrl = SUPABASE_URL.trim().replace(/\/+$/, "");
  var supabaseClient = window.__supabaseClient || window.supabase.createClient(cleanUrl, SUPABASE_ANON_KEY.trim());
  if (!window.__supabaseClient) window.__supabaseClient = supabaseClient;
  window.CarModals.init(supabaseClient);

  var T = window.CM_T;
  var theme = window.CM_APPEARANCE ? window.CM_APPEARANCE.resolvedTheme() : (localStorage.getItem("veloce_theme") || "dark");

  var POWERTRAIN_COLOR = { electric: "#2F6FED", hybrid: "#22B07D", combustion: "#E8622C" };

  function silhouette(color) {
    return '<svg viewBox="0 0 320 180" width="100%" height="100%"><rect width="320" height="180" fill="' + color + '15"/>' +
      '<g transform="translate(20,70)"><path d="M10 60 L28 60 L45 30 Q60 18 90 18 L190 18 Q215 18 228 34 L248 60 L270 60 Q280 60 280 70 L280 78 L10 78 Z" fill="none" stroke="' + color + '" stroke-width="4"/>' +
      '<circle cx="70" cy="80" r="16" fill="none" stroke="' + color + '" stroke-width="4"/><circle cx="220" cy="80" r="16" fill="none" stroke="' + color + '" stroke-width="4"/></g></svg>';
  }

  async function getVisitorId() {
    var sessionRes = await supabaseClient.auth.getSession();
    if (!sessionRes.data.session) {
      window.location.href = "auth.html";
      return null;
    }
    return sessionRes.data.session.user.id;
  }

  function POWERTRAIN_LABEL_LIVE() {
    return {
      electric: "⚡ " + T("powertrain.electric_short"),
      hybrid: "🍃 " + T("powertrain.hybrid_short"),
      combustion: "⛽ " + T("powertrain.combustion_short"),
    };
  }
  var POWERTRAIN_LABEL = POWERTRAIN_LABEL_LIVE();
  var allSavedCars = [];
  var activeFilter = "all";

  async function loadSaved() {
    var visitorId = await getVisitorId();
    if (!visitorId) return;
    var swipesRes = await supabaseClient.from("swipes").select("car_id").eq("visitor_id", visitorId).eq("liked", true);
    var grid = document.getElementById("saved-grid");

    if (!swipesRes.data || swipesRes.data.length === 0) {
      grid.innerHTML = "<p class='empty-msg'>" + T("saved.empty") + "<a href='index.html'>" + T("saved.empty_link") + "</a></p>";
      return;
    }

    var carIds = swipesRes.data.map(function (s) { return s.car_id; });
    var carsRes = await supabaseClient.from("cars").select("*").in("id", carIds);
    var photosRes = await supabaseClient.from("car_photos").select("car_id,url").in("car_id", carIds).order("is_primary", { ascending: false });

    var photoByCarId = {};
    (photosRes.data || []).forEach(function (p) {
      if (!photoByCarId[p.car_id]) photoByCarId[p.car_id] = p.url;
    });

    allSavedCars = (carsRes.data || []).map(function (c) { return Object.assign({}, c, { _photo: photoByCarId[c.id] || null }); });
    renderToolbar();
    renderGrid();
  }

  function renderToolbar() {
    POWERTRAIN_LABEL = POWERTRAIN_LABEL_LIVE();
    var toolbar = document.getElementById("saved-toolbar");
    var present = Array.from(new Set(allSavedCars.map(function (c) { return c.powertrain; })));
    var chips = ["all"].concat(present);
    toolbar.innerHTML =
      "<span class='saved-count'>" + allSavedCars.length + T("saved.count_suffix") + "</span>" +
      "<div class='saved-filter-chips'>" +
      chips.map(function (k) {
        var label = k === "all" ? T("saved.filter_all") : (POWERTRAIN_LABEL[k] || k).replace(/^[⚡🍃⛽]\s/, "");
        return "<button class='saved-filter-chip" + (k === activeFilter ? " active" : "") + "' data-key='" + k + "'>" + label + "</button>";
      }).join("") +
      "</div>";
    toolbar.querySelectorAll(".saved-filter-chip").forEach(function (btn) {
      btn.addEventListener("click", function () { activeFilter = btn.dataset.key; renderToolbar(); renderGrid(); });
    });
  }

  function renderGrid() {
    var grid = document.getElementById("saved-grid");
    var list = activeFilter === "all" ? allSavedCars : allSavedCars.filter(function (c) { return c.powertrain === activeFilter; });
    grid.innerHTML = "";

    list.forEach(function (c) {
      var color = POWERTRAIN_COLOR[c.powertrain] || "#2F6FED";
      var visual = c._photo ? "<img src='" + c._photo + "'>" : silhouette(color);
      var excerpt = c.description ? (c.description.length > 100 ? c.description.slice(0, 100).trim() + "…" : c.description) : T("saved.no_description");

      var card = document.createElement("div");
      card.className = "saved-card";
      card.innerHTML =
        "<div class='saved-visual'>" + visual +
          "<div class='saved-pt-badge'>" + (POWERTRAIN_LABEL[c.powertrain] || c.powertrain) + "</div>" +
          "<div class='saved-price-badge'>$" + Math.round(c.price_usd / 1000) + "k</div>" +
          "<div class='saved-hover-desc'>" + excerpt + "</div>" +
        "</div>" +
        "<div class='saved-body'>" +
          "<div class='saved-title'>" + c.make + " " + c.model + "</div>" +
          "<div class='saved-sub'>" + c.year + " · " + c.segment + "</div>" +
          "<div class='saved-actions'>" +
            "<span class='saved-chat-hint'>💬 " + T("saved.ask_ai_hint") + "</span>" +
            "<button class='chat-open-btn' style='position:static; width:28px; height:28px; opacity:1;' aria-label='" + T("deck.ask_ai_aria") + "'>💬</button>" +
          "</div>" +
        "</div>";

      card.querySelector(".chat-open-btn").addEventListener("click", function (e) {
        e.stopPropagation();
        window.CarModals.openChat({
          id: c.id, make: c.make, model: c.model, year: c.year,
          segment: c.segment, country: c.country, powertrain: c.powertrain,
          accel0to100: c.accel_0_100, powerKw: c.power_kw, description: c.description,
        });
      });

      card.addEventListener("click", function () {
        document.getElementById("description-modal-body").innerHTML =
          "<h2 style='margin:0 0 6px;'>" + c.make + " " + c.model + " (" + c.year + ")</h2>" +
          "<p style='color:var(--muted); font-size:13px; margin:0 0 14px;'>" + c.segment + " · " + c.country + " · $" + c.price_usd.toLocaleString("en-US") + "</p>" +
          "<p style='line-height:1.6; font-size:14px;'>" + (c.description || T("carmodal.no_description")) + "</p>";
        document.getElementById("description-modal").style.display = "flex";
      });

      grid.appendChild(card);
    });
  }

  document.querySelectorAll(".modal-close").forEach(function (btn) {
    btn.addEventListener("click", function () { document.getElementById(btn.dataset.close).style.display = "none"; });
  });
  document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.style.display = "none"; });
  });

  window.addEventListener("veloce:langchange", function () { renderToolbar(); renderGrid(); });
  window.addEventListener("veloce:themechange", function () { theme = window.CM_APPEARANCE.resolvedTheme(); });

  loadSaved();
})();
