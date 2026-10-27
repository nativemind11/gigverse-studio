const test = require("node:test"), assert = require("node:assert");
const { load, arabicLeft } = require("./ui-helper");
const HL = { studio_token: "tok", studio_role: "head_leader", studio_user: JSON.stringify({ id: "h", name: "Head" }) };

test("sanity: the Arabic detector sees Arabic in AR mode", async () => {
  const p = await load("talent-login.html", {});
  assert.ok(arabicLeft(p.d).length > 3);
});

test("publish page: 'real names' option -> step 2 shows no names / codes upload, and step 2 opens once the script is in", async () => {
  const created = { id: "T1", title: "R", script_mode: "shared", identity_mode: "real", direct: true, limited: false, slots: [], rework_hours: 12, recording_settings: { sampleRate: 16000, bitDepth: 16, format: "wav", channels: "mono" } };
  const p = await load("publish-task.html", { storage: HL, routes: [
    [/headleader\/leaders$/, () => ({ status: 200, body: [] })],
    [/headleader\/tasks$/, (u, o) => ({ status: 201, body: created })],
  ] });
  const sel = p.d.getElementById("t-identity-mode");
  assert.ok([...sel.options].some((o) => o.value === "real"));
  sel.value = "real"; p.d.getElementById("t-direct").checked = true;
  p.d.getElementById("t-title").value = "R";
  const btn = p.d.getElementById("step1-btn"); btn.click(); await p.wait(200);
  const create = p.calls.find((c) => /headleader\/tasks$/.test(c.path) && c.method === "POST");
  assert.equal(create.body.identityMode, "real");
  assert.equal(p.d.getElementById("step-2").classList.contains("hidden"), false);
  assert.equal(p.d.getElementById("identity-names-box").classList.contains("hidden"), true);
  assert.equal(p.d.getElementById("identity-codes-box").classList.contains("hidden"), true);
});

test("publish + edit pages: inline scripts compile (no syntax slip)", () => {
  const fs = require("fs");
  for (const f of ["publish-task.html", "edit-task.html", "talent-login.html", "talent-setup.html"]) {
    const html = fs.readFileSync(require("path").join(__dirname, "..", f), "utf8");
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(scripts.length >= 1, f);
    for (const s of scripts) new Function(s);
  }
});
