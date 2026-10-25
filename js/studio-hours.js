// Studio — rework-time picker (v4).
//
// Turns a plain <select> into: 12 / 24 / 36 / 48 / 72 hours, or "more" = type ANY whole number of hours (1–720).
// The select keeps its id and still holds a plain number, so a page that never loads this file keeps working with
// whatever options its HTML has.
//
//   StudioHours.mount(selectEl, { value: 12 });                         // build it and pre-select 12
//   StudioHours.mount(selectEl, { inheritLabel: "زي إعداد المهمة" });   // adds a first "leave it as the task says" option
//   StudioHours.set(selectEl, 36);                                      // show a stored value (even 100 → "more" + 100)
//   StudioHours.get(selectEl);                                          // number | null (= inherit) | NaN (typed something invalid)
//   StudioHours.valid(h);                                               // true for a whole number 1..720
window.StudioHours = (function () {
  "use strict";
  var PRESETS = [12, 24, 36, 48, 72];
  var MAX = 720;
  var parts = new WeakMap();   // select -> { wrap, input }

  function valid(h) { return typeof h === "number" && isFinite(h) && Math.floor(h) === h && h >= 1 && h <= MAX; }

  function mount(select, opts) {
    opts = opts || {};
    var html = "";
    if (opts.inheritLabel) html += '<option value="">' + opts.inheritLabel + "</option>";
    PRESETS.forEach(function (h) { html += '<option value="' + h + '">' + h + " ساعة</option>"; });
    html += '<option value="custom">أكتر من كده (اكتب العدد)</option>';
    select.innerHTML = html;

    var wrap = document.createElement("div");
    wrap.style.cssText = "display:none; align-items:center; gap:8px; margin-top:8px;";
    wrap.innerHTML = '<input type="number" min="1" max="' + MAX + '" step="1" placeholder="عدد الساعات" style="max-width:150px;">' +
      '<span class="studio-hint" style="margin:0;">ساعة (من 1 لـ ' + MAX + ")</span>";
    select.parentNode.insertBefore(wrap, select.nextSibling);
    var input = wrap.querySelector("input");
    parts.set(select, { wrap: wrap, input: input });

    function sync() { wrap.style.display = select.value === "custom" ? "flex" : "none"; }
    select.addEventListener("change", function () { sync(); if (select.value === "custom") input.focus(); });
    if (opts.value !== undefined) set(select, opts.value); else sync();
  }

  function set(select, hours) {
    var p = parts.get(select);
    if (!p) { select.value = String(hours); return; }
    var h = Number(hours);
    if (hours === null || hours === undefined || hours === "") {
      select.value = select.querySelector('option[value=""]') ? "" : String(PRESETS[0]);
    } else if (PRESETS.indexOf(h) >= 0) {
      select.value = String(h);
    } else {
      select.value = "custom";
      p.input.value = String(h);
    }
    p.wrap.style.display = select.value === "custom" ? "flex" : "none";
  }

  function get(select) {
    var p = parts.get(select);
    if (!p) { return select.value === "" ? null : Number(select.value); }
    if (select.value === "") return null;
    if (select.value === "custom") return p.input.value === "" ? NaN : Number(p.input.value);
    return Number(select.value);
  }

  return { mount: mount, set: set, get: get, valid: valid, MAX: MAX, PRESETS: PRESETS };
})();
