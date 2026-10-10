// Studio — "links for talents" card shown on the leader / head leader / QA dashboards.
// Gives them ready-to-send links (copy + WhatsApp) for the talent sign-up page and
// the available-tasks page. For a leader, the links carry the leader code, so the
// talent skips the "pick a leader code" step.
(function () {
  "use strict";

  function abs(path) { return new URL(path, location.href).href; }

  function el(tag, props, style) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { n[k] = props[k]; });
    if (style) n.style.cssText = style;
    return n;
  }

  function copyText(input, btn) {
    function flash(text) {
      btn.textContent = text;
      setTimeout(function () { btn.textContent = "نسخ"; }, 1600);
    }
    function fallback() {
      try {
        input.focus(); input.select(); input.setSelectionRange(0, 9999);
        flash(document.execCommand("copy") ? "اتنسخ ✓" : "انسخه يدويًا");
      } catch (e) { flash("انسخه يدويًا"); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.value).then(function () { flash("اتنسخ ✓"); }, fallback);
    } else { fallback(); }
  }

  function row(item) {
    var wrap = el("div", null, "margin-top:14px;");
    wrap.appendChild(el("div", { textContent: item.label }, "font-size:0.85rem; color:var(--studio-text-muted); margin-bottom:6px;"));

    var line = el("div", null, "display:flex; gap:8px; flex-wrap:wrap; align-items:stretch;");
    var input = el("input", { type: "text", readOnly: true, value: item.url },
      "flex:1; min-width:180px; background:var(--studio-surface-2); border:1px solid var(--studio-border); color:var(--studio-text); " +
      "border-radius:10px; padding:10px 12px; font-family:var(--studio-mono); font-size:0.8rem; direction:ltr; text-align:left;");
    input.setAttribute("data-no-i18n", "");
    input.addEventListener("focus", function () { input.select(); });

    var copyBtn = el("button", { type: "button", className: "studio-btn studio-btn-secondary", textContent: "نسخ" }, "padding:10px 18px;");
    copyBtn.addEventListener("click", function () { copyText(input, copyBtn); });

    var waBtn = el("button", { type: "button", className: "studio-btn studio-btn-secondary", textContent: "واتساب" }, "padding:10px 18px;");
    waBtn.addEventListener("click", function () {
      window.open("https://wa.me/?text=" + encodeURIComponent(item.msg + "\n" + item.url), "_blank", "noopener");
    });

    line.appendChild(input); line.appendChild(copyBtn); line.appendChild(waBtn);
    wrap.appendChild(line);
    return wrap;
  }

  // mount("element-id", { leaderCode: "L001" })   (leaderCode is optional)
  function mount(target, opts) {
    var host = typeof target === "string" ? document.getElementById(target) : target;
    if (!host) return;
    var code = opts && opts.leaderCode ? String(opts.leaderCode).trim() : "";

    var tasksPath = "tasks.html" + (code ? "?leader=" + encodeURIComponent(code) : "");
    // After signing up, a talent coming from a leader's link lands on tasks with that leader's code.
    var signupPath = "talent-login.html?mode=signup" + (code ? "&return=" + encodeURIComponent(tasksPath) : "");

    var card = el("div", { className: "studio-card" }, "margin-bottom:18px;");
    card.appendChild(el("h3", { textContent: "🔗 روابط للمتسجّلين" }, "margin-top:0;"));
    card.appendChild(el("p", {
      className: "studio-subtitle",
      textContent: code
        ? "ابعت الروابط دي للمتسجّلين. فيها كود الليدر بتاعك تلقائيًا، فالمتسجّل بيبدأ بيه من غير ما يختار."
        : "ابعت الروابط دي للمتسجّلين عشان يعملوا حساب، وبعدها يختاروا مهمة وكود الليدر."
    }, "margin-bottom:0;"));

    card.appendChild(row({ label: "رابط إنشاء حساب للمتسجّلين", url: abs(signupPath), msg: "اعمل حساب على Studio عشان تبدأ تسجّل:" }));
    card.appendChild(row({ label: "رابط المهام المتاحة", url: abs(tasksPath), msg: "المهام المتاحة على Studio:" }));

    host.innerHTML = "";
    host.appendChild(card);
  }

  window.StudioShare = { mount: mount };
})();
