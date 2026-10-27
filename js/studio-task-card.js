// Studio — the "available task" card, shared by tasks.html (public) and the talent's account (talent-dashboard.html).
//   NMTaskCard.html(task, { button })  ->  card markup.  task = one entry of GET /api/studio/talent/tasks
// Layout: title + status badge, a line with the sentence count and the places left, one overall bar, then a small
// table — columns = boys / girls, rows = age groups (one row when the task has no age groups) — each cell shows the
// places left with its own bar. Every visible Arabic text is its own element so studio-i18n.js can translate it.
(function () {
  var GENDERS = [["male", "♂", "ولاد"], ["female", "♀", "بنات"]];
  var BRACKETS = [["adult", "بالغين"], ["child", "أطفال"], ["elderly", "كبار السن"]];

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function pct(remaining, max) { return max > 0 ? Math.max(0, Math.min(100, Math.round((remaining / max) * 100))) : 0; }
  function level(p) { return p <= 15 ? "low" : p <= 50 ? "mid" : "high"; }
  // "left / max" as ONE left-to-right unit, so the slash never flips inside the Arabic line
  function num(left, max) { return '<span class="tc-frac" dir="ltr"><b>' + left + "</b><small>/" + max + "</small></span>"; }

  function cell(s) {
    if (!s || (s.max === 0 && !s.used)) return '<div class="tc-cell na"><span class="tc-dash">—</span></div>';
    if (s.full || s.max === 0) return '<div class="tc-cell full"><span class="tc-full">تم الاكتفاء</span></div>';
    var p = pct(s.remaining, s.max);
    return '<div class="tc-cell ' + level(p) + '"><span class="tc-val">' + num(s.remaining, s.max) + "</span>" +
      '<span class="tc-bar"><i style="width:' + p + '%"></i></span></div>';
  }

  function tableHtml(t) {
    var slots = t.slots || [];
    var genders = GENDERS.filter(function (g) { return slots.some(function (s) { return s.gender === g[0] && !(s.max === 0 && !s.used); }); });
    if (!genders.length) return "";
    var byBracket = slots.some(function (s) { return !!s.ageBracket; });
    var rows = byBracket ? BRACKETS.filter(function (b) { return slots.some(function (s) { return s.ageBracket === b[0]; }); }) : [["", ""]];
    var find = function (g, b) { return slots.filter(function (s) { return s.gender === g && (s.ageBracket || "") === b; })[0]; };
    var cols = (byBracket ? "auto " : "") + "repeat(" + genders.length + ", minmax(0, 1fr))";
    var out = '<div class="tc-table' + (byBracket ? " has-rows" : "") + '" style="grid-template-columns:' + cols + '">';
    if (byBracket) out += '<div class="tc-corner"></div>';
    genders.forEach(function (g) { out += '<div class="tc-colh ' + g[0] + '"><span class="tc-gico">' + g[1] + "</span><span>" + g[2] + "</span></div>"; });
    rows.forEach(function (b) {
      if (byBracket) out += '<div class="tc-rowh"><span>' + b[1] + "</span></div>";
      genders.forEach(function (g) { out += cell(find(g[0], b[0])); });
    });
    return out + "</div>";
  }

  function html(t, opts) {
    opts = opts || {};
    var limited = !!t.limited;
    var slots = t.slots || [];
    var open = limited ? slots.filter(function (s) { return !s.full && s.max > 0; }) : [];
    var allFull = limited && !open.length;
    var totalMax = limited ? slots.reduce(function (n, s) { return n + s.max; }, 0) : 0;
    var totalLeft = limited ? slots.reduce(function (n, s) { return n + s.remaining; }, 0) : 0;
    var p = pct(totalLeft, totalMax);

    var badge;
    if (allFull) badge = '<span class="tc-badge bad"><span>تم الاكتفاء</span></span>';
    else if (limited && p <= 15) badge = '<span class="tc-badge low"><span>آخر أماكن</span></span>';
    else if (!limited && !t.quantity) badge = '<span class="tc-badge ok"><span>مفتوحة للتسجيل</span></span>';
    else badge = '<span class="tc-badge ok"><span>مفتوحة</span></span>';

    var meta = '<span class="tc-meta-item">🎙️ <b dir="ltr">' + (t.sample_count || 0) + "</b> <span>جملة</span></span>";
    if (limited && !allFull) meta += '<span class="tc-meta-item"><span>متبقي</span> ' + num(totalLeft, totalMax) + "</span>";
    else if (!limited && t.quantity) meta += '<span class="tc-meta-item"><span>العدد المتاح</span> <b dir="ltr">' + Math.max(t.quantity - (t.submission_count || 0), 0) + "</b></span>";

    if (t.password_protected) meta += '<span class="tc-meta-item">🔒 <span>محمية بكلمة سر</span></span>';

    var overall = limited && !allFull ? '<span class="tc-bar tc-total ' + level(p) + '"><i style="width:' + p + '%"></i></span>' : "";
    var button = opts.button !== undefined ? opts.button : "";
    return '<article class="tc' + (allFull ? " is-full" : "") + '">' +
      '<header class="tc-head"><h3>' + esc(t.title) + "</h3>" + badge + "</header>" +
      '<div class="tc-meta">' + meta + "</div>" + overall +
      (limited ? tableHtml(t) : "") +
      '<div class="tc-foot">' + (allFull
        ? '<button type="button" class="studio-btn studio-btn-secondary studio-btn-block" disabled><span>تم الاكتفاء</span></button>'
        : button) + "</div></article>";
  }

  window.NMTaskCard = { html: html };
})();
