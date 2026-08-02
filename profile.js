(function () {
  "use strict";

  var cleanUrl = SUPABASE_URL.trim().replace(/\/+$/, "");
  var supabaseClient = window.__supabaseClient || window.supabase.createClient(cleanUrl, SUPABASE_ANON_KEY.trim());
  if (!window.__supabaseClient) window.__supabaseClient = supabaseClient;

  var T = window.CM_T;
  var theme = window.CM_APPEARANCE ? window.CM_APPEARANCE.resolvedTheme() : "dark";

  var user = null;

  document.getElementById("feedback-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var statusEl = document.getElementById("feedback-status");
    var input = document.getElementById("feedback-input");
    var msg = input.value.trim();
    if (!msg) { statusEl.textContent = T("profile.feedback_empty_error"); return; }
    statusEl.textContent = T("common.sending");
    var res = await supabaseClient.from("feedback").insert({ user_id: user.id, message: msg });
    statusEl.textContent = res.error ? T("common.error_prefix") + res.error.message : T("profile.feedback_success");
    if (!res.error) input.value = "";
  });

  document.getElementById("clear-all-chats-btn").addEventListener("click", async function () {
    if (!confirm(T("profile.clear_confirm"))) return;
    var statusEl = document.getElementById("clear-chats-status");
    statusEl.textContent = T("common.loading");
    var res = await supabaseClient.from("car_conversations").delete().eq("user_id", user.id);
    statusEl.textContent = res.error ? T("common.error_prefix") + res.error.message : T("profile.clear_success");
  });

  document.getElementById("logout-btn").addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });

  async function loadBadges() {
    var allRes = await supabaseClient.from("badges").select("*");
    var mineRes = await supabaseClient.from("user_badges").select("badge_id").eq("user_id", user.id);
    var mineIds = (mineRes.data || []).map(function (b) { return b.badge_id; });
    var grid = document.getElementById("badge-grid");
    grid.innerHTML = "";
    (allRes.data || []).forEach(function (b) {
      var owned = mineIds.indexOf(b.id) > -1;
      var el = document.createElement("div"); // badge name/description come from admin-managed DB content (not UI chrome)
      el.className = "badge-item" + (owned ? "" : " locked");
      el.title = b.description;
      el.innerHTML = "<span class='badge-icon'>" + b.icon + "</span><span class='badge-name'>" + b.name + "</span>";
      grid.appendChild(el);
    });
  }

  async function loadMyEntries() {
    var res = await supabaseClient.from("contest_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    var el = document.getElementById("my-entries");
    if (!res.data || res.data.length === 0) {
      el.innerHTML = "<p class='empty-msg'>" + T("profile.no_entries_yet") + "<a href='contest.html'>" + T("profile.no_entries_link") + "</a></p>";
      return;
    }
    el.innerHTML = res.data.map(function (e) {
      var statusLabel = e.status === "won" ? T("profile.entry_won") : e.status === "archived" ? T("profile.entry_archived") : T("profile.entry_active");
      return "<div style='padding:10px 0; border-bottom:1px solid var(--border);'>" +
        "<strong>" + e.make + " " + e.model + "</strong> - " + statusLabel + " · " + e.votes_count + T("contest.votes_suffix") + "</div>";
    }).join("");
  }

  document.getElementById("settings-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var statusEl = document.getElementById("settings-status");
    statusEl.textContent = T("common.saving");
    var newName = document.getElementById("display-name-input").value.trim();
    var file = document.getElementById("avatar-input").files[0];

    var updates = {};
    if (newName) updates.display_name = newName;

    if (file) {
      var path = user.id + "/" + Date.now() + "-" + file.name.replace(/\s+/g, "_");
      var uploadRes = await supabaseClient.storage.from("avatars").upload(path, file);
      if (uploadRes.error) { statusEl.textContent = T("profile.avatar_upload_error") + uploadRes.error.message; return; }
      updates.avatar_url = supabaseClient.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }

    if (Object.keys(updates).length === 0) { statusEl.textContent = T("profile.nothing_to_save"); return; }

    var res = await supabaseClient.from("profiles").update(updates).eq("id", user.id);
    if (res.error) { statusEl.textContent = T("common.error_prefix") + res.error.message; return; }
    statusEl.textContent = T("profile.saved_success");
    loadProfile();
  });

  async function loadProfile() {
    var res = await supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
    var p = res.data || {};
    document.getElementById("display-name-view").textContent = p.display_name || T("profile.driver_default");
    document.getElementById("display-name-input").placeholder = p.display_name || T("profile.display_name_ph");
    document.getElementById("avatar-img").src = p.avatar_url || "logo-" + theme + ".png";
    document.getElementById("member-since").textContent = p.created_at
      ? T("profile.member_since") + new Date(p.created_at).toLocaleDateString(window.CM_I18N ? window.CM_I18N.getLang() : "en")
      : "";

    var streakRes = await supabaseClient.rpc("get_current_streak", { target_user: user.id });
    var streak = streakRes.data || 0;
    var banner = document.getElementById("streak-banner");
    if (streak >= 1) {
      banner.style.display = "flex";
      document.getElementById("streak-text").textContent =
        streak === 1 ? T("profile.streak_today") : streak + T("profile.streak_days_suffix");
      document.getElementById("streak-emoji").textContent = streak >= 30 ? "🔥🔥🔥" : streak >= 7 ? "🔥🔥" : "🔥";
    } else {
      banner.style.display = "none";
    }
  }

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
    var beforeRes = await supabaseClient.from("user_badges").select("badge_id").eq("user_id", user.id);
    var beforeIds = (beforeRes.data || []).map(function (r) { return r.badge_id; });
    await supabaseClient.rpc("check_and_award_badges");
    var afterRes = await supabaseClient.from("user_badges").select("badge_id, badges(name, icon)").eq("user_id", user.id);
    (afterRes.data || []).forEach(function (row) {
      if (beforeIds.indexOf(row.badge_id) === -1 && row.badges) showBadgeToast(row.badges.icon, row.badges.name);
    });
  }

  async function init() {
    var sessionRes = await supabaseClient.auth.getSession();
    if (!sessionRes.data.session) {
      window.location.href = "auth.html";
      return;
    }
    user = sessionRes.data.session.user;
    document.getElementById("signed-in-view").style.display = "block";

    await checkBadgesAndNotify();
    await loadProfile();
    await loadBadges();
    await loadMyEntries();
  }

  window.addEventListener("veloce:langchange", function () {
    if (user) { loadProfile(); loadMyEntries(); }
  });

  init();
})();
