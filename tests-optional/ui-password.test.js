// Studio v10 — task password, front-end side (jsdom). Run: npm i jsdom && node --test tests-optional/ui-password.test.js
const test = require("node:test"), assert = require("node:assert");
const { load, arabicLeft } = require("./ui-helper");

const ME = { id: "t1", name: "Sara Hassan", email: "s@x.com", gender: "female", age: 34, age_bracket: "adult" };
const storage = { studio_talent_token: "tok", studio_talent_user: JSON.stringify(ME) };
const HL = { studio_token: "tok", studio_role: "head_leader", studio_user: JSON.stringify({ id: "h", name: "Head" }) };
const TASK = (over = {}) => ({ id: "task1", title: "Task One", direct: false, identity_mode: "names", use_age_brackets: false, limited: false, slots: [], password_protected: false, ...over });
const hidden = (d, id) => d.getElementById(id).classList.contains("hidden");
const setupRoutes = (task, { names = ["Fox", "Owl"], unlock, namesRes, start } = {}) => [
  [/\/auth\/me$/, () => ({ status: 200, body: { user: ME } })],
  [/\/talent\/tasks\/task1\/unlock$/, (u, o) => unlock ? unlock(o) : ({ status: 200, body: { ok: true, unlockToken: "UNLOCK-1" } })],
  [/\/talent\/tasks\/task1\/fake-names/, () => namesRes ? namesRes() : ({ status: 200, body: names })],
  [/\/talent\/tasks\/task1$/, () => ({ status: 200, body: { task, leaders: [], leaderSlots: {} } })],
  [/\/talent\/sessions$/, (u, o) => start ? start(o) : ({ status: 201, body: { session: { session_token: "S1" } } })],
];
const setupPage = (task, opts = {}, extra = {}) => load("talent-setup.html", { storage, search: "?taskId=task1&leaderId=L1", routes: setupRoutes(task, opts), ...extra });

test("setup, protected task: only the password box is shown, nothing is loaded behind it", async () => {
  const p = await setupPage(TASK({ password_protected: true }));
  assert.equal(hidden(p.d, "gate"), false);
  assert.equal(hidden(p.d, "main-form"), true);
  assert.equal(p.calls.filter((c) => /fake-names/.test(c.path)).length, 0, "the names are not even asked for");
  assert.equal(p.errors.length, 0, p.errors.join("|"));
});

test("setup, protected task: wrong password shows the server message and stays locked; right password opens it", async () => {
  let n = 0;
  const p = await setupPage(TASK({ password_protected: true }), {
    unlock: () => (++n === 1 ? { status: 403, body: { error: "كلمة السر غلط", code: "wrong_password" } } : { status: 200, body: { ok: true, unlockToken: "UNLOCK-1" } }),
  });
  const pw = p.d.getElementById("gate-password");
  pw.value = "nope"; p.d.getElementById("gate-btn").click(); await p.wait(120);
  assert.equal(p.d.getElementById("gate-error").textContent, "كلمة السر غلط");
  assert.equal(hidden(p.d, "main-form"), true);
  pw.value = "  Right-1234 "; p.d.getElementById("gate-btn").click(); await p.wait(160);
  const call = p.calls.filter((c) => /unlock$/.test(c.path)).pop();
  assert.deepEqual(call.body, { password: "  Right-1234 " }, "sent as typed; the server trims it");
  assert.equal(hidden(p.d, "gate"), true);
  assert.equal(hidden(p.d, "main-form"), false);
  const names = p.calls.find((c) => /fake-names/.test(c.path));
  assert.equal(names.headers["X-Task-Unlock"], "UNLOCK-1", "the names request carries the unlock token");
  assert.ok(p.d.getElementById("fake-name-select").value, "names loaded");
  p.d.getElementById("start-btn").click(); await p.wait(120);
  const start = p.calls.find((c) => /talent\/sessions$/.test(c.path));
  assert.deepEqual(start.body, { taskId: "task1", leaderId: "L1", fakeName: "Fox", unlockToken: "UNLOCK-1" });
});

test("setup: Enter key submits; an empty box is stopped in the browser; show / hide toggle", async () => {
  const p = await setupPage(TASK({ password_protected: true }));
  p.d.getElementById("gate-btn").click(); await p.wait(60);
  assert.equal(p.calls.filter((c) => /unlock$/.test(c.path)).length, 0);
  assert.match(p.d.getElementById("gate-error").textContent, /اكتب كلمة السر/);
  const pw = p.d.getElementById("gate-password");
  assert.equal(pw.type, "password");
  p.d.getElementById("gate-toggle").click(); assert.equal(pw.type, "text");
  p.d.getElementById("gate-toggle").click(); assert.equal(pw.type, "password");
  pw.value = "abcd1234";
  pw.dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await p.wait(160);
  assert.equal(p.calls.filter((c) => /unlock$/.test(c.path)).length, 1);
});

test("setup: a tab that already unlocked goes straight in, but a stale token (password changed) drops back to the box", async () => {
  const ok = await setupPage(TASK({ password_protected: true }), {}, { session: { studio_task_unlock_task1: "OLD" } });
  assert.equal(hidden(ok.d, "gate"), true);
  assert.equal(ok.calls.find((c) => /fake-names/.test(c.path)).headers["X-Task-Unlock"], "OLD");

  const stale = await setupPage(TASK({ password_protected: true }), { namesRes: () => ({ status: 403, body: { error: "x", code: "task_locked" } }) }, { session: { studio_task_unlock_task1: "OLD" } });
  assert.equal(hidden(stale.d, "gate"), false);
  assert.equal(hidden(stale.d, "main-form"), true);
  assert.match(stale.d.getElementById("gate-error").textContent, /اتغيّرت/);
  assert.equal(stale.w.sessionStorage.getItem("studio_task_unlock_task1"), null, "the dead token is forgotten");

  const startLocked = await setupPage(TASK({ password_protected: true }), { start: () => ({ status: 403, body: { error: "x", code: "task_locked" } }) }, { session: { studio_task_unlock_task1: "OLD" } });
  startLocked.d.getElementById("start-btn").click(); await startLocked.wait(160);
  assert.equal(hidden(startLocked.d, "gate"), false, "the start button also falls back to the box");
});

test("setup, open task: no box, same as before, nothing extra sent", async () => {
  const p = await setupPage(TASK());
  assert.equal(hidden(p.d, "gate"), true);
  assert.equal(hidden(p.d, "main-form"), false);
  assert.equal(p.calls.filter((c) => /unlock$/.test(c.path)).length, 0);
  assert.equal(p.calls.find((c) => /fake-names/.test(c.path)).headers["X-Task-Unlock"], undefined);
  p.d.getElementById("start-btn").click(); await p.wait(120);
  assert.deepEqual(p.calls.find((c) => /talent\/sessions$/.test(c.path)).body, { taskId: "task1", leaderId: "L1", fakeName: "Fox" });
});

test("setup in English: the box has no Arabic left, and server messages are translated", async () => {
  const p = await setupPage(TASK({ password_protected: true }), { unlock: () => ({ status: 403, body: { error: "كلمة السر غلط", code: "wrong_password" } }) }, { lang: "en" });
  await p.wait(100);
  assert.deepEqual(arabicLeft(p.d), []);
  p.d.getElementById("gate-password").value = "x"; p.d.getElementById("gate-btn").click(); await p.wait(200);
  assert.equal(p.d.getElementById("gate-error").textContent, "Wrong password");
  assert.deepEqual(arabicLeft(p.d), []);
  const wait = await setupPage(TASK({ password_protected: true }), { unlock: () => ({ status: 429, body: { error: "حاولت كتير بكلمة سر غلط. استنى 7 دقيقة وجرّب تاني.", code: "too_many_tries" } }) }, { lang: "en" });
  wait.d.getElementById("gate-password").value = "x"; wait.d.getElementById("gate-btn").click(); await wait.wait(200);
  assert.equal(wait.d.getElementById("gate-error").textContent, "Too many wrong tries. Wait 7 minutes and try again.");
});

test("task card: a protected task says so, an open one does not", async () => {
  const p = await load("tasks.html", { routes: [[/talent\/tasks$/, () => ({ status: 200, body: [
    { id: "a", title: "Locked one", password_protected: true, limited: false, slots: [], sample_count: 3 },
    { id: "b", title: "Open one", password_protected: false, limited: false, slots: [], sample_count: 3 }] })]] });
  const cards = [...p.d.querySelectorAll("article.tc")];
  assert.equal(cards.length, 2);
  assert.match(cards[0].textContent, /محمية بكلمة سر/);
  assert.doesNotMatch(cards[1].textContent, /محمية بكلمة سر/);
  const en = await load("tasks.html", { lang: "en", routes: [[/talent\/tasks$/, () => ({ status: 200, body: [{ id: "a", title: "Locked one", password_protected: true, limited: false, slots: [], sample_count: 3 }] })]] });
  assert.match(en.d.querySelector("article.tc").textContent, /Password-protected/);
});

// ----------------------------------------------------------------------------------------------- head leader: publish
const CREATED = (over = {}) => ({ id: "T1", title: "R", script_mode: "shared", identity_mode: "real", direct: true, limited: false, slots: [], rework_hours: 12, password_protected: false,
  recording_settings: { sampleRate: 16000, bitDepth: 16, format: "wav", channels: "mono" }, ...over });
const publishPage = (created, lang = "ar") => load("publish-task.html", { lang, storage: HL, routes: [
  [/headleader\/leaders$/, () => ({ status: 200, body: [] })],
  [/headleader\/tasks$/, () => ({ status: 201, body: created })],
] });
const fillBasics = (p) => { p.d.getElementById("t-identity-mode").value = "real"; p.d.getElementById("t-direct").checked = true; p.d.getElementById("t-title").value = "R"; };

test("publish: the password box opens with the tick; 'generate' fills a usable password", async () => {
  const p = await publishPage(CREATED());
  assert.equal(hidden(p.d, "t-lock-box"), true);
  const tick = p.d.getElementById("t-lock"); tick.checked = true; tick.dispatchEvent(new p.w.Event("change"));
  assert.equal(hidden(p.d, "t-lock-box"), false);
  p.d.getElementById("t-password-gen").click();
  assert.match(p.d.getElementById("t-password").value, /^[a-z2-9]{8}$/);
});

test("publish: tick + a short password is stopped; a good one is sent as accessPassword; no tick sends nothing", async () => {
  const short = await publishPage(CREATED());
  fillBasics(short);
  short.d.getElementById("t-lock").checked = true; short.d.getElementById("t-password").value = "abc";
  short.d.getElementById("step1-btn").click(); await short.wait(150);
  assert.equal(short.calls.filter((c) => /headleader\/tasks$/.test(c.path) && c.method === "POST").length, 0);
  assert.match(short.d.getElementById("step1-error") ? short.d.getElementById("step1-error").textContent : short.d.querySelector(".studio-error").textContent, /4 حروف/);

  const good = await publishPage(CREATED({ password_protected: true }));
  fillBasics(good);
  good.d.getElementById("t-lock").checked = true; good.d.getElementById("t-password").value = "  Open-Sesame1 ";
  good.d.getElementById("step1-btn").click(); await good.wait(150);
  const body = good.calls.find((c) => /headleader\/tasks$/.test(c.path) && c.method === "POST").body;
  assert.equal(body.accessPassword, "Open-Sesame1");

  const open = await publishPage(CREATED());
  fillBasics(open);
  open.d.getElementById("t-lock").checked = false; open.d.getElementById("t-password").value = "leftover1";
  open.d.getElementById("step1-btn").click(); await open.wait(150);
  assert.ok(!("accessPassword" in open.calls.find((c) => /headleader\/tasks$/.test(c.path) && c.method === "POST").body), "an unticked box sends no password even if the field has text");
});

test("publish in English: nothing Arabic is left in the new box", async () => {
  const p = await publishPage(CREATED(), "en");
  const tick = p.d.getElementById("t-lock"); tick.checked = true; tick.dispatchEvent(new p.w.Event("change")); await p.wait(80);
  const left = arabicLeft(p.d).filter((x) => /سر|كلمة|توليد|الحماية/.test(x));
  assert.deepEqual(left, []);
});

// ----------------------------------------------------------------------------------------------- head leader: edit
const SETTINGS = { sampleRate: 16000, bitDepth: 16, format: "wav", channels: "mono" };
const DETAIL = (task = {}) => ({ task: { id: "T1", title: "Task", status: "published", script_mode: "shared", identity_mode: "names", direct: false, use_age_brackets: false, limited: false, slots: [],
  rework_hours: 12, recording_settings: SETTINGS, password_protected: false, ...task }, samples: [], leaders: [], qa: [], leaderQuotas: [], leaderSlots: {}, scripts: [] });
async function editPage(task = {}, patch, lang = "ar") {
  return load("edit-task.html", { lang, storage: HL, search: "?id=T1", routes: [
    [/headleader\/leaders$/, () => ({ status: 200, body: [] })],
    [/headleader\/tasks\/T1$/, (u, o) => (o.method === "PATCH" ? (patch ? patch(o) : { status: 200, body: DETAIL(JSON.parse(o.body).accessPassword === null ? { password_protected: false } : { password_protected: true }).task }) : { status: 200, body: DETAIL(task) })],
  ] });
}

test("edit, open task: says it is open, no 'remove' button; saving sends the new password alone", async () => {
  const p = await editPage();
  assert.match(p.d.getElementById("lock-state").textContent, /مفتوحة من غير كلمة سر/);
  assert.equal(hidden(p.d, "lock-remove"), true);
  assert.equal(p.d.getElementById("lock-save").textContent, "حفظ كلمة السر");
  p.d.getElementById("e-password").value = "abc"; p.d.getElementById("lock-save").click(); await p.wait(80);
  assert.match(p.d.getElementById("lock-error").textContent, /4 حروف/);
  assert.equal(p.calls.filter((c) => c.method === "PATCH").length, 0);
  p.d.getElementById("e-password").value = " New-pass9 "; p.d.getElementById("lock-save").click(); await p.wait(150);
  const patch = p.calls.find((c) => c.method === "PATCH");
  assert.deepEqual(patch.body, { accessPassword: "New-pass9" }, "only the password — never mixed with the other settings");
  assert.match(p.d.getElementById("lock-state").textContent, /محمية بكلمة سر/);
  assert.equal(hidden(p.d, "lock-remove"), false);
  assert.equal(p.d.getElementById("lock-save").textContent, "تغيير كلمة السر");
  assert.equal(p.d.getElementById("e-password").value, "", "the box is emptied — the password is not kept on the page");
});

test("edit, protected task: change, then remove (null) opens it again", async () => {
  const p = await editPage({ password_protected: true });
  assert.match(p.d.getElementById("lock-state").textContent, /محمية بكلمة سر/);
  assert.equal(hidden(p.d, "lock-remove"), false);
  p.d.getElementById("lock-remove").click(); await p.wait(150);
  const patch = p.calls.find((c) => c.method === "PATCH");
  assert.deepEqual(patch.body, { accessPassword: null });
  assert.match(p.d.getElementById("lock-state").textContent, /مفتوحة من غير كلمة سر/);
  assert.equal(hidden(p.d, "lock-remove"), true);
});

test("edit: a server error (e.g. migration not run) is shown as is", async () => {
  const p = await editPage({}, () => ({ status: 409, body: { error: "كلمة سر المهمة محتاجة migration v10 — شغّلها في Supabase الأول." } }));
  p.d.getElementById("e-password").value = "good-pass1"; p.d.getElementById("lock-save").click(); await p.wait(150);
  assert.match(p.d.getElementById("lock-error").textContent, /migration v10/);
});

test("edit in English: the password section has no Arabic left", async () => {
  const p = await editPage({ password_protected: true }, undefined, "en"); await p.wait(100);
  const left = arabicLeft(p.d).filter((x) => /سر|كلمة|توليد|الحماية|تغيير/.test(x));
  assert.deepEqual(left, []);
});

test("every page I touched still compiles", () => {
  const fs = require("fs"), path = require("path");
  for (const f of ["publish-task.html", "edit-task.html", "talent-setup.html", "tasks.html", "dashboard-head-leader.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1]);
  }
  for (const f of ["js/studio-talent.js", "js/studio-task-card.js", "js/studio-i18n-dict.js"]) new Function(fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
});
