(function () {
  "use strict";

  var cleanUrl = SUPABASE_URL.trim().replace(/\/+$/, "");
  var supabaseClient = window.__supabaseClient || window.supabase.createClient(cleanUrl, SUPABASE_ANON_KEY.trim());
  if (!window.__supabaseClient) window.__supabaseClient = supabaseClient;

  // Standardowy, zalecany przez dokumentacje Supabase sposob na wykrycie
  // stanu logowania: nasluchujemy onAuthStateChange zamiast recznie odpytywac
  // getSession() i zgadywac, czy to powrot z logowania Google. Ta subskrypcja
  // sama "odpali sie" raz na starcie (z aktualnym stanem sesji) i ponownie za
  // kazdym razem gdy stan sie zmieni (np. zaraz po powrocie z Google) - wiec
  // nie trzeba nic recznie odczekiwac.
  supabaseClient.auth.onAuthStateChange(function (event, session) {
    if (session) window.location.replace("index.html");
  });

  var T = window.CM_T;
  var theme = window.CM_APPEARANCE ? window.CM_APPEARANCE.resolvedTheme() : "dark";
  document.getElementById("auth-logo").src = theme === "dark" ? "logo-dark.png" : "logo-light.png";

  var loginForm = document.getElementById("login-form");
  var registerForm = document.getElementById("register-form");
  var statusEl = document.getElementById("auth-status");

  document.querySelectorAll(".auth-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".auth-tab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      statusEl.textContent = "";
      if (tab.dataset.tab === "login") {
        loginForm.style.display = "flex"; registerForm.style.display = "none";
      } else {
        loginForm.style.display = "none"; registerForm.style.display = "flex";
      }
    });
  });

  document.getElementById("google-btn").addEventListener("click", async function () {
    statusEl.textContent = T("auth.redirecting_google");
    var res = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname.replace(/[^/]*$/, "") + "index.html" },
    });
    if (res.error) statusEl.textContent = T("common.error_prefix") + res.error.message;
  });

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    statusEl.textContent = T("auth.logging_in");
    var f = e.target;
    var res = await supabaseClient.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    if (res.error) { statusEl.textContent = T("common.error_prefix") + res.error.message; return; }
    window.location.href = "index.html";
  });

  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    statusEl.textContent = T("auth.creating_account");
    var f = e.target;
    var res = await supabaseClient.auth.signUp({
      email: f.email.value.trim(),
      password: f.password.value,
      options: { data: { display_name: f.displayName.value.trim() } },
    });
    if (res.error) { statusEl.textContent = T("common.error_prefix") + res.error.message; return; }

    // Nazwa z formularza trafia do profilu (trigger tworzy profil z emaila, tu go doprecyzowujemy)
    if (res.data.user) {
      await supabaseClient.from("profiles").update({ display_name: f.displayName.value.trim() }).eq("id", res.data.user.id);
    }

    if (res.data.session) {
      window.location.href = "index.html";
    } else {
      statusEl.textContent = T("auth.register_success");
    }
  });
})();
