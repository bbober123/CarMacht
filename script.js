(function () {
  "use strict";

  // Standardowy sposob z dokumentacji Supabase na wykrycie stanu logowania:
  // nasluchujemy jednego zdarzenia onAuthStateChange zamiast recznie odpytywac
  // getSession() i zgadywac, czy strona wlasnie wrocila z logowania Google.
  // Subskrypcja odpala sie raz z aktualnym stanem sesji (takze zaraz po
  // przetworzeniu powrotu z OAuth), wiec nic nie trzeba recznie odczekiwac.
  function waitForAuthState(client) {
    return new Promise(function (resolve) {
      var sub = client.auth.onAuthStateChange(function (event, session) {
        sub.data.subscription.unsubscribe();
        resolve(session);
      });
    });
  }

  var T = window.CM_T;
  function POWERTRAIN_LIVE() {
    return {
      electric: { label: T("powertrain.electric"), color: "#2F6FED", emoji: "⚡" },
      hybrid: { label: T("powertrain.hybrid"), color: "#22B07D", emoji: "🍃" },
      combustion: { label: T("powertrain.combustion"), color: "#E8622C", emoji: "⛽" },
    };
  }
  var POWERTRAIN = POWERTRAIN_LIVE();

  var THEME_KEY = "veloce_theme";

  var onboardScreen = document.getElementById("onboard-screen");
  var progressBar = document.getElementById("progress-bar");
  var onboardBody = document.getElementById("onboard-body");
  var deckScreen = document.getElementById("deck-screen");
  var deckEl = document.getElementById("deck");
  var logoImg = document.getElementById("logo-img");
  var themeBtn = document.getElementById("theme-btn");
  var nopeBtn = document.getElementById("nope-btn");
  var likeBtn = document.getElementById("like-btn");
  var likedBadge = document.getElementById("liked-badge");
  var likedCountEl = document.getElementById("liked-count");
  var restartBtn = document.getElementById("restart-btn");
  var errorBanner = document.getElementById("error-banner");
  var descModal = document.getElementById("description-modal");
  var descModalBody = document.getElementById("description-modal-body");

  var supabaseClient = null;
  var visitorId = null; // = auth.uid(), logowanie jest teraz obowiazkowe

  function showBadgeToast(icon, name) {
    var el = document.createElement("div");
    el.className = "badge-toast";
    el.innerHTML = "<span class='icon'>" + icon + "</span><div><div class='text-title'>" + T("badge.new_badge") + "</div><div class='text-sub'>" + name + "</div></div>";
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 400);
    }, 3500);
  }

  async function checkBadgesAndNotify() {
    var beforeRes = await supabaseClient.from("user_badges").select("badge_id").eq("user_id", visitorId);
    var beforeIds = (beforeRes.data || []).map(function (r) { return r.badge_id; });
    await supabaseClient.rpc("check_and_award_badges");
    var afterRes = await supabaseClient.from("user_badges").select("badge_id, badges(name, icon)").eq("user_id", visitorId);
    (afterRes.data || []).forEach(function (row) {
      if (beforeIds.indexOf(row.badge_id) === -1 && row.badges) showBadgeToast(row.badges.icon, row.badges.name);
    });
  }

  function showFatalError(html) {
    errorBanner.innerHTML = html;
    errorBanner.style.display = "flex";
  }

  function mapRowToCar(row, photosByCarId) {
    var photos = (photosByCarId && photosByCarId[row.id]) || [];
    return {
      id: row.id,
      make: row.make,
      model: row.model,
      year: row.year,
      segment: row.segment,
      country: row.country,
      powertrain: row.powertrain,
      engine: row.engine,
      drivetrain: row.drivetrain,
      powerKw: row.power_kw,
      torqueNm: row.torque_nm,
      accel0to100: row.accel_0_100,
      topSpeedKmh: row.top_speed_kmh,
      priceUsd: row.price_usd,
      description: row.description || "",
      photoUrl: photos.length > 0 ? photos[0] : null,
    };
  }

  var state = {
    theme: localStorage.getItem(THEME_KEY) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    prefs: null,
    likedIds: [],
    seenIds: [],
    allCars: [],
    queue: [],
    step: 0,
  };

  function applyTheme() {
    state.theme = (window.CM_APPEARANCE ? window.CM_APPEARANCE.resolvedTheme() : state.theme);
    document.documentElement.classList.toggle("light", state.theme === "light");
    themeBtn.textContent = state.theme === "dark" ? "☀️" : "🌙";
    logoImg.src = state.theme === "dark" ? "logo-dark.png" : "logo-light.png";
  }

  themeBtn.addEventListener("click", function () {
    var next = state.theme === "dark" ? "light" : "dark";
    if (window.CM_APPEARANCE) window.CM_APPEARANCE.setThemeMode(next);
    state.theme = next;
    localStorage.setItem(THEME_KEY, state.theme);
    applyTheme();
  });
  window.addEventListener("veloce:themechange", applyTheme);

  // Bez kategorii cenowej - dopasowanie oparte o naped, segment, kraj pochodzenia i marke
  function scoreCar(car, prefs) {
    var score = 0;
    if (prefs.powertrains.length === 0 || prefs.powertrains.indexOf(car.powertrain) > -1) score += 3;
    if (prefs.segments.length === 0 || prefs.segments.indexOf(car.segment) > -1) score += 3;
    if (prefs.countries.length === 0 || prefs.countries.indexOf(car.country) > -1) score += 2;
    if (prefs.brands.length === 0 || prefs.brands.indexOf(car.make) > -1) score += 2;
    return score;
  }

  function sortByMatch(cars, prefs) {
    return cars.slice().sort(function (a, b) { return scoreCar(b, prefs) - scoreCar(a, prefs); });
  }

  // ---------------- ONBOARDING (obowiazkowy, bez mozliwosci pominiecia) ----------------
  var wizard = { powertrains: [], segments: [], countries: [], brands: [] };
  var TOTAL_STEPS = 4;

  function chip(label, active, color, onClick) {
    var b = document.createElement("button");
    b.className = "chip" + (active ? " active" : "");
    b.textContent = label;
    if (active && color) { b.style.background = color; b.style.borderColor = color; }
    b.addEventListener("click", onClick);
    return b;
  }

  function renderProgress() {
    progressBar.innerHTML = "";
    for (var i = 0; i <= TOTAL_STEPS; i++) {
      var seg = document.createElement("div");
      seg.className = "progress-seg" + (i <= state.step ? " done" : "");
      progressBar.appendChild(seg);
    }
  }

  function navRow(isLast) {
    var row = document.createElement("div");
    row.className = "nav-row";
    if (state.step > 0) {
      var back = document.createElement("button");
      back.className = "btn-secondary";
      back.textContent = T("onboard.back_btn");
      back.addEventListener("click", function () { state.step -= 1; renderStep(); });
      row.appendChild(back);
    }
    var next = document.createElement("button");
    next.className = "btn-primary";
    next.textContent = isLast ? T("onboard.finish_btn") : T("onboard.next_btn");
    next.addEventListener("click", function () {
      if (isLast) { finishOnboarding(); } else { state.step += 1; renderStep(); }
    });
    row.appendChild(next);
    return row;
  }

  function renderStep() {
    POWERTRAIN = POWERTRAIN_LIVE();
    var segmentOptions = Array.from(new Set(state.allCars.map(function (c) { return c.segment; }))).sort();
    var countryOptions = Array.from(new Set(state.allCars.map(function (c) { return c.country; }))).sort();
    var brandOptions = Array.from(new Set(state.allCars.map(function (c) { return c.make; }))).sort();

    renderProgress();
    onboardBody.innerHTML = "";

    if (state.step === 0) {
      var logo = document.createElement("img");
      logo.id = "onboard-welcome-logo";
      logo.className = "site-logo";
      logo.src = state.theme === "dark" ? "logo-dark.png" : "logo-light.png";
      var h = document.createElement("h2"); h.textContent = T("onboard.welcome_title");
      var p = document.createElement("p"); p.className = "sub";
      p.textContent = state.tagline
        ? state.tagline + T("onboard.welcome_sub_tagline_suffix")
        : T("onboard.welcome_sub_default");
      var btn = document.createElement("button");
      btn.className = "btn-primary";
      btn.textContent = T("onboard.start_btn");
      btn.addEventListener("click", function () { state.step = 1; renderStep(); });
      onboardBody.appendChild(logo);
      onboardBody.appendChild(h);
      onboardBody.appendChild(p);
      onboardBody.appendChild(btn);
    }

    else if (state.step === 1) {
      var h2 = document.createElement("h2"); h2.textContent = T("onboard.step_powertrain_title");
      var sub2 = document.createElement("p"); sub2.className = "sub"; sub2.textContent = T("onboard.step_powertrain_sub");
      var wrap = document.createElement("div");
      Object.keys(POWERTRAIN).forEach(function (key) {
        var active = wizard.powertrains.indexOf(key) > -1;
        wrap.appendChild(chip(POWERTRAIN[key].label, active, POWERTRAIN[key].color, function () {
          var i = wizard.powertrains.indexOf(key);
          if (i > -1) wizard.powertrains.splice(i, 1); else wizard.powertrains.push(key);
          renderStep();
        }));
      });
      onboardBody.appendChild(h2); onboardBody.appendChild(sub2); onboardBody.appendChild(wrap);
      onboardBody.appendChild(navRow(false));
    }

    else if (state.step === 2) {
      var h3 = document.createElement("h2"); h3.textContent = T("onboard.step_segment_title");
      var sub3 = document.createElement("p"); sub3.className = "sub"; sub3.textContent = T("onboard.step_segment_sub");
      var wrap3 = document.createElement("div");
      segmentOptions.forEach(function (s) {
        var active = wizard.segments.indexOf(s) > -1;
        wrap3.appendChild(chip(s, active, null, function () {
          var i = wizard.segments.indexOf(s);
          if (i > -1) wizard.segments.splice(i, 1); else wizard.segments.push(s);
          renderStep();
        }));
      });
      onboardBody.appendChild(h3); onboardBody.appendChild(sub3); onboardBody.appendChild(wrap3);
      onboardBody.appendChild(navRow(false));
    }

    else if (state.step === 3) {
      var h4 = document.createElement("h2"); h4.textContent = T("onboard.step_country_title");
      var sub4 = document.createElement("p"); sub4.className = "sub"; sub4.textContent = T("onboard.step_country_sub");
      var wrap4 = document.createElement("div");
      countryOptions.forEach(function (c) {
        var active = wizard.countries.indexOf(c) > -1;
        wrap4.appendChild(chip(c, active, null, function () {
          var i = wizard.countries.indexOf(c);
          if (i > -1) wizard.countries.splice(i, 1); else wizard.countries.push(c);
          renderStep();
        }));
      });
      onboardBody.appendChild(h4); onboardBody.appendChild(sub4); onboardBody.appendChild(wrap4);
      onboardBody.appendChild(navRow(false));
    }

    else if (state.step === 4) {
      var h5 = document.createElement("h2"); h5.textContent = T("onboard.step_brand_title");
      var sub5 = document.createElement("p"); sub5.className = "sub"; sub5.textContent = T("onboard.step_brand_sub");
      var wrap5 = document.createElement("div");
      brandOptions.forEach(function (b) {
        var active = wizard.brands.indexOf(b) > -1;
        wrap5.appendChild(chip(b, active, null, function () {
          var i = wizard.brands.indexOf(b);
          if (i > -1) wizard.brands.splice(i, 1); else wizard.brands.push(b);
          renderStep();
        }));
      });
      onboardBody.appendChild(h5); onboardBody.appendChild(sub5); onboardBody.appendChild(wrap5);
      onboardBody.appendChild(navRow(true));
    }
  }

  async function finishOnboarding() {
    state.prefs = { powertrains: wizard.powertrains, segments: wizard.segments, countries: wizard.countries, brands: wizard.brands };

    var res = await supabaseClient.from("preferences").upsert({
      visitor_id: visitorId,
      budget: 0,
      powertrains: state.prefs.powertrains.join(","),
      segments: state.prefs.segments.join(","),
      brands: state.prefs.brands.join(","),
      countries: state.prefs.countries.join(","),
    }, { onConflict: "visitor_id" });

    if (res.error) {
      showFatalError(T("error.save_pref_failed") + res.error.message + "</code>");
      return;
    }

    buildQueue();
    onboardScreen.style.display = "none";
    deckScreen.style.display = "flex";
    applyTheme();
    renderDeck();
  }

  restartBtn.addEventListener("click", async function () {
    await supabaseClient.from("preferences").delete().eq("visitor_id", visitorId);
    wizard = { powertrains: [], segments: [], countries: [], brands: [] };
    state.step = 0;
    deckScreen.style.display = "none";
    onboardScreen.style.display = "flex";
    renderStep();
  });

  function buildQueue() {
    var sorted = sortByMatch(state.allCars, state.prefs);
    state.queue = sorted.filter(function (c) { return state.seenIds.indexOf(c.id) === -1; });
  }

  // ---------------- SWIPE DECK ----------------
  function updateLikedUI() {
    likedCountEl.textContent = state.likedIds.length;
    if (state.likedIds.length > 0) {
      likedBadge.style.display = "inline-block";
      likedBadge.textContent = state.likedIds.length;
    } else {
      likedBadge.style.display = "none";
    }
  }

  function carSilhouetteSVG(color) {
    return '<svg viewBox="0 0 320 180" width="100%" height="100%" style="display:block">' +
      '<rect width="320" height="180" fill="' + color + '15"/>' +
      '<g transform="translate(20,70)">' +
      '<path d="M10 60 L28 60 L45 30 Q60 18 90 18 L190 18 Q215 18 228 34 L248 60 L270 60 Q280 60 280 70 L280 78 L10 78 Z" fill="none" stroke="' + color + '" stroke-width="4" stroke-linejoin="round"/>' +
      '<circle cx="70" cy="80" r="16" fill="none" stroke="' + color + '" stroke-width="4"/>' +
      '<circle cx="220" cy="80" r="16" fill="none" stroke="' + color + '" stroke-width="4"/>' +
      '</g></svg>';
  }

  function truncate(text, n) {
    if (!text) return "";
    return text.length > n ? text.slice(0, n).trim() + "…" : text;
  }

  function openDescriptionModal(car) {
    descModalBody.innerHTML =
      "<h2 style='margin:0 0 6px;'>" + car.make + " " + car.model + " (" + car.year + ")</h2>" +
      "<p style='color:var(--muted); font-size:13px; margin:0 0 14px;'>" + car.segment + " · " + car.country + "</p>" +
      "<p style='line-height:1.6; font-size:14px;'>" + (car.description || T("deck.no_description")) + "</p>";
    descModal.style.display = "flex";
  }

  function dayOfYear(d) {
    var start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  }

  function showCarOfTheDay() {
    var banner = document.getElementById("car-of-day-banner");
    if (!state.allCars.length) return;

    var idx = dayOfYear(new Date()) % state.allCars.length;
    var car = state.allCars[idx];

    banner.innerHTML =
      "<span class='cod-emoji'>🌟</span>" +
      "<span class='cod-text'>" + T("deck.car_of_day") + "<b>" + car.make + " " + car.model + "</b></span>" +
      "<span class='cod-arrow'>" + T("deck.see_more") + "</span>";
    banner.style.display = "flex";
    banner.addEventListener("click", function () { openDescriptionModal(car); });
  }

  function renderDeck() {
    deckEl.innerHTML = "";

    if (state.queue.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "<div style='font-size:26px'>🔄</div><h3>" + T("deck.no_more_title") + "</h3><p>" + T("deck.no_more_desc") + "</p>";
      var btn = document.createElement("button");
      btn.className = "btn-primary";
      btn.textContent = T("deck.change_prefs_btn");
      btn.addEventListener("click", function () { restartBtn.click(); });
      empty.appendChild(btn);
      deckEl.appendChild(empty);
      return;
    }

    state.queue.slice(0, 3).forEach(function (car, offset) {
      var pt = POWERTRAIN[car.powertrain];
      var card = document.createElement("div");
      card.className = "car-card";
      card.style.transform = "translateY(" + (offset * 10) + "px) scale(" + (1 - offset * 0.04) + ")";
      card.style.transition = "transform .3s";
      card.style.zIndex = 10 - offset;
      if (offset === 0) card.style.cursor = "grab";

      var descHtml = "";
      if (car.description) {
        descHtml = "<div class='car-desc-excerpt'>" + truncate(car.description, 70) + " <button class='desc-more-btn'>" + T("deck.read_more") + "</button></div>";
      }

      card.innerHTML =
        '<div class="car-card-inner">' +
          '<div class="car-visual">' + (car.photoUrl ? '<img src="' + car.photoUrl + '" style="width:100%;height:100%;object-fit:cover;display:block;">' : carSilhouetteSVG(pt.color)) +
            '<div class="pt-badge" style="color:' + pt.color + '">' + pt.emoji + ' ' + pt.label.toUpperCase() + '</div>' +
            '<div class="country-badge">📍 ' + car.country + '</div>' +
            '<button class="photo-propose-btn" aria-label="' + T("deck.photo_propose_aria") + '">📷</button>' +
            '<button class="chat-open-btn" aria-label="' + T("deck.ask_ai_aria") + '">💬</button>' +
            '<div class="swipe-badge like">' + T("deck.like_badge") + '</div>' +
            '<div class="swipe-badge nope">' + T("deck.nope_badge") + '</div>' +
          '</div>' +
          '<div class="car-info">' +
            '<div class="car-title-row"><span class="car-title">' + car.make + ' ' + car.model + '</span><span class="car-year">' + car.year + '</span></div>' +
            '<div class="car-sub">' + car.segment + ' · ' + car.engine + '</div>' +
            descHtml +
            '<div class="spec-grid">' +
              '<div class="spec-box"><div class="spec-label">' + T("deck.spec_accel") + '</div><div class="spec-value">' + car.accel0to100 + 's</div></div>' +
              '<div class="spec-box"><div class="spec-label">' + T("deck.spec_power") + '</div><div class="spec-value">' + car.powerKw + 'kW</div></div>' +
              '<div class="spec-box"><div class="spec-label">' + T("deck.spec_price") + '</div><div class="spec-value">$' + Math.round(car.priceUsd / 1000) + 'k</div></div>' +
            '</div>' +
          '</div>' +
        '</div>';

      card.querySelector(".photo-propose-btn").addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      card.querySelector(".photo-propose-btn").addEventListener("click", function (e) {
        e.stopPropagation();
        openProposePhotoModal(car);
      });
      card.querySelector(".chat-open-btn").addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      card.querySelector(".chat-open-btn").addEventListener("click", function (e) {
        e.stopPropagation();
        window.CarModals.openChat(car);
      });
      var moreBtn = card.querySelector(".desc-more-btn");
      if (moreBtn) {
        moreBtn.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
        moreBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          openDescriptionModal(car);
        });
      }

      deckEl.appendChild(card);
      if (offset === 0) attachDrag(card, car);
    });
  }

  function attachDrag(card, car) {
    var startX = 0, startY = 0, dragging = false;
    var likeBadgeEl = card.querySelector(".swipe-badge.like");
    var nopeBadgeEl = card.querySelector(".swipe-badge.nope");

    card.addEventListener("pointerdown", function (e) {
      dragging = true; startX = e.clientX; startY = e.clientY;
      card.setPointerCapture(e.pointerId);
      card.style.transition = "none";
    });
    card.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      card.style.transform = "translate(" + dx + "px," + (dy * 0.3) + "px) rotate(" + (dx / 18) + "deg)";
      likeBadgeEl.style.opacity = Math.min(Math.max(dx / 100, 0), 1);
      nopeBadgeEl.style.opacity = Math.min(Math.max(-dx / 100, 0), 1);
    });
    card.addEventListener("pointerup", function (e) {
      if (!dragging) return;
      dragging = false;
      var dx = e.clientX - startX;
      card.style.transition = "transform .35s cubic-bezier(.2,.8,.2,1)";
      if (dx > 110) finishSwipe(card, car, 1);
      else if (dx < -110) finishSwipe(card, car, -1);
      else {
        card.style.transform = "translate(0,0) rotate(0)";
        likeBadgeEl.style.opacity = 0; nopeBadgeEl.style.opacity = 0;
      }
    });
    card._swipe = function (dir) { card.style.transition = "transform .3s"; finishSwipe(card, car, dir); };
  }

  function finishSwipe(card, car, dir) {
    card.style.transform = "translate(" + (dir * 500) + "px,0) rotate(" + (dir * 20) + "deg)";

    var liked = dir === 1;
    state.seenIds.push(car.id);

    supabaseClient.from("swipes").upsert({
      visitor_id: visitorId,
      car_id: car.id,
      liked: liked,
    }, { onConflict: "visitor_id,car_id" }).then(function (res) {
      if (res.error) console.error("Nie udało się zapisać swipe'a:", res.error.message);
      else checkBadgesAndNotify();
    });

    if (liked && state.likedIds.indexOf(car.id) === -1) {
      state.likedIds.push(car.id);
      updateLikedUI();
    }
    if (!liked) {
      // Auto odrzucone - rozmowa z AI o nim (jesli byla) znika, zgodnie z zasada
      supabaseClient.from("car_conversations").delete().eq("user_id", visitorId).eq("car_id", car.id).then(function () {});
    }

    setTimeout(function () {
      state.queue.shift();
      renderDeck();
    }, 220);
  }

  nopeBtn.addEventListener("click", function () {
    var top = deckEl.querySelector('.car-card[style*="z-index: 10"]');
    if (top && top._swipe) top._swipe(-1);
  });
  likeBtn.addEventListener("click", function () {
    var top = deckEl.querySelector('.car-card[style*="z-index: 10"]');
    if (top && top._swipe) top._swipe(1);
  });

  document.querySelectorAll(".nav-item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".nav-item").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
    });
  });

  // ---------------- MODALE: ZGŁOSZENIA OD UŻYTKOWNIKÓW ----------------
  var proposeCarModal = document.getElementById("propose-car-modal");
  var proposeCarBtn = document.getElementById("propose-car-btn");
  var proposeCarForm = document.getElementById("propose-car-form");
  var proposePhotoModal = document.getElementById("propose-photo-modal");
  var proposePhotoForm = document.getElementById("propose-photo-form");
  var proposePhotoTitle = document.getElementById("propose-photo-title");
  var currentPhotoCarId = null;

  function openModal(el) { el.style.display = "flex"; }
  function closeModal(el) { el.style.display = "none"; }

  document.querySelectorAll(".modal-close").forEach(function (btn) {
    btn.addEventListener("click", function () { closeModal(document.getElementById(btn.dataset.close)); });
  });
  document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(overlay); });
  });

  proposeCarBtn.addEventListener("click", function () { openModal(proposeCarModal); });

  function openProposePhotoModal(car) {
    currentPhotoCarId = car.id;
    proposePhotoTitle.textContent = T("modal.propose_photo_title_prefix") + car.make + " " + car.model;
    proposePhotoForm.reset();
    proposePhotoForm.querySelector(".modal-status").textContent = "";
    openModal(proposePhotoModal);
  }

  async function uploadToSubmissions(file) {
    var path = "sub-" + Date.now() + "-" + file.name.replace(/\s+/g, "_");
    var res = await supabaseClient.storage.from("submissions").upload(path, file);
    if (res.error) throw new Error(res.error.message);
    return supabaseClient.storage.from("submissions").getPublicUrl(path).data.publicUrl;
  }

  proposeCarForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    var statusEl = f.querySelector(".modal-status");
    statusEl.textContent = T("common.sending");
    try {
      var photoUrl = null;
      if (f.file.files[0]) photoUrl = await uploadToSubmissions(f.file.files[0]);

      var res = await supabaseClient.from("car_submissions").insert({
        visitor_id: visitorId,
        make: f.make.value.trim(),
        model: f.model.value.trim(),
        year: f.year.value ? Number(f.year.value) : null,
        segment: f.segment.value.trim(),
        country: f.country.value.trim(),
        powertrain: f.powertrain.value || null,
        description: f.description.value.trim(),
        photo_url: photoUrl,
      });
      if (res.error) throw new Error(res.error.message);

      statusEl.textContent = T("modal.propose_car_success");
      await checkBadgesAndNotify();
      setTimeout(function () { closeModal(proposeCarModal); f.reset(); statusEl.textContent = ""; }, 1400);
    } catch (err) {
      statusEl.textContent = T("common.error_prefix") + err.message;
    }
  });

  proposePhotoForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    var statusEl = f.querySelector(".modal-status");
    statusEl.textContent = T("common.sending");
    try {
      var url = await uploadToSubmissions(f.file.files[0]);
      var res = await supabaseClient.from("photo_submissions").insert({
        car_id: currentPhotoCarId,
        visitor_id: visitorId,
        url: url,
      });
      if (res.error) throw new Error(res.error.message);

      statusEl.textContent = T("modal.propose_photo_success");
      await checkBadgesAndNotify();
      setTimeout(function () { closeModal(proposePhotoModal); f.reset(); statusEl.textContent = ""; }, 1400);
    } catch (err) {
      statusEl.textContent = T("common.error_prefix") + err.message;
    }
  });

  // ---------------- START ----------------
  async function init() {
    applyTheme();

    if (typeof SUPABASE_URL === "undefined" || SUPABASE_URL.indexOf("TWOJ-PROJEKT") > -1) {
      showFatalError(T("error.no_config"));
      return;
    }

    var cleanUrl = SUPABASE_URL.trim().replace(/\/+$/, "");
    var cleanKey = SUPABASE_ANON_KEY.trim();
    var urlPattern = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i;

    if (!urlPattern.test(cleanUrl)) {
      showFatalError(T("error.bad_url_1") + SUPABASE_URL + T("error.bad_url_2"));
      return;
    }

    supabaseClient = window.__supabaseClient || window.supabase.createClient(cleanUrl, cleanKey);
    if (!window.__supabaseClient) window.__supabaseClient = supabaseClient;
    window.CarModals.init(supabaseClient);

    supabaseClient.from("site_settings").select("*").then(function (res) {
      (res.data || []).forEach(function (s) {
        if (s.key === "tagline" && s.value) state.tagline = s.value;
      });
    });

    // Logowanie jest teraz obowiazkowe - bez konta nie ma dostepu do przegladania.
    // waitForAuthState() samo zaczeka az supabase-js skonczy przetwarzac ewentualny
    // powrot z logowania Google, wiec nie odsylamy zalogowanej osoby z powrotem na auth.html.
    var session = await waitForAuthState(supabaseClient);
    if (!session) {
      window.location.href = "auth.html";
      return;
    }
    visitorId = session.user.id;

    var profileRes = await supabaseClient.from("profiles").select("is_banned").eq("id", visitorId).maybeSingle();
    if (profileRes.data && profileRes.data.is_banned) {
      showFatalError(T("error.banned"));
      return;
    }

    var carsRes = await supabaseClient.from("cars").select("*");
    if (carsRes.error) {
      showFatalError(T("error.fetch_cars_failed") + carsRes.error.message + "</code>");
      return;
    }
    if (!carsRes.data || carsRes.data.length === 0) {
      showFatalError(T("error.db_empty"));
      return;
    }

    var photosRes = await supabaseClient.from("car_photos").select("car_id,url").order("is_primary", { ascending: false });
    var photosByCarId = {};
    if (!photosRes.error && photosRes.data) {
      photosRes.data.forEach(function (p) {
        if (!photosByCarId[p.car_id]) photosByCarId[p.car_id] = [];
        photosByCarId[p.car_id].push(p.url);
      });
    }

    state.allCars = carsRes.data.map(function (row) { return mapRowToCar(row, photosByCarId); });
    showCarOfTheDay();

    var prefRes = await supabaseClient.from("preferences").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (prefRes.error) {
      showFatalError(T("error.fetch_prefs_failed") + prefRes.error.message + "</code>");
      return;
    }

    // Wszystkie dotychczasowe swipe'y (lubie i pas) - te auta nie wroca juz do stosu
    var allSwipesRes = await supabaseClient.from("swipes").select("car_id,liked").eq("visitor_id", visitorId);
    state.seenIds = [];
    state.likedIds = [];
    if (!allSwipesRes.error && allSwipesRes.data) {
      allSwipesRes.data.forEach(function (r) {
        state.seenIds.push(r.car_id);
        if (r.liked) state.likedIds.push(r.car_id);
      });
    }
    updateLikedUI();

    if (prefRes.data) {
      state.prefs = {
        powertrains: prefRes.data.powertrains ? prefRes.data.powertrains.split(",").filter(Boolean) : [],
        segments: prefRes.data.segments ? prefRes.data.segments.split(",").filter(Boolean) : [],
        brands: prefRes.data.brands ? prefRes.data.brands.split(",").filter(Boolean) : [],
        countries: prefRes.data.countries ? prefRes.data.countries.split(",").filter(Boolean) : [],
      };
      buildQueue();
      onboardScreen.style.display = "none";
      deckScreen.style.display = "flex";
      renderDeck();
    } else {
      renderStep();
    }
  }

  window.addEventListener("veloce:langchange", function () {
    POWERTRAIN = POWERTRAIN_LIVE();
    if (deckScreen.style.display !== "none") { renderDeck(); }
    else { renderStep(); }
  });

  init();
})();
