// v9 screens: scripts for boys / girls, codes split by gender and age group.
const test = require("node:test"), assert = require("node:assert");
const { load, arabicLeft } = require("./ui-helper");
const HL = { studio_token: "tok", studio_role: "head_leader", studio_user: JSON.stringify({ id: "h", name: "Head" }) };
const SETTINGS = { sampleRate: 16000, bitDepth: 16, format: "wav", channels: "mono" };

const fileList = (w, names) => names.map((n) => new w.File(["x"], n, { type: "text/plain" }));
const setFiles = (w, el, files) => Object.defineProperty(el, "files", { value: files, configurable: true });
const entries = (form) => [...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : v.name]);
const field = (form, k) => form.get(k);

async function publishPage(created, { lang = "ar", brackets = false } = {}) {
  const p = await load("publish-task.html", { lang, storage: HL, routes: [
    [/headleader\/leaders$/, () => ({ status: 200, body: [] })],
    [/headleader\/tasks$/, () => ({ status: 201, body: { limited: false, slots: [], rework_hours: 12, recording_settings: SETTINGS, ...created } })],
    [/headleader\/tasks\/T1\/scripts$/, (u, o) => ({ status: 200, body: { added: 2, scriptCount: 3, byGender: { male: 2, female: 1, any: 0 } } })],
    [/headleader\/tasks\/T1\/codes$/, () => ({ status: 200, body: { male: 5, female: 3, skipped: 0, byBracket: { male: { child: 2, adult: 3, elderly: 0 }, female: null } } })],
    [/headleader\/tasks\/T1$/, () => ({ status: 200, body: { task: { id: "T1", ...created }, samples: [], leaders: [], scripts: [] } })],
  ] });
  p.d.getElementById("t-title").value = "Task";
  p.d.getElementById("t-script-mode").value = created.script_mode || "shared";
  p.d.getElementById("t-identity-mode").value = created.identity_mode;
  p.d.getElementById("t-direct").checked = true;
  if (brackets) p.d.getElementById("t-brackets").checked = true;
  p.d.getElementById("step1-btn").click(); await p.wait(250);
  return p;
}

test("publish: scripts split — boys' files and girls' files go up as two uploads with the right gender", async () => {
  const p = await publishPage({ id: "T1", script_mode: "per_person", identity_mode: "real", direct: true });
  assert.equal(p.d.getElementById("script-multi-box").classList.contains("hidden"), false);
  assert.equal(p.d.getElementById("scripts-split-box").classList.contains("hidden"), true, "split inputs are hidden until chosen");
  const sel = p.d.getElementById("t-scripts-for"); sel.value = "split"; sel.dispatchEvent(new p.w.Event("change"));
  assert.equal(p.d.getElementById("scripts-split-box").classList.contains("hidden"), false);
  assert.equal(p.d.getElementById("scripts-any-box").classList.contains("hidden"), true);
  setFiles(p.w, p.d.getElementById("t-scripts-files-male"), fileList(p.w, ["b1.txt", "b2.txt"]));
  setFiles(p.w, p.d.getElementById("t-scripts-files-female"), fileList(p.w, ["g1.txt"]));
  p.d.getElementById("scripts-upload-btn").click(); await p.wait(250);
  const ups = p.calls.filter((c) => /T1\/scripts$/.test(c.path) && c.method === "POST");
  assert.equal(ups.length, 2);
  assert.deepEqual([field(ups[0].body, "gender"), field(ups[0].body, "mode")], ["male", "replace_all"]);
  assert.deepEqual(entries(ups[0].body).filter(([k]) => k === "files").map(([, n]) => n), ["b1.txt", "b2.txt"]);
  assert.deepEqual([field(ups[1].body, "gender"), field(ups[1].body, "mode")], ["female", "append"]);
  assert.match(p.d.getElementById("scripts-success").textContent, /3/);
  assert.match(p.d.getElementById("scripts-success").textContent, /ولاد/);
});

test("publish: scripts for anybody still upload as one 'any' upload (the old behaviour)", async () => {
  const p = await publishPage({ id: "T1", script_mode: "per_person", identity_mode: "real", direct: true });
  setFiles(p.w, p.d.getElementById("t-scripts-files"), fileList(p.w, ["a.txt", "b.txt"]));
  p.d.getElementById("scripts-upload-btn").click(); await p.wait(250);
  const ups = p.calls.filter((c) => /T1\/scripts$/.test(c.path) && c.method === "POST");
  assert.equal(ups.length, 1);
  assert.deepEqual([field(ups[0].body, "gender"), field(ups[0].body, "mode")], ["any", "replace_all"]);
});

test("publish: codes — plain boys/girls lists; the age-group option only appears when the task uses age groups", async () => {
  let p = await publishPage({ id: "T1", identity_mode: "codes", direct: true, use_age_brackets: false });
  assert.equal(p.d.getElementById("codes-split-row").classList.contains("hidden"), true);
  setFiles(p.w, p.d.getElementById("t-codes-male"), fileList(p.w, ["m.txt"]));
  setFiles(p.w, p.d.getElementById("t-codes-female"), fileList(p.w, ["f.txt"]));
  p.d.getElementById("codes-upload-btn").click(); await p.wait(250);
  const up = p.calls.find((c) => /T1\/codes$/.test(c.path) && c.method === "POST");
  assert.deepEqual(entries(up.body).filter(([k]) => k !== "mode").map(([k]) => k).sort(), ["female", "male"]);
  assert.equal(field(up.body, "mode"), "replace");
});

test("publish: codes split by age group send the 'gender_agegroup' fields", async () => {
  const p = await publishPage({ id: "T1", identity_mode: "codes", direct: true, use_age_brackets: true }, { brackets: true });
  assert.equal(p.d.getElementById("codes-split-row").classList.contains("hidden"), false);
  const cb = p.d.getElementById("t-codes-split"); cb.checked = true; cb.dispatchEvent(new p.w.Event("change"));
  assert.equal(p.d.getElementById("codes-plain-box").classList.contains("hidden"), true);
  assert.equal(p.d.getElementById("codes-split-box").classList.contains("hidden"), false);
  setFiles(p.w, p.d.getElementById("t-codes-male_adult"), fileList(p.w, ["ma.txt"]));
  setFiles(p.w, p.d.getElementById("t-codes-male_child"), fileList(p.w, ["mc.txt"]));
  setFiles(p.w, p.d.getElementById("t-codes-female_elderly"), fileList(p.w, ["fe.txt"]));
  setFiles(p.w, p.d.getElementById("t-codes-male"), fileList(p.w, ["ignored.txt"]));      // hidden plain inputs are not sent
  p.d.getElementById("codes-upload-btn").click(); await p.wait(250);
  const up = p.calls.find((c) => /T1\/codes$/.test(c.path) && c.method === "POST");
  assert.deepEqual(entries(up.body).filter(([k]) => k !== "mode").map(([k]) => k).sort(), ["female_elderly", "male_adult", "male_child"]);
  assert.match(p.d.getElementById("codes-success").textContent, /5/);
  assert.match(p.d.getElementById("codes-success").textContent, /أطفال/);
});

// ----------------------------------------------------------------------------------------------- edit page
const DETAIL = (over = {}) => ({
  task: { id: "T1", title: "Task", status: "published", script_mode: "per_person", identity_mode: "codes", direct: true, use_age_brackets: true, limited: true, slots: [],
    rework_hours: 12, scripts_total: 4, scripts_left: 3,
    scripts_by_gender: { male: { total: 2, left: 2 }, female: { total: 1, left: 0 }, any: { total: 1, left: 1 } },
    codes_total: { male: 5, female: 2 }, codes_left: { male: 4, female: 2 },
    codes_by_bracket: { male: { child: { total: 2, left: 2 }, adult: { total: 3, left: 2 }, elderly: { total: 0, left: 0 } }, female: null },
    recording_settings: SETTINGS, ...(over.task || {}) },
  samples: [], leaders: [], qa: [], leaderQuotas: [], leaderSlots: {},
  scripts: [
    { id: "s1", position: 0, filename: "b1.txt", gender: "male", sentence_count: 3, taken: false },
    { id: "s2", position: 1, filename: "b2.txt", gender: "male", sentence_count: 3, taken: true },
    { id: "s3", position: 2, filename: "g1.txt", gender: "female", sentence_count: 3, taken: true },
    { id: "s4", position: 3, filename: "any.txt", gender: null, sentence_count: 3, taken: false },
  ], ...over.rest });
async function editPage(lang = "ar", over = {}) {
  return load("edit-task.html", { lang, storage: HL, search: "?id=T1", routes: [
    [/headleader\/leaders$/, () => ({ status: 200, body: [] })],
    [/headleader\/tasks\/T1\/scripts\/assign$/, () => ({ status: 200, body: { updated: 2 } })],
    [/headleader\/tasks\/T1\/scripts$/, () => ({ status: 200, body: { added: 1 } })],
    [/headleader\/tasks\/T1\/codes$/, () => ({ status: 200, body: { male: 6, female: 2, skipped: 1 } })],
    [/headleader\/tasks\/T1$/, () => ({ status: 200, body: DETAIL(over) })],
  ] });
}

test("edit: the scripts list shows who each script is for, and only free scripts can be ticked", async () => {
  const p = await editPage();
  const list = p.d.getElementById("scripts-list");
  assert.equal(list.querySelectorAll("input[data-pick-script]").length, 2, "the two held scripts have no tick box");
  assert.match(list.textContent, /للولاد/); assert.match(list.textContent, /للبنات/); assert.match(list.textContent, /لأي حد/);
  assert.match(p.d.getElementById("scripts-summary").textContent, /2 \/ 2/);
});

test("edit: tick scripts -> 'for girls' sends the ids and the gender", async () => {
  const p = await editPage();
  p.d.getElementById("scripts-pick-all").checked = true; p.d.getElementById("scripts-pick-all").dispatchEvent(new p.w.Event("change"));
  assert.match(p.d.getElementById("scripts-picked").textContent, /2/);
  p.d.querySelector('button[data-assign="female"]').click(); await p.wait(200);
  const c = p.calls.find((x) => /scripts\/assign$/.test(x.path));
  assert.deepEqual(c.body, { scriptIds: ["s1", "s4"], gender: "female" });
  // nothing ticked -> refused in the browser
  const n = p.calls.length;
  p.d.querySelector('button[data-assign="male"]').click(); await p.wait(100);
  assert.equal(p.calls.filter((x) => /assign$/.test(x.path)).length, 1);
  assert.ok(p.d.getElementById("scripts-error").textContent.length > 0);
});

test("edit: new scripts are uploaded for the chosen gender", async () => {
  const p = await editPage();
  p.d.getElementById("add-scripts-for").value = "female";
  setFiles(p.w, p.d.getElementById("add-scripts-files"), fileList(p.w, ["new.txt"]));
  p.d.getElementById("add-scripts-btn").click(); await p.wait(200);
  const c = p.calls.find((x) => /T1\/scripts$/.test(x.path) && x.method === "POST");
  assert.deepEqual([field(c.body, "gender"), field(c.body, "mode")], ["female", "append"]);
});

test("edit: codes summary shows each age group; split upload + 'replace' are sent", async () => {
  const p = await editPage();
  const sum = p.d.getElementById("codes-summary").textContent;
  assert.match(sum, /بالغين/); assert.match(sum, /2 \/ 3/);
  assert.equal(p.d.getElementById("codes-split-card").classList.contains("hidden"), false);
  setFiles(p.w, p.d.getElementById("add-codes-female_adult"), fileList(p.w, ["fa.txt"]));
  p.d.getElementById("add-codes-replace").checked = true;
  p.d.getElementById("add-codes-btn").click(); await p.wait(200);
  const c = p.calls.find((x) => /T1\/codes$/.test(x.path) && x.method === "POST");
  assert.deepEqual(entries(c.body).sort(), [["female_adult", "fa.txt"], ["mode", "replace"]].sort());
});

test("edit: without age groups on the task, the age-group code boxes stay hidden", async () => {
  const p = await editPage("ar", { task: { use_age_brackets: false, codes_by_bracket: { male: null, female: null } } });
  assert.equal(p.d.getElementById("codes-split-card").classList.contains("hidden"), true);
});

// ----------------------------------------------------------------------------------------------- talent setup
test("setup: a codes task asks only for the codes of HIS gender and age group", async () => {
  const ME = { id: "t1", name: "Omar Ali", email: "o@x.com", gender: "male", age: 70, age_bracket: "elderly" };
  const p = await load("talent-setup.html", { search: "?taskId=task1", storage: { studio_talent_token: "tok", studio_talent_user: JSON.stringify(ME) }, routes: [
    [/\/auth\/me$/, () => ({ status: 200, body: { user: ME } })],
    [/\/talent\/tasks\/task1\/fake-names/, () => ({ status: 200, body: ["E1", "E2"] })],
    [/\/talent\/tasks\/task1$/, () => ({ status: 200, body: { task: { id: "task1", title: "T", direct: true, identity_mode: "codes", use_age_brackets: true, limited: false, slots: [] }, leaders: [], leaderSlots: {} } })],
  ] });
  await p.wait(200);
  assert.ok(p.calls.some((c) => /fake-names\?gender=male&bracket=elderly$/.test(c.path)), p.calls.map((c) => c.path).join(" | "));
});

// ----------------------------------------------------------------------------------------------- English
test("English: no Arabic left on the new states (publish split scripts/codes, edit page)", async () => {
  let p = await publishPage({ id: "T1", script_mode: "per_person", identity_mode: "codes", direct: true, use_age_brackets: true }, { lang: "en", brackets: true });
  const sel = p.d.getElementById("t-scripts-for"); sel.value = "split"; sel.dispatchEvent(new p.w.Event("change"));
  const cb = p.d.getElementById("t-codes-split"); cb.checked = true; cb.dispatchEvent(new p.w.Event("change"));
  setFiles(p.w, p.d.getElementById("t-scripts-files-male"), fileList(p.w, ["b1.txt"]));
  setFiles(p.w, p.d.getElementById("t-codes-male_adult"), fileList(p.w, ["ma.txt"]));
  p.d.getElementById("scripts-upload-btn").click(); await p.wait(250);
  p.d.getElementById("codes-upload-btn").click(); await p.wait(250);
  const _l = arabicLeft(p.d); if (_l.length) console.log("MISSING publish:", JSON.stringify(_l)); assert.deepEqual(_l, [], "publish page");
  p = await editPage("en");
  p.d.getElementById("scripts-pick-all").checked = true; p.d.getElementById("scripts-pick-all").dispatchEvent(new p.w.Event("change"));
  await p.wait(100);
  const _m = arabicLeft(p.d); if (_m.length) console.log("MISSING edit:", JSON.stringify(_m)); assert.deepEqual(_m, [], "edit page");
});
