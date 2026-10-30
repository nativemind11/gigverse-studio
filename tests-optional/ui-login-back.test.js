// The Back-button bug: after a login, going back to the login page showed the old email + password and a button stuck on "logging in".
const test = require("node:test"), assert = require("node:assert");
const { load } = require("./ui-helper");

// what the browser does: show the page again from history (bfcache) -> pageshow with persisted = true
const showAgainFromHistory = (w) => { const e = new w.Event("pageshow"); Object.defineProperty(e, "persisted", { value: true }); w.dispatchEvent(e); };

test("staff login: after a successful login and Back, the form is empty and the button works again", async () => {
  const p = await load("login.html", { routes: [[/auth\/login/, () => ({ status: 200, body: { token: "t", studioRole: "leader", user: { id: "1", name: "L" } } })]] });
  p.d.getElementById("l-email").value = "at@x.com"; p.d.getElementById("l-password").value = "secret123";
  p.d.getElementById("login-form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await p.wait(80);
  const btn = p.d.getElementById("login-btn");
  assert.equal(btn.disabled, true, "still 'logging in' while the browser leaves the page");
  showAgainFromHistory(p.w); await p.wait(200);
  assert.equal(p.d.getElementById("l-email").value, "");
  assert.equal(p.d.getElementById("l-password").value, "");
  assert.equal(btn.disabled, false);
  assert.match(btn.textContent, /دخول/); assert.doesNotMatch(btn.textContent, /جاري/);
});

test("staff login: a normal first visit is left alone (pageshow with persisted = false)", async () => {
  const p = await load("login.html", {});
  p.d.getElementById("l-email").value = "typed@x.com";
  const e = new p.w.Event("pageshow"); Object.defineProperty(e, "persisted", { value: false }); p.w.dispatchEvent(e);
  await p.wait(200);
  assert.equal(p.d.getElementById("l-email").value, "typed@x.com");
});

test("talent login: same fix on both the login and the sign-up forms", async () => {
  const p = await load("talent-login.html", { routes: [[/auth\/login/, () => ({ status: 200, body: { token: "t", studioRole: "talent", user: { id: "1", name: "T" } } })]] });
  p.d.getElementById("l-email").value = "t@x.com"; p.d.getElementById("l-password").value = "secret123";
  p.d.getElementById("login-form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await p.wait(80);
  assert.equal(p.d.getElementById("login-btn").disabled, true);
  p.d.getElementById("s-name").value = "Sara"; p.d.getElementById("s-age").value = "30";
  showAgainFromHistory(p.w); await p.wait(200);
  assert.equal(p.d.getElementById("l-email").value, ""); assert.equal(p.d.getElementById("l-password").value, "");
  assert.equal(p.d.getElementById("s-name").value, ""); assert.equal(p.d.getElementById("s-age").value, "");
  assert.equal(p.d.getElementById("login-btn").disabled, false);
  assert.match(p.d.getElementById("login-btn").textContent, /^دخول$/);
});

test("English mode: the button text after Back is translated, not Arabic", async () => {
  const p = await load("login.html", { lang: "en", routes: [[/auth\/login/, () => ({ status: 200, body: { token: "t", studioRole: "leader", user: {} } })]] });
  p.d.getElementById("l-email").value = "a@x.com"; p.d.getElementById("l-password").value = "secret123";
  p.d.getElementById("login-form").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await p.wait(80); showAgainFromHistory(p.w); await p.wait(250);
  assert.doesNotMatch(p.d.getElementById("login-btn").textContent, /[\u0600-\u06FF]/);
});
