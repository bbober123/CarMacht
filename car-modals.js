(function () {
  "use strict";

  var T = window.CM_T;
  function POWERTRAIN_LABEL_LIVE() {
    return { electric: T("powertrain.electric"), hybrid: T("powertrain.hybrid"), combustion: T("powertrain.combustion") };
  }
  var POWERTRAIN_LABEL = POWERTRAIN_LABEL_LIVE();

  // Wstrzykujemy markup modali raz, przy pierwszym zaladowaniu strony
  var wrap = document.createElement("div");
  function modalsMarkup() {
    return '<div id="detail-modal" class="modal-overlay" style="display:none;">' +
      '<div class="modal-box">' +
        '<div class="modal-header"><h2 id="detail-title"></h2><button class="modal-close" data-close="detail-modal">✕</button></div>' +
        '<div id="detail-body"></div>' +
        '<button id="detail-chat-btn" class="btn-primary full-width" style="margin-top:14px;">' + T("carmodal.ask_ai_btn") + '</button>' +
      '</div>' +
    '</div>' +
    '<div id="chat-modal" class="modal-overlay" style="display:none;">' +
      '<div class="modal-box chat-box">' +
        '<div class="modal-header"><h2 id="chat-title"></h2><button class="modal-close" data-close="chat-modal">✕</button></div>' +
        '<div id="chat-messages"></div>' +
        '<form id="chat-form">' +
          '<input id="chat-input" placeholder="' + T("chat.placeholder") + '" autocomplete="off" maxlength="500">' +
          '<button type="submit" id="chat-send-btn">➤</button>' +
        '</form>' +
        '<button id="chat-clear-btn" class="btn-secondary full-width" style="margin-top:10px;">' + T("chat.clear") + '</button>' +
        '<p id="chat-login-notice" class="status-text" style="display:none;">' + T("chat.login_notice") + '</p>' +
      '</div>' +
    '</div>';
  }
  wrap.innerHTML = modalsMarkup();
  document.body.appendChild(wrap);

  var detailModal = document.getElementById("detail-modal");
  var chatModal = document.getElementById("chat-modal");
  var currentCar = null;
  var sbClient = null;

  document.querySelectorAll(".modal-close").forEach(function (btn) {
    btn.addEventListener("click", function () { document.getElementById(btn.dataset.close).style.display = "none"; });
  });
  document.body.addEventListener("click", function (e) {
    if (e.target.classList && e.target.classList.contains("modal-overlay")) e.target.style.display = "none";
  });

  function openDetail(car) {
    POWERTRAIN_LABEL = POWERTRAIN_LABEL_LIVE();
    currentCar = car;
    document.getElementById("detail-title").textContent = car.make + " " + car.model + " (" + car.year + ")";
    document.getElementById("detail-body").innerHTML =
      "<p style='color:var(--muted); font-size:13.5px; line-height:1.6; margin:0 0 14px;'>" +
      (car.description && car.description.trim() ? car.description : T("carmodal.no_description")) +
      "</p>" +
      "<div class='spec-grid'>" +
      "<div class='spec-box'><div class='spec-label'>" + T("carmodal.powertrain_label") + "</div><div class='spec-value' style='font-size:12px;'>" + (POWERTRAIN_LABEL[car.powertrain] || car.powertrain) + "</div></div>" +
      "<div class='spec-box'><div class='spec-label'>" + T("carmodal.accel_label") + "</div><div class='spec-value'>" + car.accel0to100 + "s</div></div>" +
      "<div class='spec-box'><div class='spec-label'>" + T("carmodal.power_label") + "</div><div class='spec-value'>" + car.powerKw + "kW</div></div>" +
      "</div>";
    detailModal.style.display = "flex";
  }

  document.getElementById("detail-chat-btn").addEventListener("click", function () {
    detailModal.style.display = "none";
    openChat(currentCar);
  });

  async function loadMessages() {
    var messagesEl = document.getElementById("chat-messages");
    messagesEl.innerHTML = "<p class='empty-msg' style='padding:10px 0;'>" + T("chat.loading") + "</p>";
    var sessionRes = await sbClient.auth.getSession();
    if (!sessionRes.data.session) {
      document.getElementById("chat-login-notice").style.display = "block";
      document.getElementById("chat-form").style.display = "none";
      document.getElementById("chat-clear-btn").style.display = "none";
      messagesEl.innerHTML = "";
      return;
    }
    document.getElementById("chat-login-notice").style.display = "none";
    document.getElementById("chat-form").style.display = "flex";
    document.getElementById("chat-clear-btn").style.display = "block";

    var userId = sessionRes.data.session.user.id;
    var res = await sbClient.from("car_conversations").select("role,content").eq("car_id", currentCar.id).eq("user_id", userId).order("created_at", { ascending: true });
    renderMessages(res.data || []);
  }

  function renderMessages(messages) {
    var el = document.getElementById("chat-messages");
    if (messages.length === 0) {
      el.innerHTML = "<p class='empty-msg' style='padding:10px 0;'>" + T("chat.ask_anything") + "</p>";
      return;
    }
    el.innerHTML = messages.map(function (m) {
      return "<div class='chat-bubble " + (m.role === "user" ? "chat-user" : "chat-ai") + "'>" + escapeHtml(m.content) + "</div>";
    }).join("");
    el.scrollTop = el.scrollHeight;
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function openChat(car) {
    currentCar = car;
    document.getElementById("chat-title").textContent = "💬 " + car.make + " " + car.model;
    chatModal.style.display = "flex";
    loadMessages();
  }

  document.getElementById("chat-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var input = document.getElementById("chat-input");
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    var sendBtn = document.getElementById("chat-send-btn");
    sendBtn.disabled = true;

    var messagesEl = document.getElementById("chat-messages");
    var existing = messagesEl.querySelector(".empty-msg");
    if (existing) messagesEl.innerHTML = "";
    messagesEl.innerHTML += "<div class='chat-bubble chat-user'>" + escapeHtml(text) + "</div>";
    messagesEl.innerHTML += "<div class='chat-bubble chat-ai chat-loading' id='chat-loading'>...</div>";
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      var res = await sbClient.functions.invoke("chat-with-car", {
        body: { carId: currentCar.id, message: text },
      });
      document.getElementById("chat-loading").remove();
      if (res.error) {
        messagesEl.innerHTML += "<div class='chat-bubble chat-ai' style='color:var(--nope,#D6543F);'>" + T("common.error_prefix") + escapeHtml(res.error.message || String(res.error)) + "</div>";
      } else if (res.data && res.data.error) {
        messagesEl.innerHTML += "<div class='chat-bubble chat-ai' style='color:var(--nope,#D6543F);'>" + T("common.error_prefix") + escapeHtml(res.data.error) + "</div>";
      } else {
        messagesEl.innerHTML += "<div class='chat-bubble chat-ai'>" + escapeHtml(res.data.reply) + "</div>";
      }
    } catch (err) {
      var loadingEl = document.getElementById("chat-loading");
      if (loadingEl) loadingEl.remove();
      messagesEl.innerHTML += "<div class='chat-bubble chat-ai' style='color:var(--nope,#D6543F);'>" + T("chat.connect_error") + "</div>";
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
    sendBtn.disabled = false;
  });

  document.getElementById("chat-clear-btn").addEventListener("click", async function () {
    if (!confirm(T("chat.clear_confirm"))) return;
    var sessionRes = await sbClient.auth.getSession();
    if (!sessionRes.data.session) return;
    await sbClient.from("car_conversations").delete().eq("car_id", currentCar.id).eq("user_id", sessionRes.data.session.user.id);
    renderMessages([]);
  });

  window.addEventListener("veloce:langchange", function () {
    // Update text in place - never touch innerHTML here, it would wipe the
    // event listeners bound to these elements above.
    POWERTRAIN_LABEL = POWERTRAIN_LABEL_LIVE();
    document.getElementById("detail-chat-btn").textContent = T("carmodal.ask_ai_btn");
    document.getElementById("chat-input").setAttribute("placeholder", T("chat.placeholder"));
    document.getElementById("chat-clear-btn").textContent = T("chat.clear");
    document.getElementById("chat-login-notice").textContent = T("chat.login_notice");
    if (currentCar && detailModal.style.display !== "none") openDetail(currentCar);
  });

  window.CarModals = {
    init: function (supabaseClientInstance) { sbClient = supabaseClientInstance; },
    openDetail: openDetail,
    openChat: openChat,
  };
})();
