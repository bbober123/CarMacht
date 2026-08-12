(function () {
  "use strict";

  function showFatalError(msg) {
    document.body.innerHTML =
      "<div style='min-height:100vh; display:flex; align-items:center; justify-content:center; padding:30px; font-family:sans-serif;'>" +
      "<div style='max-width:480px; text-align:center; color:#14161A;'>" +
      "<h1 style='font-size:18px; margin-bottom:10px;'>Panel nie może wystartować</h1>" +
      "<p style='font-size:14px; color:#6B6E75; line-height:1.6;'>" + msg + "</p>" +
      "</div></div>";
  }

  if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") {
    showFatalError("Brak pliku <code>config.js</code> albo nie jest wczytany. Sprawdź, czy plik istnieje obok tego panelu.");
    return;
  }

  var cleanUrl = SUPABASE_URL.trim().replace(/\/+$/, "");
  var cleanKey = SUPABASE_ANON_KEY.trim();

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)) {
    showFatalError("SUPABASE_URL w <code>config.js</code> wygląda niepoprawnie: <code>" + SUPABASE_URL + "</code>. Powinno być dokładnie: https://xxxxxxxx.supabase.co");
    return;
  }

  var supabaseClient;
  try {
    supabaseClient = window.supabase.createClient(cleanUrl, cleanKey);
  } catch (err) {
    showFatalError("Nie udało się połączyć z Supabase: " + err.message);
    return;
  }

  var loginScreen = document.getElementById("login-screen");
  var adminPanel = document.getElementById("admin-panel");
  var loginBtn = document.getElementById("login-btn");
  var logoutBtn = document.getElementById("logout-btn");
  var loginError = document.getElementById("login-error");

  var allCars = [];

  try {

  // ---------------- AUTH ----------------
  loginBtn.addEventListener("click", async function () {
    loginError.textContent = "";
    var email = document.getElementById("login-email").value.trim();
    var password = document.getElementById("login-password").value;
    try {
      var res = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
      if (res.error) {
        loginError.textContent = "Błąd logowania: " + res.error.message;
        return;
      }

      var profileRes = await supabaseClient.from("profiles").select("is_admin").eq("id", res.data.user.id).maybeSingle();
      if (profileRes.error || !profileRes.data || !profileRes.data.is_admin) {
        await supabaseClient.auth.signOut();
        loginError.textContent = "To konto nie ma uprawnień administratora.";
        return;
      }

      showPanel();
    } catch (err) {
      loginError.textContent = "Błąd połączenia: " + err.message;
    }
  });

  logoutBtn.addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  async function checkSession() {
    try {
      var res = await supabaseClient.auth.getSession();
      if (!res.data.session) { showLogin(); return; }

      var profileRes = await supabaseClient.from("profiles").select("is_admin").eq("id", res.data.session.user.id).maybeSingle();
      if (profileRes.error || !profileRes.data || !profileRes.data.is_admin) {
        await supabaseClient.auth.signOut();
        loginError.textContent = "To konto nie ma uprawnień administratora.";
        showLogin();
        return;
      }
      showPanel();
    } catch (err) {
      showFatalError("Błąd sprawdzania sesji: " + err.message + "<br><br>Sprawdź konsolę przeglądarki (F12) po więcej szczegółów.");
    }
  }


  function showLogin() { loginScreen.style.display = "flex"; adminPanel.style.display = "none"; }
  function showPanel() {
    loginScreen.style.display = "none";
    adminPanel.style.display = "block";
    loadDashboard();
    loadCars();
    loadCarSubmissions();
    loadPhotoSubmissions();
    loadUsers();
    loadBadges();
    loadContestTab();
    loadFeedback();
    loadAppearance();
  }

  // ---------------- TABS ----------------
  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function (p) { p.style.display = "none"; });
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).style.display = "block";
    });
  });

  // ---------------- AUTA: lista + wyszukiwanie ----------------
  async function loadCars() {
    var res = await supabaseClient.from("cars").select("*").order("created_at", { ascending: false });
    if (res.error) { document.getElementById("cars-table").textContent = "Błąd: " + res.error.message; return; }
    allCars = res.data;
    document.getElementById("cars-count").textContent = allCars.length;
    renderCarsTable(allCars);
    populateCarSelect(allCars);
  }

  function renderCarsTable(cars) {
    var el = document.getElementById("cars-table");
    if (cars.length === 0) { el.innerHTML = "<p class='empty-msg'>Brak aut w bazie.</p>"; return; }
    var html = "<table><thead><tr><th>Marka</th><th>Model</th><th>Rok</th><th>Napęd</th><th>Cena</th><th></th></tr></thead><tbody>";
    cars.forEach(function (c) {
      html += "<tr><td>" + c.make + "</td><td>" + c.model + "</td><td>" + c.year + "</td><td>" + c.powertrain + "</td><td>$" + c.price_usd.toLocaleString("en-US") + "</td>" +
        "<td><button class='btn-small btn-delete' data-id='" + c.id + "'>Usuń</button></td></tr>";
    });
    html += "</tbody></table>";
    el.innerHTML = html;
    el.querySelectorAll(".btn-delete").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("Usunąć to auto na stałe?")) return;
        await supabaseClient.from("cars").delete().eq("id", btn.dataset.id);
        loadCars();
      });
    });
  }

  document.getElementById("cars-search").addEventListener("input", function (e) {
    var q = e.target.value.toLowerCase();
    renderCarsTable(allCars.filter(function (c) {
      return c.make.toLowerCase().indexOf(q) > -1 || c.model.toLowerCase().indexOf(q) > -1;
    }));
  });

  function populateCarSelect(cars) {
    var sel = document.getElementById("photo-car-select");
    sel.innerHTML = "<option value=''>Wybierz auto...</option>";
    cars.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.make + " " + c.model + " (" + c.year + ")";
      sel.appendChild(opt);
    });
  }

  function nextCarId() {
    var max = 0;
    allCars.forEach(function (c) {
      var n = parseInt(String(c.id).replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return "car-" + String(max + 1).padStart(4, "0");
  }

  // ---------------- AUTA: dodaj jedno ----------------
  document.getElementById("add-car-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    var statusEl = document.getElementById("add-car-status");
    var row = {
      id: nextCarId(),
      make: f.make.value.trim(),
      model: f.model.value.trim(),
      year: Number(f.year.value),
      segment: f.segment.value.trim(),
      country: f.country.value.trim(),
      powertrain: f.powertrain.value,
      engine: f.engine.value.trim(),
      drivetrain: f.drivetrain.value,
      power_kw: Number(f.powerKw.value),
      torque_nm: Number(f.torqueNm.value),
      accel_0_100: Number(f.accel.value),
      top_speed_kmh: Number(f.topSpeed.value),
      price_usd: Number(f.price.value),
      description: f.description.value.trim(),
    };
    var res = await supabaseClient.from("cars").insert(row);
    if (res.error) { statusEl.textContent = "Błąd: " + res.error.message; return; }
    statusEl.textContent = "Dodano: " + row.make + " " + row.model;
    f.reset();
    loadCars();
  });

  // ---------------- AUTA: CSV bulk ----------------
  document.getElementById("csv-submit-btn").addEventListener("click", async function () {
    var statusEl = document.getElementById("csv-status");
    var text = document.getElementById("csv-input").value.trim();
    if (!text) { statusEl.textContent = "Wklej najpierw jakieś linie CSV."; return; }

    var lines = text.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    var startId = nextCarId().replace("car-", "");
    var startNum = parseInt(startId, 10);

    var rows = [];
    var errors = [];
    lines.forEach(function (line, idx) {
      var parts = line.split(",").map(function (p) { return p.trim(); });
      if (parts.length < 13) { errors.push("Linia " + (idx + 1) + ": za mało pól (" + parts.length + "/13-14)"); return; }
      rows.push({
        id: "car-" + String(startNum + idx).padStart(4, "0"),
        make: parts[0], model: parts[1], year: Number(parts[2]), segment: parts[3], country: parts[4],
        powertrain: parts[5], engine: parts[6], drivetrain: parts[7],
        power_kw: Number(parts[8]), torque_nm: Number(parts[9]), accel_0_100: Number(parts[10]),
        top_speed_kmh: Number(parts[11]), price_usd: Number(parts[12]), description: parts[13] || "",
      });
    });

    if (errors.length) { statusEl.textContent = errors.join("\n"); return; }

    var res = await supabaseClient.from("cars").insert(rows);
    if (res.error) { statusEl.textContent = "Błąd: " + res.error.message; return; }
    statusEl.textContent = "Dodano " + rows.length + " aut.";
    document.getElementById("csv-input").value = "";
    loadCars();
  });

  // ---------------- AUTA: wgraj katalog startowy ----------------
  document.getElementById("seed-catalog-btn").addEventListener("click", async function () {
    var statusEl = document.getElementById("csv-status");
    statusEl.textContent = "Wgrywanie katalogu startowego (" + ALL_CARS.length + " aut)...";
    var rows = ALL_CARS.map(function (c) {
      return {
        id: c.id, make: c.make, model: c.model, year: c.year, segment: c.segment, country: c.country,
        powertrain: c.powertrain, engine: c.engine, drivetrain: c.drivetrain,
        power_kw: c.powerKw, torque_nm: c.torqueNm, accel_0_100: c.accel0to100,
        top_speed_kmh: c.topSpeedKmh, price_usd: c.priceUsd, description: c.description || "",
      };
    });
    var chunkSize = 50;
    for (var i = 0; i < rows.length; i += chunkSize) {
      var chunk = rows.slice(i, i + chunkSize);
      var res = await supabaseClient.from("cars").upsert(chunk, { onConflict: "id" });
      if (res.error) { statusEl.textContent = "Błąd: " + res.error.message; return; }
      statusEl.textContent = "Wgrano " + Math.min(i + chunkSize, rows.length) + " / " + rows.length;
    }
    statusEl.textContent = "Gotowe - katalog startowy wgrany.";
    loadCars();
  });

  // ---------------- ZDJĘCIA: dodaj do auta ----------------
  document.getElementById("add-photo-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    var statusEl = document.getElementById("add-photo-status");
    var carId = f.carId.value;
    var file = f.file.files[0];
    var isPrimary = f.isPrimary.checked;
    if (!carId || !file) { statusEl.textContent = "Wybierz auto i plik."; return; }

    statusEl.textContent = "Przesyłanie...";
    var path = carId + "/" + Date.now() + "-" + file.name.replace(/\s+/g, "_");
    var uploadRes = await supabaseClient.storage.from("car-photos").upload(path, file);
    if (uploadRes.error) { statusEl.textContent = "Błąd uploadu: " + uploadRes.error.message; return; }

    var publicUrl = supabaseClient.storage.from("car-photos").getPublicUrl(path).data.publicUrl;

    if (isPrimary) {
      await supabaseClient.from("car_photos").update({ is_primary: false }).eq("car_id", carId);
    }
    var insertRes = await supabaseClient.from("car_photos").insert({ car_id: carId, url: publicUrl, is_primary: isPrimary });
    if (insertRes.error) { statusEl.textContent = "Błąd zapisu: " + insertRes.error.message; return; }

    statusEl.textContent = "Zdjęcie dodane.";
    f.reset();
  });

  // ---------------- ZGŁOSZENIA AUT ----------------
  async function loadCarSubmissions() {
    var res = await supabaseClient.from("car_submissions").select("*").eq("status", "pending").order("created_at", { ascending: true });
    var listEl = document.getElementById("car-submissions-list");
    var badge = document.getElementById("badge-cars");
    if (res.error) { listEl.textContent = "Błąd: " + res.error.message; return; }

    if (res.data.length === 0) {
      listEl.innerHTML = "<p class='empty-msg'>Brak nowych zgłoszeń.</p>";
      badge.style.display = "none";
    } else {
      badge.style.display = "inline-block";
      badge.textContent = res.data.length;
      listEl.innerHTML = "";
      res.data.forEach(function (s) {
        var item = document.createElement("div");
        item.className = "submission-item";
        item.innerHTML =
          (s.photo_url ? "<img src='" + s.photo_url + "'>" : "") +
          "<div class='submission-body'>" +
            "<div class='submission-title'>" + s.make + " " + s.model + (s.year ? " (" + s.year + ")" : "") + "</div>" +
            "<div class='submission-meta'>" + [s.segment, s.country, s.powertrain].filter(Boolean).join(" · ") + "</div>" +
            (s.description ? "<div class='submission-meta'>" + s.description + "</div>" : "") +
            "<div class='submission-actions'>" +
              "<button class='btn-small btn-approve'>Zatwierdź</button>" +
              "<button class='btn-small btn-reject'>Odrzuć</button>" +
            "</div>" +
          "</div>";
        item.querySelector(".btn-approve").addEventListener("click", async function () {
          var row = {
            id: nextCarId(),
            make: s.make, model: s.model, year: s.year || new Date().getFullYear(),
            segment: s.segment || "Inne", country: s.country || "Nieznany", powertrain: s.powertrain || "combustion",
            engine: "Do uzupełnienia", drivetrain: "FWD",
            power_kw: 0, torque_nm: 0, accel_0_100: 0, top_speed_kmh: 0, price_usd: 0,
            description: s.description || "",
          };
          await supabaseClient.from("cars").insert(row);
          if (s.photo_url) {
            await supabaseClient.from("car_photos").insert({ car_id: row.id, url: s.photo_url, is_primary: true });
          }
          await supabaseClient.from("car_submissions").update({ status: "approved" }).eq("id", s.id);
          loadCars(); loadCarSubmissions();
        });
        item.querySelector(".btn-reject").addEventListener("click", async function () {
          await supabaseClient.from("car_submissions").update({ status: "rejected" }).eq("id", s.id);
          loadCarSubmissions();
        });
        listEl.appendChild(item);
      });
    }
  }

  // ---------------- ZGŁOSZONE ZDJĘCIA ----------------
  async function loadPhotoSubmissions() {
    var res = await supabaseClient.from("photo_submissions").select("*").eq("status", "pending").order("created_at", { ascending: true });
    var listEl = document.getElementById("photo-submissions-list");
    var badge = document.getElementById("badge-photos");
    if (res.error) { listEl.textContent = "Błąd: " + res.error.message; return; }

    if (res.data.length === 0) {
      listEl.innerHTML = "<p class='empty-msg'>Brak nowych zgłoszeń.</p>";
      badge.style.display = "none";
    } else {
      badge.style.display = "inline-block";
      badge.textContent = res.data.length;
      listEl.innerHTML = "";
      res.data.forEach(function (s) {
        var car = allCars.find(function (c) { return c.id === s.car_id; });
        var item = document.createElement("div");
        item.className = "submission-item";
        item.innerHTML =
          "<img src='" + s.url + "'>" +
          "<div class='submission-body'>" +
            "<div class='submission-title'>" + (car ? car.make + " " + car.model : s.car_id) + "</div>" +
            "<div class='submission-meta'>zgłoszone " + new Date(s.created_at).toLocaleDateString("pl-PL") + "</div>" +
            "<div class='submission-actions'>" +
              "<button class='btn-small btn-approve'>Zatwierdź</button>" +
              "<button class='btn-small btn-reject'>Odrzuć</button>" +
            "</div>" +
          "</div>";
        item.querySelector(".btn-approve").addEventListener("click", async function () {
          await supabaseClient.from("car_photos").insert({ car_id: s.car_id, url: s.url, is_primary: false });
          await supabaseClient.from("photo_submissions").update({ status: "approved" }).eq("id", s.id);
          loadPhotoSubmissions();
        });
        item.querySelector(".btn-reject").addEventListener("click", async function () {
          await supabaseClient.from("photo_submissions").update({ status: "rejected" }).eq("id", s.id);
          loadPhotoSubmissions();
        });
        listEl.appendChild(item);
      });
    }
  }

  // ---------------- UŻYTKOWNICY ----------------
  var allUsers = [];

  async function loadUsers() {
    var res = await supabaseClient.from("profiles").select("*").order("created_at", { ascending: false });
    var el = document.getElementById("users-table");
    if (res.error) { el.textContent = "Błąd: " + res.error.message; return; }
    allUsers = res.data;
    document.getElementById("users-count").textContent = allUsers.length;
    renderUsersTable(allUsers);
    populateGrantUserSelect(allUsers);
  }

  function renderUsersTable(users) {
    var el = document.getElementById("users-table");
    if (users.length === 0) { el.innerHTML = "<p class='empty-msg'>Brak użytkowników.</p>"; return; }
    var html = "<table><thead><tr><th>Email</th><th>Nazwa</th><th>Dołączył</th><th>Status</th><th></th></tr></thead><tbody>";
    users.forEach(function (u) {
      var statusLabel = u.is_admin ? "<span style='color:#2F6FED;font-weight:600;'>Admin</span>" : (u.is_banned ? "<span style='color:#D6543F;font-weight:600;'>Zbanowany</span>" : "Aktywny");
      html += "<tr><td>" + (u.email || "—") + "</td><td>" + u.display_name + "</td><td>" + new Date(u.created_at).toLocaleDateString("pl-PL") + "</td><td>" + statusLabel + "</td>" +
        "<td>" +
          "<button class='btn-small " + (u.is_banned ? "btn-approve" : "btn-reject") + "' data-action='ban' data-id='" + u.id + "'>" + (u.is_banned ? "Odbanuj" : "Zbanuj") + "</button> " +
          "<button class='btn-small btn-secondary' data-action='admin' data-id='" + u.id + "'>" + (u.is_admin ? "Odbierz admina" : "Nadaj admina") + "</button>" +
        "</td></tr>";
    });
    html += "</tbody></table>";
    el.innerHTML = html;

    el.querySelectorAll("[data-action='ban']").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var u = allUsers.find(function (x) { return x.id === btn.dataset.id; });
        var next = !u.is_banned;
        if (!confirm((next ? "Zbanować" : "Odbanować") + " użytkownika " + (u.email || u.display_name) + "?")) return;
        await supabaseClient.from("profiles").update({ is_banned: next }).eq("id", u.id);
        loadUsers();
      });
    });
    el.querySelectorAll("[data-action='admin']").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var u = allUsers.find(function (x) { return x.id === btn.dataset.id; });
        var next = !u.is_admin;
        if (!confirm((next ? "Nadać" : "Odebrać") + " uprawnienia admina dla " + (u.email || u.display_name) + "?")) return;
        await supabaseClient.from("profiles").update({ is_admin: next }).eq("id", u.id);
        loadUsers();
      });
    });
  }

  document.getElementById("users-search").addEventListener("input", function (e) {
    var q = e.target.value.toLowerCase();
    renderUsersTable(allUsers.filter(function (u) {
      return (u.email || "").toLowerCase().indexOf(q) > -1 || (u.display_name || "").toLowerCase().indexOf(q) > -1;
    }));
  });

  function populateGrantUserSelect(users) {
    var sel = document.getElementById("grant-user-select");
    sel.innerHTML = "<option value=''>Wybierz użytkownika...</option>";
    users.forEach(function (u) {
      var opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = (u.email || u.display_name) + (u.is_admin ? " (admin)" : "");
      sel.appendChild(opt);
    });
  }

  // ---------------- ODZNAKI ----------------
  async function loadBadges() {
    var res = await supabaseClient.from("badges").select("*").order("id");
    var el = document.getElementById("badges-table");
    if (res.error) { el.textContent = "Błąd: " + res.error.message; return; }
    document.getElementById("badges-count").textContent = res.data.length;

    var html = "<table><thead><tr><th></th><th>ID</th><th>Nazwa</th><th>Opis</th><th></th></tr></thead><tbody>";
    res.data.forEach(function (b) {
      html += "<tr><td style='font-size:20px;'>" + b.icon + "</td><td><code>" + b.id + "</code></td><td>" + b.name + "</td><td>" + b.description + "</td>" +
        "<td><button class='btn-small btn-delete' data-id='" + b.id + "'>Usuń</button></td></tr>";
    });
    html += "</tbody></table>";
    el.innerHTML = html;
    el.querySelectorAll(".btn-delete").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("Usunąć tę odznakę? Zniknie też wszystkim, którzy ją mają.")) return;
        await supabaseClient.from("badges").delete().eq("id", btn.dataset.id);
        loadBadges();
      });
    });

    var grantSel = document.getElementById("grant-badge-select");
    grantSel.innerHTML = "<option value=''>Wybierz odznakę...</option>";
    res.data.forEach(function (b) {
      var opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.icon + " " + b.name;
      grantSel.appendChild(opt);
    });
  }

  document.getElementById("add-badge-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    var statusEl = document.getElementById("add-badge-status");
    var res = await supabaseClient.from("badges").insert({
      id: f.id.value.trim().toLowerCase().replace(/\s+/g, "-"),
      icon: f.icon.value.trim(),
      name: f.name.value.trim(),
      description: f.description.value.trim(),
    });
    if (res.error) { statusEl.textContent = "Błąd: " + res.error.message; return; }
    statusEl.textContent = "Dodano odznakę.";
    f.reset();
    loadBadges();
  });

  document.getElementById("grant-badge-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    var statusEl = document.getElementById("grant-badge-status");
    var res = await supabaseClient.from("user_badges").insert({ user_id: f.userId.value, badge_id: f.badgeId.value });
    if (res.error) { statusEl.textContent = "Błąd: " + res.error.message; return; }
    statusEl.textContent = "Nadano odznakę.";
    f.reset();
  });

  // ---------------- KONKURS ----------------
  function getCurrentWeekStart() {
    var d = new Date();
    var day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  }

  async function loadContestTab() {
    var week = getCurrentWeekStart();
    var res = await supabaseClient.from("contest_entries").select("*").eq("status", "active").eq("week_start", week).order("votes_count", { ascending: false });
    var el = document.getElementById("contest-entries-table");
    if (res.error) { el.textContent = "Błąd: " + res.error.message; return; }

    document.getElementById("contest-slots-label").textContent = res.data.length + " / 30";

    if (res.data.length === 0) { el.innerHTML = "<p class='empty-msg'>Brak aktywnych zgłoszeń w tym tygodniu.</p>"; return; }

    var html = "<table><thead><tr><th></th><th>Auto</th><th>Zgłaszający</th><th>Głosy</th><th></th></tr></thead><tbody>";
    res.data.forEach(function (e) {
      var owner = allUsers.find(function (u) { return u.id === e.user_id; });
      html += "<tr><td><img src='" + e.photo_url + "' style='width:50px;height:34px;object-fit:cover;border-radius:6px;'></td>" +
        "<td>" + e.make + " " + e.model + "</td><td>" + (owner ? (owner.email || owner.display_name) : e.user_id) + "</td><td>" + e.votes_count + "</td>" +
        "<td><button class='btn-small btn-delete' data-id='" + e.id + "'>Usuń (zwolnij miejsce)</button></td></tr>";
    });
    html += "</tbody></table>";
    el.innerHTML = html;
    el.querySelectorAll(".btn-delete").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("Usunąć to zgłoszenie i zwolnić miejsce?")) return;
        await supabaseClient.from("contest_entries").delete().eq("id", btn.dataset.id);
        loadContestTab();
      });
    });
  }

  document.getElementById("refresh-contest-btn").addEventListener("click", loadContestTab);

  document.getElementById("resolve-contest-btn").addEventListener("click", async function () {
    if (!confirm("Rozstrzygnąć konkurs teraz? Wyłoni zwycięzcę bieżącego tygodnia i zwolni wszystkie miejsca.")) return;
    var statusEl = document.getElementById("resolve-contest-status");
    statusEl.textContent = "Rozstrzyganie...";
    var res = await supabaseClient.rpc("resolve_weekly_contest");
    if (res.error) { statusEl.textContent = "Błąd: " + res.error.message; return; }
    statusEl.textContent = "Gotowe - konkurs rozstrzygnięty.";
    loadContestTab();
  });

  // ---------------- OPINIE ----------------
  async function loadFeedback() {
    var res = await supabaseClient.from("feedback").select("*").order("created_at", { ascending: false });
    var el = document.getElementById("feedback-list");
    var badge = document.getElementById("badge-feedback");
    if (res.error) { el.textContent = "Błąd: " + res.error.message; return; }

    if (res.data.length === 0) {
      el.innerHTML = "<p class='empty-msg'>Brak opinii na razie.</p>";
      badge.style.display = "none";
      return;
    }
    badge.style.display = "inline-block";
    badge.textContent = res.data.length;

    el.innerHTML = res.data.map(function (f) {
      var author = allUsers.find(function (u) { return u.id === f.user_id; });
      return "<div class='submission-item'><div class='submission-body'>" +
        "<div class='submission-meta'>" + (author ? (author.email || author.display_name) : "Użytkownik usunięty") + " · " + new Date(f.created_at).toLocaleString("pl-PL") + "</div>" +
        "<div style='font-size:13.5px; line-height:1.5;'>" + f.message.replace(/</g, "&lt;") + "</div>" +
        "<div class='submission-actions' style='margin-top:8px;'><button class='btn-small btn-delete' data-id='" + f.id + "'>Usuń</button></div>" +
        "</div></div>";
    }).join("");

    el.querySelectorAll(".btn-delete").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        await supabaseClient.from("feedback").delete().eq("id", btn.dataset.id);
        loadFeedback();
      });
    });
  }

  // ---------------- WYGLĄD ----------------
  async function loadAppearance() {
    var res = await supabaseClient.from("site_settings").select("*");
    var settings = {};
    (res.data || []).forEach(function (s) { settings[s.key] = s.value; });

    document.getElementById("accent-color-input").value = settings.accent_color || "#2F6FED";
    document.getElementById("accent-color-text").value = settings.accent_color || "#2F6FED";
    document.getElementById("tagline-input").value = settings.tagline || "";

    if (settings.logo_dark_url) document.getElementById("logo-dark-preview").src = settings.logo_dark_url;
    if (settings.logo_light_url) document.getElementById("logo-light-preview").src = settings.logo_light_url;

    document.getElementById("banner-enabled-input").checked = settings.banner_enabled === "true";
    document.getElementById("banner-text-input").value = settings.banner_text || "";
  }

  document.getElementById("accent-color-input").addEventListener("input", function (e) {
    document.getElementById("accent-color-text").value = e.target.value;
  });

  document.getElementById("appearance-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var statusEl = document.getElementById("appearance-status");
    statusEl.textContent = "Zapisywanie...";
    var accent = document.getElementById("accent-color-text").value.trim();
    var tagline = document.getElementById("tagline-input").value.trim();

    var res1 = await supabaseClient.from("site_settings").upsert({ key: "accent_color", value: accent }, { onConflict: "key" });
    var res2 = await supabaseClient.from("site_settings").upsert({ key: "tagline", value: tagline }, { onConflict: "key" });

    statusEl.textContent = (res1.error || res2.error) ? "Błąd zapisu." : "Zapisano - widoczne od razu na stronie.";
  });

  document.getElementById("upload-logo-btn").addEventListener("click", async function () {
    var statusEl = document.getElementById("logo-upload-status");
    var darkFile = document.getElementById("logo-dark-file").files[0];
    var lightFile = document.getElementById("logo-light-file").files[0];
    if (!darkFile && !lightFile) { statusEl.textContent = "Wybierz przynajmniej jeden plik."; return; }

    statusEl.textContent = "Wgrywanie...";
    try {
      if (darkFile) {
        var pathD = "logo-dark-" + Date.now() + "-" + darkFile.name.replace(/\s+/g, "_");
        var upD = await supabaseClient.storage.from("site-assets").upload(pathD, darkFile);
        if (upD.error) throw new Error(upD.error.message);
        var urlD = supabaseClient.storage.from("site-assets").getPublicUrl(pathD).data.publicUrl;
        await supabaseClient.from("site_settings").upsert({ key: "logo_dark_url", value: urlD }, { onConflict: "key" });
        document.getElementById("logo-dark-preview").src = urlD;
      }
      if (lightFile) {
        var pathL = "logo-light-" + Date.now() + "-" + lightFile.name.replace(/\s+/g, "_");
        var upL = await supabaseClient.storage.from("site-assets").upload(pathL, lightFile);
        if (upL.error) throw new Error(upL.error.message);
        var urlL = supabaseClient.storage.from("site-assets").getPublicUrl(pathL).data.publicUrl;
        await supabaseClient.from("site_settings").upsert({ key: "logo_light_url", value: urlL }, { onConflict: "key" });
        document.getElementById("logo-light-preview").src = urlL;
      }
      statusEl.textContent = "Gotowe - nowe logo widoczne od razu na stronie.";
    } catch (err) {
      statusEl.textContent = "Błąd: " + err.message;
    }
  });

  document.getElementById("banner-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var statusEl = document.getElementById("banner-status");
    statusEl.textContent = "Zapisywanie...";
    var enabled = document.getElementById("banner-enabled-input").checked ? "true" : "false";
    var text = document.getElementById("banner-text-input").value.trim();

    var res1 = await supabaseClient.from("site_settings").upsert({ key: "banner_enabled", value: enabled }, { onConflict: "key" });
    var res2 = await supabaseClient.from("site_settings").upsert({ key: "banner_text", value: text }, { onConflict: "key" });

    statusEl.textContent = (res1.error || res2.error) ? "Błąd zapisu." : "Zapisano.";
  });

  // ---------------- DASHBOARD ----------------
  function switchToTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === tabName); });
    document.querySelectorAll(".tab-panel").forEach(function (p) { p.style.display = "none"; });
    document.getElementById("tab-" + tabName).style.display = "block";
  }

  async function loadDashboard() {
    var statsEl = document.getElementById("dashboard-stats");
    var attentionEl = document.getElementById("dashboard-attention");
    var activityEl = document.getElementById("dashboard-activity");

    var [carsRes, usersRes, carSubsRes, photoSubsRes, feedbackRes, contestRes, swipesTodayRes] = await Promise.all([
      supabaseClient.from("cars").select("id", { count: "exact", head: true }),
      supabaseClient.from("profiles").select("id", { count: "exact", head: true }),
      supabaseClient.from("car_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseClient.from("photo_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseClient.from("feedback").select("id", { count: "exact", head: true }),
      supabaseClient.from("contest_entries").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabaseClient.from("swipes").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    var stats = [
      { label: "Aut w katalogu", value: carsRes.count || 0, tab: "cars" },
      { label: "Użytkowników", value: usersRes.count || 0, tab: "users" },
      { label: "Zgłoszeń aut do przejrzenia", value: carSubsRes.count || 0, tab: "car-submissions", warn: (carSubsRes.count || 0) > 0 },
      { label: "Zgłoszonych zdjęć do przejrzenia", value: photoSubsRes.count || 0, tab: "photo-submissions", warn: (photoSubsRes.count || 0) > 0 },
      { label: "Nieprzeczytanych opinii", value: feedbackRes.count || 0, tab: "feedback", warn: (feedbackRes.count || 0) > 0 },
      { label: "Aktywnych zgłoszeń konkursowych", value: contestRes.count || 0, tab: "contest" },
      { label: "Swipe'ów w ostatnich 24h", value: swipesTodayRes.count || 0, tab: "dashboard" },
    ];

    statsEl.innerHTML = stats.map(function (s) {
      return "<div class='stat-card" + (s.warn ? " warn" : "") + "' data-tab='" + s.tab + "'>" +
        "<div class='stat-value'>" + s.value + "</div><div class='stat-label'>" + s.label + "</div></div>";
    }).join("");
    statsEl.querySelectorAll(".stat-card").forEach(function (el) {
      el.addEventListener("click", function () { switchToTab(el.dataset.tab); });
    });

    var attentionItems = [];
    if ((carSubsRes.count || 0) > 0) attentionItems.push({ text: (carSubsRes.count) + " nowych propozycji aut czeka na decyzję", tab: "car-submissions" });
    if ((photoSubsRes.count || 0) > 0) attentionItems.push({ text: (photoSubsRes.count) + " zdjęć czeka na zatwierdzenie", tab: "photo-submissions" });
    if ((feedbackRes.count || 0) > 0) attentionItems.push({ text: (feedbackRes.count) + " nieprzeczytanych opinii od userów", tab: "feedback" });

    attentionEl.innerHTML = attentionItems.length === 0
      ? "<p class='empty-msg'>Wszystko przejrzane - świetna robota.</p>"
      : attentionItems.map(function (a) {
          return "<div class='attention-item'><span>" + a.text + "</span><a href='javascript:void(0)' data-tab='" + a.tab + "'>Otwórz →</a></div>";
        }).join("");
    attentionEl.querySelectorAll("[data-tab]").forEach(function (el) {
      el.addEventListener("click", function () { switchToTab(el.dataset.tab); });
    });

    var recentRes = await supabaseClient.from("cars").select("make,model,created_at").order("created_at", { ascending: false }).limit(5);
    activityEl.innerHTML = (recentRes.data && recentRes.data.length > 0)
      ? recentRes.data.map(function (c) {
          return "<div class='attention-item'><span>" + c.make + " " + c.model + " dodane do katalogu</span><span class='muted' style='font-size:11.5px;'>" + new Date(c.created_at).toLocaleDateString("pl-PL") + "</span></div>";
        }).join("")
      : "<p class='empty-msg'>Brak aktywności.</p>";
  }

  checkSession();

  } catch (err) {
    showFatalError("Błąd inicjalizacji panelu: " + err.message + "<br><br>To najpewniej znaczy, że wersje plików admin.js i cm-console-7f2k.html się nie zgadzają (np. stara i nowa paczka pomieszane). Pobierz świeżą paczkę i podmień WSZYSTKIE pliki naraz.");
  }
})();
