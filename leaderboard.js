(function () {
  "use strict";

  var cleanUrl = SUPABASE_URL.trim().replace(/\/+$/, "");
  var supabaseClient = window.__supabaseClient || window.supabase.createClient(cleanUrl, SUPABASE_ANON_KEY.trim());
  if (!window.__supabaseClient) window.__supabaseClient = supabaseClient;

  var T = window.CM_T;

  var MEDALS = ["🥇", "🥈", "🥉"];

  function rowHtml(row, rank, isMe) {
    var medal = rank <= 3 ? MEDALS[rank - 1] : "#" + rank;
    var avatar = row.avatar_url
      ? "<img src='" + row.avatar_url + "' style='width:38px;height:38px;border-radius:50%;object-fit:cover;'>"
      : "<div style='width:38px;height:38px;border-radius:50%;background:var(--surface-alt);display:flex;align-items:center;justify-content:center;font-size:15px;'>👤</div>";
    return "<div style='display:flex; align-items:center; gap:14px; padding:12px 16px; border-radius:12px;" +
      (isMe ? " background:var(--accent); color:#fff;" : " background:var(--surface); border:1px solid var(--border);") + " margin-bottom:8px;'>" +
      "<div style='font-family:JetBrains Mono,monospace; font-weight:700; width:32px; text-align:center; font-size:" + (rank <= 3 ? "20px" : "14px") + ";'>" + medal + "</div>" +
      avatar +
      "<div style='flex:1; min-width:0;'>" +
      "<div style='font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;'>" + (row.display_name || T("leaderboard.driver_default")) + "</div>" +
      "<div style='font-size:11px;" + (isMe ? " color:rgba(255,255,255,0.8);" : " color:var(--muted);") + "'>" +
      row.liked_count + T("leaderboard.stats", { badges: row.badge_count, wins: row.contest_wins }) +
      "</div></div>" +
      "<div style='font-family:JetBrains Mono,monospace; font-weight:700; font-size:16px;'>" + row.score + "</div>" +
      "</div>";
  }

  async function load() {
    var sessionRes = await supabaseClient.auth.getSession();
    var myId = sessionRes.data.session ? sessionRes.data.session.user.id : null;

    var res = await supabaseClient.from("leaderboard").select("*").limit(50);
    var listEl = document.getElementById("leaderboard-list");

    if (res.error || !res.data || res.data.length === 0) {
      listEl.innerHTML = "<p class='empty-msg'>" + T("leaderboard.empty") + "</p>";
      return;
    }

    listEl.innerHTML = res.data.map(function (row, i) { return rowHtml(row, i + 1, row.user_id === myId); }).join("");

    if (myId) {
      var myIndex = res.data.findIndex(function (r) { return r.user_id === myId; });
      if (myIndex === -1) {
        var mineRes = await supabaseClient.from("leaderboard").select("*").eq("user_id", myId).maybeSingle();
        if (mineRes.data) {
          var card = document.getElementById("my-rank-card");
          card.style.display = "block";
          card.innerHTML = "<p class='muted' style='margin-bottom:8px;'>" + T("leaderboard.your_rank") + "</p>" + rowHtml(mineRes.data, "?", true);
        }
      }
    }
  }

  window.addEventListener("veloce:langchange", load);

  load();
})();
