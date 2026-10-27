const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..") + "/";
// Loads a page with every <script src> inlined and fetch mocked. routes: [[regex, (url, opts) => ({status, body})]]
async function load(page, { lang = "ar", storage = {}, session = {}, routes = [], search = "" } = {}) {
  let html = fs.readFileSync(ROOT + page, "utf8");
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => `<script>${fs.readFileSync(ROOT + src, "utf8")}</script>`);
  const calls = [];
  const dom = new JSDOM(html, {
    url: `https://gigversestudio.click/${page}${search}`, runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) {
      w.localStorage.setItem("studio_lang", lang);
      for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
      for (const [k, v] of Object.entries(session)) w.sessionStorage.setItem(k, v);
      w.fetch = async (url, opts = {}) => {
        const path = String(url).replace(/^https?:\/\/[^/]+/, "");
        calls.push({ path, method: opts.method || "GET", headers: opts.headers || {}, body: opts.body && typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body });
        for (const [re, fn] of routes) if (re.test(path)) { const r = fn(path, opts); return { ok: r.status < 400, status: r.status, json: async () => r.body }; }
        return { ok: false, status: 404, json: async () => ({ error: "no route " + path }) };
      };
      w.alert = () => {}; w.confirm = () => true;
      w.HTMLMediaElement.prototype.load = () => {}; w.scrollTo = () => {};
    },
  });
  const w = dom.window;
  const errors = [];
  w.addEventListener("error", (e) => errors.push(e.message));
  await new Promise((r) => setTimeout(r, 150));
  return { w, d: w.document, calls, errors, wait: (ms = 100) => new Promise((r) => setTimeout(r, ms)) };
}
const ARABIC = /[\u0600-\u06FF]/;
// visible text of the page that is still Arabic (EN mode must leave none)
function arabicLeft(d) {
  const out = [];
  const walk = d.createTreeWalker(d.body, 4);
  for (let n; (n = walk.nextNode());) {
    const p = n.parentNode;
    if (/SCRIPT|STYLE/.test(p.nodeName)) continue;
    let hidden = false; for (let e = p; e && e.nodeType === 1; e = e.parentNode) if (e.classList && e.classList.contains("hidden")) hidden = true;
    if (!hidden && ARABIC.test(n.nodeValue)) out.push(n.nodeValue.trim());
  }
  d.querySelectorAll("[placeholder]").forEach((e) => { if (ARABIC.test(e.getAttribute("placeholder"))) out.push("placeholder:" + e.getAttribute("placeholder")); });
  return out;
}
module.exports = { load, arabicLeft };
