const test = require("node:test"), assert = require("node:assert");
const { load, arabicLeft } = require("./ui-helper");

const ME = { id: "t1", name: "Sara Hassan", email: "s@x.com", gender: "female", age: 34, age_bracket: "adult" };
const storage = { studio_talent_token: "tok", studio_talent_user: JSON.stringify(ME) };
const TASK = (over = {}) => ({ id: "task1", title: "Task One", direct: false, identity_mode: "names", use_age_brackets: false, limited: false, slots: [], ...over });
const setupRoutes = (task, { me = ME, names = ["Fox", "Owl"], start } = {}) => [
  [/\/auth\/me$/, () => ({ status: 200, body: { user: me } })],
  [/\/talent\/tasks\/task1\/fake-names/, () => ({ status: 200, body: names })],
  [/\/talent\/tasks\/task1$/, () => ({ status: 200, body: { task, leaders: [], leaderSlots: {} } })],
  [/\/talent\/sessions$/, (u, o) => start ? start(o) : ({ status: 201, body: { session: { session_token: "S1" } } })],
];

test("signup form: asks name (English), gender, age; previews the age group; sends real data", async () => {
  const p = await load("talent-login.html", { routes: [[/auth\/talent\/signup/, () => ({ status: 201, body: { token: "t", user: ME } })]] });
  p.d.querySelector('[data-mode="signup"]').click();
  const set = (id, v) => { const e = p.d.getElementById(id); e.value = v; e.dispatchEvent(new p.w.Event("input", { bubbles: true })); };
  set("s-age", "٢٧"); assert.match(p.d.getElementById("s-bracket").textContent, /بالغ/);
  set("s-age", "13"); assert.match(p.d.getElementById("s-bracket").textContent, /طفل/);
  set("s-age", "14"); assert.match(p.d.getElementById("s-bracket").textContent, /بالغ/);
  set("s-age", "60"); assert.match(p.d.getElementById("s-bracket").textContent, /مسن/);
  set("s-age", "81"); assert.equal(p.d.getElementById("s-bracket").textContent.trim(), "");
  set("s-age", "2"); assert.equal(p.d.getElementById("s-bracket").textContent.trim(), "");
  set("s-name", "Sara Hassan"); set("s-email", "s@x.com"); set("s-password", "secret1"); set("s-gender", "female"); set("s-age", "٣٤");
  p.d.getElementById("signup-form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await p.wait();
  const c = p.calls.find((x) => /talent\/signup/.test(x.path));
  assert.deepEqual(c.body, { name: "Sara Hassan", email: "s@x.com", password: "secret1", gender: "female", age: 34 });
});

test("signup form: a bad age is stopped in the browser", async () => {
  const p = await load("talent-login.html", {});
  p.d.querySelector('[data-mode="signup"]').click();
  const set = (id, v) => { p.d.getElementById(id).value = v; };
  set("s-name", "Sara"); set("s-email", "s@x.com"); set("s-password", "secret1"); set("s-gender", "female"); set("s-age", "abc");
  p.d.getElementById("signup-form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await p.wait();
  assert.equal(p.calls.filter((x) => /signup/.test(x.path)).length, 0);
  assert.match(p.d.getElementById("signup-error").textContent, /السن/);
});

test("signup form in English: nothing Arabic is left", async () => {
  const p = await load("talent-login.html", { lang: "en" });
  p.d.querySelector('[data-mode="signup"]').click(); await p.wait(60);
  const set = (id, v) => { const e = p.d.getElementById(id); e.value = v; e.dispatchEvent(new p.w.Event("input", { bubbles: true })); };
  set("s-age", "40"); await p.wait(60);
  assert.deepEqual(arabicLeft(p.d), []);
  assert.match(p.d.getElementById("s-bracket").textContent, /Adult/);
});

test("setup, real-name task: no choices, shows the account data, starts without gender / name in the request", async () => {
  const p = await load("talent-setup.html", { storage, search: "?taskId=task1&leaderId=L1", routes: setupRoutes(TASK({ identity_mode: "real" })) });
  assert.equal(p.d.getElementById("tab-fake-name").classList.contains("hidden"), true);
  const txt = p.d.getElementById("my-data").textContent;
  assert.ok(/Sara Hassan/.test(txt) && /أنثى/.test(txt) && /34/.test(txt) && /بالغ/.test(txt), txt);
  assert.equal(p.d.getElementById("start-btn").disabled, false);
  p.d.getElementById("start-btn").click(); await p.wait();
  const c = p.calls.find((x) => /talent\/sessions$/.test(x.path) && x.method === "POST");
  assert.deepEqual(c.body, { taskId: "task1", leaderId: "L1" });
});

test("setup, fake-name task: the button waits for a name; only the name is sent", async () => {
  const p = await load("talent-setup.html", { storage, search: "?taskId=task1&leaderId=L1", routes: setupRoutes(TASK()) });
  const sel = p.d.getElementById("fake-name-select");
  assert.deepEqual([...sel.options].map((o) => o.value), ["Fox", "Owl"]);
  assert.ok(p.calls.some((c) => /fake-names\?gender=female/.test(c.path)), "asks for the names of HER gender");
  sel.value = "Owl"; sel.dispatchEvent(new p.w.Event("change"));
  p.d.getElementById("start-btn").click(); await p.wait();
  assert.deepEqual(p.calls.find((x) => /talent\/sessions$/.test(x.path)).body, { taskId: "task1", leaderId: "L1", fakeName: "Owl" });
});

test("setup: no names left -> the button stays disabled", async () => {
  const p = await load("talent-setup.html", { storage, search: "?taskId=task1&leaderId=L1", routes: setupRoutes(TASK(), { names: [] }) });
  assert.equal(p.d.getElementById("start-btn").disabled, true);
});

test("setup: her own gender is full -> 'full' and the button is disabled; boys' places do not matter", async () => {
  const slots = [{ gender: "female", ageBracket: "", max: 2, used: 2, remaining: 0, full: true }, { gender: "male", ageBracket: "", max: 5, used: 0, remaining: 5, full: false }];
  const p = await load("talent-setup.html", { storage, search: "?taskId=task1&leaderId=L1", routes: setupRoutes(TASK({ identity_mode: "real", limited: true, slots })) });
  assert.equal(p.d.getElementById("start-btn").disabled, true);
  assert.match(p.d.getElementById("slot-note").textContent, /تم الاكتفاء/);
});

test("setup: with age groups, only HER group counts", async () => {
  const slots = [{ gender: "female", ageBracket: "adult", max: 3, used: 1, remaining: 2, full: false }, { gender: "female", ageBracket: "child", max: 3, used: 3, remaining: 0, full: true }];
  const p = await load("talent-setup.html", { storage, search: "?taskId=task1&leaderId=L1", routes: setupRoutes(TASK({ identity_mode: "real", use_age_brackets: true, limited: true, slots })) });
  assert.equal(p.d.getElementById("start-btn").disabled, false);
  assert.match(p.d.getElementById("slot-note").textContent, /متبقي\s*2/);
  const kid = { ...ME, age: 10, age_bracket: "child" };
  const q = await load("talent-setup.html", { storage: { ...storage, studio_talent_user: JSON.stringify(kid) }, search: "?taskId=task1&leaderId=L1", routes: setupRoutes(TASK({ identity_mode: "real", use_age_brackets: true, limited: true, slots }), { me: kid }) });
  assert.equal(q.d.getElementById("start-btn").disabled, true);
});

test("setup: a server refusal (someone took the last place) is shown", async () => {
  const p = await load("talent-setup.html", { storage, search: "?taskId=task1&leaderId=L1", routes: setupRoutes(TASK({ identity_mode: "real" }), { start: () => ({ status: 409, body: { error: "تم الاكتفاء من البنات", code: "QUOTA_FULL" } }) }) });
  p.d.getElementById("start-btn").click(); await p.wait();
  assert.match(p.d.getElementById("final-error").textContent, /الاكتفاء/);
});

test("setup: an old account without gender / age is told to make a new one", async () => {
  const old = { id: "t0", name: "Old", email: "o@x.com" };
  const p = await load("talent-setup.html", { storage: { studio_talent_token: "tok", studio_talent_user: JSON.stringify(old) }, search: "?taskId=task1&leaderId=L1", routes: setupRoutes(TASK(), { me: old }) });
  assert.match(p.d.getElementById("final-error").textContent, /حساب جديد/);
  assert.equal(p.d.getElementById("relogin-btn").classList.contains("hidden"), false);
  assert.equal(p.d.getElementById("start-btn").classList.contains("hidden"), true);
});

test("setup in English: nothing Arabic is left (real-name and fake-name tasks, and the refusal message)", async () => {
  for (const identity of ["real", "names"]) {
    const p = await load("talent-setup.html", { lang: "en", storage, search: "?taskId=task1&leaderId=L1", routes: setupRoutes(TASK({ identity_mode: identity, limited: true, slots: [{ gender: "female", ageBracket: "", max: 5, used: 1, remaining: 4, full: false }] })) });
    await p.wait(100);
    assert.deepEqual(arabicLeft(p.d), [], identity);
  }
  const p = await load("talent-setup.html", { lang: "en", storage, search: "?taskId=task1&leaderId=L1", routes: setupRoutes(TASK({ identity_mode: "real" }), { start: () => ({ status: 409, body: { error: "حسابك ناقص بيانات (النوع والسن). اعمل حساب جديد ببياناتك وجرّب تاني." } }) }) });
  p.d.getElementById("start-btn").click(); await p.wait(120);
  assert.deepEqual(arabicLeft(p.d), []);
});
