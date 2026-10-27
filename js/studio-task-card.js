// Studio — the "available task" card, shared by tasks.html (public) and the talent's account (talent-dashboard.html).
//   NMTaskCard.html(task, { button })  ->  card markup.  task = one entry of GET /api/studio/talent/tasks
// Boys / girls in two columns; inside each, one row per age bracket (or one row when the task has no brackets), with a
// bar showing how much of the place is still free. Every visible Arabic text is its own element so studio-i18n.js can translate it.
(function () {
  var GENDERS = [["male", "♂", "ولاد"], ["female", "♀", "بنات"]];
  var BRACKET = { child: "أطفال", adult: "بالغين", elderly: "كبار السن" };

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function pct(remaining, max) { return max > 0 ? Math.max(0, Math.min(100, Math.round((remaining / max) * 100))) : 0; }
  function level(p) { return p <= 15 ? "low" : p <= 50 ? "mid" : "high"; }

  function slotRow(s) {
    var full = s.full || s.max === 0;
    var p = pct(s.remaining, s.max);
    var name = s.ageBracket ? '<span class="tc-row-name">' + BRACKET[s.ageBracket] + "</span>" : '<span class="tc-row-name">الأماكن</span>';
    return '<div class="tc-row' + (full ? " is-full" : "") + '">' + name +
      '<span class="tc-bar ' + (full ? "full" : level(p)) + '"><i style="width:' + (full ? 0 : p) + '%"></i></span>' +
      (full ? '<span class="tc-full">تم الاكتفاء</span>'
            : '<span class="tc-num" dir="ltr"><b>' + s.remaining + '</b> / ' + s.max + "</span>") +
      "</div>";
  }

  function gendersHtml(t) {
    return GENDERS.map(function (g) {
      var rows = t.slots.filter(function (s) { return s.gender === g[0] && !(s.max === 0 && !s.used); });
      if (!rows.length) return "";
      return '<section class="tc-g ' + g[0] + '"><h4><span class="tc-gico">' + g[1] + "</span> <span>" + g[2] + "</span></h4>" +
        rows.map(slotRow).join("") + "</section>";
    }).join("");
  }

  function html(t, opts) {
    opts = opts || {};
    var limited = !!t.limited;
    var open = limited ? t.slots.filter(function (s) { return !s.full && s.max > 0; }) : [];
    var allFull = limited && !open.length;
    var totalMax = limited ? t.slots.reduce(function (n, s) { return n + s.max; }, 0) : 0;
    var totalLeft = limited ? t.slots.reduce(function (n, s) { return n + s.remaining; }, 0) : 0;
    var chips = '<span class="tc-chip">🎙️ <b dir="ltr">' + (t.sample_count || 0) + "</b> <span>جملة</span></span>";
    if (!limited) {
      chips += t.quantity
        ? '<span class="tc-chip"><span>العدد المتاح</span> <b dir="ltr">' + Math.max(t.quantity - (t.submission_count || 0), 0) + "</b></span>"
        : '<span class="tc-chip ok"><span>مفتوحة للتسجيل</span></span>';
    } else if (allFull) chips += '<span class="tc-chip bad"><span>تم الاكتفاء</span></span>';
    else chips += '<span class="tc-chip ok"><span>متبقي</span> <b dir="ltr">' + totalLeft + " / " + totalMax + "</b></span>";
    var p = pct(totalLeft, totalMax);
    var overall = limited && !allFull ? '<div class="tc-total"><span class="tc-bar ' + level(p) + '"><i style="width:' + p + '%"></i></span></div>' : "";
    var button = opts.button !== undefined ? opts.button : "";
    return '<article class="tc' + (allFull ? " is-full" : "") + '">' +
      '<header class="tc-head"><h3>' + esc(t.title) + '</h3></header>' +
      '<div class="tc-chips">' + chips + "</div>" + overall +
      (limited ? '<div class="tc-genders">' + gendersHtml(t) + "</div>" : "") +
      '<div class="tc-foot">' + (allFull
        ? '<button type="button" class="studio-btn studio-btn-secondary studio-btn-block" disabled><span>تم الاكتفاء</span></button>'
        : button) + "</div></article>";
  }

  window.NMTaskCard = { html: html };
})();
