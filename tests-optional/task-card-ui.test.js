// UI test: the available-task card on tasks.html and on the talent's account (talent-dashboard.html).
let JSDOM; try { ({ JSDOM } = require("jsdom")); } catch (_) { console.log("skipped: jsdom not installed"); process.exit(0); }
const fs = require("fs"), path = require("path"), assert = require("assert");
const FRONT = process.env.STUDIO_FRONT;
if (!FRONT) { console.log("skipped: set STUDIO_FRONT"); process.exit(0); }
const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const ARABIC = /[\u0600-\u06FF]/;
const TASKS = [
  { id: "t1", title: "project", sample_count: 40, limited: true, use_age_brackets: true, slots: [
    { gender: "female", ageBracket: "child", max: 7, used: 0, remaining: 7, full: false },
    { gender: "female", ageBracket: "adult", max: 7, used: 5, remaining: 2, full: false },
    { gender: "male", ageBracket: "child", max: 7, used: 7, remaining: 0, full: true },
    { gender: "male", ageBracket: "elderly", max: 4, used: 1, remaining: 3, full: false } ] },
  { id: "t2", title: "No brackets", sample_count: 12, limited: true, slots: [
    { gender: "male", ageBracket: "", max: 10, used: 4, remaining: 6, full: false },
    { gender: "female", ageBracket: "", max: 10, used: 10, remaining: 0, full: true } ] },
  { id: "t3", title: "Everything full", sample_count: 5, limited: true, slots: [{ gender: "male", ageBracket: "", max: 3, used: 3, remaining: 0, full: true }] },
  { id: "t4", title: "Old task", sample_count: 9, limited: false, quantity: 20, submission_count: 5, slots: [] },
  { id: "t5", title: "Old open task", sample_count: 9, limited: false, slots: [] },
];
function load(file, lang) {
  let html = fs.readFileSync(path.join(FRONT, file), "utf8");
  html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, src) => `<script>${fs.readFileSync(path.join(FRONT, src), "utf8")}</script>`);
  return new JSDOM(html, { runScripts: "dangerously", url: "https://example.com/" + file, pretendToBeVisual: true,
    beforeParse(w) {
      w.localStorage.setItem("studio_lang", lang);
      w.localStorage.setItem("studio_talent_token", "tok"); w.localStorage.setItem("studio_talent_user", JSON.stringify({ name: "Tal" }));
      w.fetch = async (url) => ({ ok: true, json: async () => (/\/talent\/tasks$/.test(url) ? TASKS : /me\/sessions/.test(url) ? [] : /feedback\/mine/.test(url) ? { items: [] } : {}) });
    } });
}
(async () => {
  for (const file of ["tasks.html", "talent-dashboard.html"]) {
    for (const lang of ["ar", "en"]) {
      const dom = load(file, lang); await wait(250);
      const d = dom.window.document;
      const cards = [...d.querySelectorAll("#tasks-wrap .tc")];
      assert.strictEqual(cards.length, 5, `${file}/${lang}: 5 cards`);
      const c1 = cards[0];
      assert.strictEqual(c1.querySelectorAll(".tc-g").length, 2, "boys and girls columns");
      assert.strictEqual(c1.querySelectorAll(".tc-row").length, 4, "one row per slot");
      assert.ok(c1.querySelector(".tc-g.male .tc-full"), "full slot says full");
      assert.ok(c1.textContent.replace(/\s+/g, "").includes("2/7"), "remaining / max shown");
      assert.ok(c1.querySelector(".tc-total .tc-bar"), "overall bar");
      assert.ok(c1.querySelector("button:not([disabled])"), "start button");
      assert.strictEqual(cards[1].querySelectorAll(".tc-row-name").length, 2);
      assert.ok(cards[2].classList.contains("is-full") && cards[2].querySelector("button[disabled]"), "everything full -> disabled");
      assert.ok(cards[3].textContent.includes("15"), "old task keeps its old available number");
      assert.strictEqual(cards[4].querySelectorAll(".tc-g").length, 0);
      assert.strictEqual(d.querySelectorAll(".tc img, .tc script").length, 0);
      if (lang === "en") {
        const w = d.createTreeWalker(d.getElementById("tasks-wrap"), 4); const leaks = []; let n;
        while ((n = w.nextNode())) if (ARABIC.test(n.nodeValue)) leaks.push(n.nodeValue.trim());
        assert.deepStrictEqual(leaks, [], "Arabic with no translation: " + leaks.join(" | "));
        assert.ok(c1.textContent.includes("Boys") && c1.textContent.includes("Girls") && c1.textContent.includes("Full"));
      }
      console.log(`ok ${file} (${lang})`);
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
