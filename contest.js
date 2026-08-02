(function () {
  "use strict";

  var cleanUrl = SUPABASE_URL.trim().replace(/\/+$/, "");
  var supabaseClient = window.__supabaseClient || window.supabase.createClient(cleanUrl, SUPABASE_ANON_KEY.trim());
  if (!window.__supabaseClient) window.__supabaseClient = supabaseClient;

  var T = window.CM_T;

  var user = null;
  var myVoteEntryId = null;
  var currentWeek = getCurrentWeekStart();

  function getCurrentWeekStart() {
    var d = new Date();
    var day = (d.getUTCDay() + 6) % 7; // poniedzialek = 0
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
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
    if (!user) { supabaseClient.rpc("check_and_award_badges"); return; }
    var beforeRes = await supabaseClient.from("user_badges").select("badge_id").eq("user_id", user.id);
    var beforeIds = (beforeRes.data || []).map(function (r) { return r.badge_id; });
    await supabaseClient.rpc("check_and_award_badges");
    var afterRes = await supabaseClient.from("user_badges").select("badge_id, badges(name, icon)").eq("user_id", user.id);
    (afterRes.data || []).forEach(function (row) {
      if (beforeIds.indexOf(row.badge_id) === -1 && row.badges) showBadgeToast(row.badges.icon, row.badges.name);
    });
  }

  var addEntryBtn = document.getElementById("add-entry-btn");
  var entryModal = document.getElementById("entry-modal");
  var entryForm = document.getElementById("entry-form");

  document.querySelectorAll(".modal-close").forEach(function (btn) {
    btn.addEventListener("click", function () { document.getElementById(btn.dataset.close).style.display = "none"; });
  });
  document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.style.display = "none"; });
  });

  addEntryBtn.addEventListener("click", function () {
    if (!user) { window.location.href = "auth.html"; return; }
    entryModal.style.display = "flex";
  });

  entryForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    var statusEl = f.querySelector(".modal-status");
    statusEl.textContent = T("common.sending");

    try {
      var file = f.file.files[0];
      var path = user.id + "/" + Date.now() + "-" + file.name.replace(/\s+/g, "_");
      var uploadRes = await supabaseClient.storage.from("contest-photos").upload(path, file);
      if (uploadRes.error) throw new Error(uploadRes.error.message);
      var photoUrl = supabaseClient.storage.from("contest-photos").getPublicUrl(path).data.publicUrl;

      var res = await supabaseClient.from("contest_entries").insert({
        user_id: user.id,
        make: f.make.value.trim(),
        model: f.model.value.trim(),
        year: f.year.value ? Number(f.year.value) : null,
        description: f.description.value.trim(),
        photo_url: photoUrl,
        week_start: currentWeek,
      });

      if (res.error) {
        if (res.error.message.indexOf("CONTEST_FULL") > -1) throw new Error(T("contest.full_error"));
        if (res.error.message.indexOf("ALREADY_ENTERED") > -1) throw new Error(T("contest.already_entered_error"));
        throw new Error(res.error.message);
      }

      statusEl.textContent = T("contest.entry_success");
      await checkBadgesAndNotify();
      setTimeout(function () { entryModal.style.display = "none"; f.reset(); statusEl.textContent = ""; loadEntries(); }, 1200);
    } catch (err) {
      statusEl.textContent = T("common.error_prefix") + err.message;
    }
  });

  async function loadSlots() {
    var res = await supabaseClient.from("contest_entries").select("id", { count: "exact", head: true })
      .eq("status", "active").eq("week_start", currentWeek);
    var count = res.count || 0;
    document.getElementById("slots-fill").style.width = Math.min((count / 30) * 100, 100) + "%";
    document.getElementById("slots-label").textContent = count + " / 30";
    document.getElementById("full-notice").style.display = count >= 30 ? "block" : "none";
    addEntryBtn.disabled = count >= 30;
  }

  function entryCardHtml(e, isWinner) {
    var votedClass = myVoteEntryId === e.id ? " voted" : "";
    var voteLabel = myVoteEntryId === e.id ? T("contest.voted_btn") : T("contest.vote_btn");
    return "<div class='contest-card" + (isWinner ? " winner" : "") + "'>" +
      "<div class='contest-photo'><img src='" + e.photo_url + "' loading='lazy'></div>" +
      "<div class='contest-body'>" +
      (isWinner ? "<div class='winner-tag'>" + T("contest.winner_tag") + "</div>" : "") +
      "<div class='contest-title'>" + e.make + " " + e.model + (e.year ? " (" + e.year + ")" : "") + "</div>" +
      "<div class='contest-sub'>" + (e.description || "") + "</div>" +
      "<div class='contest-footer'>" +
      (isWinner ? "<span class='vote-count'>" + e.votes_count + T("contest.votes_suffix") + "</span>" : "<button class='vote-btn" + votedClass + "' data-id='" + e.id + "'>" + voteLabel + "</button><span class='vote-count'>" + e.votes_count + T("contest.votes_suffix") + "</span>") +
      "</div></div></div>";
  }

  async function loadEntries() {
    if (user) {
      var voteRes = await supabaseClient.from("contest_votes").select("entry_id").eq("user_id", user.id).eq("week_start", currentWeek).maybeSingle();
      myVoteEntryId = voteRes.data ? voteRes.data.entry_id : null;
    }

    var res = await supabaseClient.from("contest_entries").select("*")
      .eq("status", "active").eq("week_start", currentWeek).order("votes_count", { ascending: false });
    var grid = document.getElementById("entries-grid");

    if (!res.data || res.data.length === 0) {
      grid.innerHTML = "<p class='empty-msg'>" + T("contest.no_entries_yet") + "</p>";
    } else {
      grid.innerHTML = res.data.map(function (e) { return entryCardHtml(e, false); }).join("");
      grid.querySelectorAll(".vote-btn").forEach(function (btn) {
        btn.addEventListener("click", async function () {
          if (!user) { window.location.href = "auth.html"; return; }
          var entryId = Number(btn.dataset.id);
          if (myVoteEntryId === entryId) return;

          if (myVoteEntryId) {
            await supabaseClient.from("contest_votes").delete().eq("user_id", user.id).eq("week_start", currentWeek);
          }
          var res2 = await supabaseClient.from("contest_votes").insert({ entry_id: entryId, user_id: user.id, week_start: currentWeek });
          if (res2.error) { alert(T("contest.vote_error") + res2.error.message); return; }
          await checkBadgesAndNotify();
          loadEntries();
        });
      });
    }
    loadSlots();
  }

  async function loadWinners() {
    var res = await supabaseClient.from("contest_entries").select("*").eq("status", "won").order("week_start", { ascending: false }).limit(6);
    var grid = document.getElementById("winners-grid");
    if (!res.data || res.data.length === 0) {
      grid.innerHTML = "<p class='empty-msg'>" + T("contest.no_winners_yet") + "</p>";
      return;
    }
    grid.innerHTML = res.data.map(function (e) { return entryCardHtml(e, true); }).join("");
  }

  async function init() {
    var sessionRes = await supabaseClient.auth.getSession();
    if (!sessionRes.data.session) {
      window.location.href = "auth.html";
      return;
    }
    user = sessionRes.data.session.user;
    var profileRes = await supabaseClient.from("profiles").select("is_banned").eq("id", user.id).maybeSingle();
    if (profileRes.data && profileRes.data.is_banned) {
      addEntryBtn.disabled = true;
      addEntryBtn.title = T("contest.banned_title");
      var banNotice = document.createElement("p");
      banNotice.className = "empty-msg";
      banNotice.style.cssText = "color:#D6543F; text-align:left; padding:0; margin-top:10px;";
      banNotice.textContent = T("contest.banned_notice");
      document.querySelector(".page-header").after(banNotice);
      user = null; // blokuje tez glosowanie ponizej (traktowane jak niezalogowany)
    }
    await loadWinners();
    await loadEntries();
  }

  window.addEventListener("veloce:langchange", function () { loadWinners(); loadEntries(); });

  init();
})();
