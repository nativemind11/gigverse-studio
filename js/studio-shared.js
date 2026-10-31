// Studio — shared auth/API helpers. Completely separate token
// storage from the main site's js/shared.js (different localStorage keys),
// so being logged into the main site and the Studio are two independent
// sessions, exactly as designed.
(function () {
  const API_BASE_URL = window.STUDIO_CONFIG.apiBase;

  function authToken() { return localStorage.getItem("studio_token"); }
  function currentUser() {
    const raw = localStorage.getItem("studio_user");
    return raw ? JSON.parse(raw) : null;
  }
  function currentRole() { return localStorage.getItem("studio_role"); }

  function saveSession(token, studioRole, user) {
    localStorage.setItem("studio_token", token);
    localStorage.setItem("studio_role", studioRole);
    localStorage.setItem("studio_user", JSON.stringify(user));
  }

  function logout() {
    localStorage.removeItem("studio_token");
    localStorage.removeItem("studio_role");
    localStorage.removeItem("studio_user");
  }

  // fetch() that turns a dead network into a readable message instead of the browser's "Failed to fetch"
  async function safeFetch(url, opts) {
    try { return await fetch(url, opts); }
    catch (_) { throw new Error("تعذر الاتصال بالسيرفر. اتأكد من اتصالك بالنت وحاول تاني."); }
  }

  async function apiFetch(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = authToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    } catch (err) {
      throw new Error("تعذر الاتصال بالسيرفر. اتأكد من اتصالك بالنت وحاول تاني.");
    }
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) { const e = new Error((data && data.error) || "حصل خطأ غير متوقع."); e.status = res.status; throw e; }
    return data;
  }

  async function login(email, password, studioRole) {
    const data = await apiFetch("/api/studio/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, studioRole }),
    });
    saveSession(data.token, data.studioRole, data.user);
    return data;
  }

  async function refreshMe() {
    const data = await apiFetch("/api/studio/auth/me");
    localStorage.setItem("studio_user", JSON.stringify(data.user));
    return data;
  }

  // Every dashboard page calls this first: bounces to login if there's no
  // session, or if the session isn't for the role that page is meant for.
  function requireStudioRole(expectedRole) {
    const role = currentRole();
    if (!authToken() || !role) { location.href = rel("login.html"); return null; }
    if (expectedRole && role !== expectedRole) { location.href = rel("login.html"); return null; }
    return currentUser();
  }

  // Same trick as the main site's shared.js: pages live at the site root, so a relative link works.
  function rel(path) { return path; }

  // ---- head_leader: tasks -------------------------------------------
  function apiCreateTask(payload) {
    return apiFetch("/api/studio/headleader/tasks", { method: "POST", body: JSON.stringify(payload) });
  }

  async function apiUploadFile(path, file, extraFields) {
    const form = new FormData();
    form.append("file", file);
    Object.entries(extraFields || {}).forEach(([k, v]) => form.append(k, v));
    const headers = {};
    const token = authToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await safeFetch(`${API_BASE_URL}${path}`, { method: "POST", headers, body: form });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((data && data.error) || "تعذر رفع الملف");
    return data;
  }

  // several files in one request (v3): scripts = one .txt per talent, codes = a boys list and a girls list
  async function apiUploadMany(path, fields, extraFields) {
    const form = new FormData();
    fields.forEach(([name, file]) => form.append(name, file));
    Object.entries(extraFields || {}).forEach(([k, v]) => form.append(k, v));
    const headers = {};
    const token = authToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await safeFetch(`${API_BASE_URL}${path}`, { method: "POST", headers, body: form });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((data && data.error) || "تعذر رفع الملفات");
    return data;
  }
  // gender (v9): "any" (default) | "male" | "female" = who the uploaded scripts are for.
  // mode: "append" | "replace" (only the scripts of that gender group) | "replace_all" (every script of the task)
  function apiUploadScripts(taskId, files, mode, gender) {
    return apiUploadMany(`/api/studio/headleader/tasks/${taskId}/scripts`, Array.from(files).map((f) => ["files", f]), { mode: mode || "append", gender: gender || "any" });
  }
  // decide who ALREADY uploaded scripts are for: gender = "male" | "female" | "any"
  function apiAssignScripts(taskId, scriptIds, gender) {
    return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(taskId)}/scripts/assign`, { method: "POST", body: JSON.stringify({ scriptIds, gender }) });
  }
  // lists = { male, female } (plain lists) and/or { male_child, male_adult, male_elderly, female_child, female_adult, female_elderly } (split by age group)
  const CODE_LIST_KEYS = ["male", "female", "male_child", "male_adult", "male_elderly", "female_child", "female_adult", "female_elderly"];
  function apiUploadCodes(taskId, lists, mode) {
    const fields = CODE_LIST_KEYS.filter((k) => lists[k]).map((k) => [k, lists[k]]);
    return apiUploadMany(`/api/studio/headleader/tasks/${taskId}/codes`, fields, { mode: mode || "replace" });
  }
  function apiUploadFakeNames(taskId, file) {
    return apiUploadFile(`/api/studio/headleader/tasks/${taskId}/fake-names`, file);
  }
  function apiUploadScript(taskId, file) {
    return apiUploadFile(`/api/studio/headleader/tasks/${taskId}/script`, file);
  }
  function apiUploadSampleAudio(taskId, sampleId, file, duration) {
    return apiUploadFile(`/api/studio/headleader/tasks/${taskId}/samples/${sampleId}/audio`, file, duration ? { duration } : {});
  }
  function apiUploadBulkSampleAudio(taskId, sampleIds, file, duration) {
    const extra = { sampleIds: JSON.stringify(sampleIds) };
    if (duration) extra.duration = duration;
    return apiUploadFile(`/api/studio/headleader/tasks/${taskId}/samples/bulk-audio`, file, extra);
  }
  function apiPublishTask(taskId) {
    return apiFetch(`/api/studio/headleader/tasks/${taskId}/publish`, { method: "POST" });
  }
  function apiCreateQaReviewer(payload) {
    return apiFetch("/api/studio/headleader/qa-reviewers", { method: "POST", body: JSON.stringify(payload) });
  }
  function apiGetQaReviewers() {
    return apiFetch("/api/studio/headleader/qa-reviewers");
  }
  function apiGetLeaders() {
    return apiFetch("/api/studio/headleader/leaders");
  }
  function apiGetMyTasks() {
    return apiFetch("/api/studio/headleader/tasks");
  }
  function apiGetTaskDetail(taskId) {
    return apiFetch(`/api/studio/headleader/tasks/${taskId}`);
  }

  // ---- qa: review queue -----------------------------------------------
  function apiGetPendingReviews() { return apiFetch("/api/studio/qa/pending"); }
  function apiGetReviewDetail(sessionId) { return apiFetch(`/api/studio/qa/sessions/${sessionId}`); }
  function apiApproveSession(sessionId) {
    return apiFetch(`/api/studio/qa/sessions/${sessionId}/approve`, { method: "POST" });
  }
  function apiRejectAllSession(sessionId, reason) {
    return apiFetch(`/api/studio/qa/sessions/${sessionId}/reject-all`, {
      method: "POST", body: JSON.stringify({ reason }),
    });
  }
  function apiSubmitReview(sessionId, decisions) {
    return apiFetch(`/api/studio/qa/sessions/${sessionId}/review`, {
      method: "POST", body: JSON.stringify({ decisions }),
    });
  }
  // A plain <audio src="..."> can't send an Authorization header, and this
  // endpoint needs one (it's QA-only) — so we fetch it ourselves with the
  // token attached and hand back a blob: URL the <audio> tag CAN use.
  async function qaFetchSampleAudioUrl(sessionSampleId) {
    const token = authToken();
    const res = await safeFetch(`${API_BASE_URL}/api/studio/qa/samples/${sessionSampleId}/audio`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("تعذر تحميل التسجيل الصوتي");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }


  // ---- head leader: delivery to the buyer -----------------------------
  function apiGetPendingDelivery() { return apiFetch("/api/studio/delivery/pending"); }
  function apiGetDeliveredBatches() { return apiFetch("/api/studio/delivery/delivered"); }
  // Opens the big ZIP: asks the server for a (signed) link, then opens it in a new tab.
  // Done in a click handler so the new tab isn't blocked as a popup.
  async function openBatchZip(batchId) {
    const win = window.open("", "_blank");
    try {
      const { url } = await apiFetch(`/api/studio/delivery/batches/${encodeURIComponent(batchId)}/download`);
      if (win) win.location.href = url; else window.location.href = url;
    } catch (err) { if (win) win.close(); throw err; }
  }
  function apiGetStorage() { return apiFetch("/api/studio/delivery/storage"); }
  function apiMarkDownloaded(batchId, downloaded) {
    return apiFetch(`/api/studio/delivery/batches/${encodeURIComponent(batchId)}/downloaded`, { method: "POST", body: JSON.stringify({ downloaded: downloaded !== false }) });
  }
  const J = (method, body) => ({ method, body: JSON.stringify(body || {}) });
  function apiGetTask(id) { return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(id)}`); }
  function apiUpdateTask(id, body) { return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(id)}`, J("PATCH", body)); }
  function apiUpdateQuotas(id, body) { return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(id)}/quotas`, J("PUT", body)); }
  // v4: how many boys / girls EACH leader may bring. body: { leaderQuotas: [{ leaderId, quotas: [{ gender, ageBracket, max }] }], useAgeBrackets? }
  function apiUpdateLeaderQuotas(id, body) { return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(id)}/leader-quotas`, J("PUT", body)); }
  function apiAddTaskLeader(id, leaderId) { return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(id)}/leaders`, J("POST", { leaderId })); }
  function apiDeleteTask(id, confirm) { return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(id)}`, J("DELETE", { confirm })); }
  function apiRemoveTaskLeader(id, leaderId) { return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(id)}/leaders/${encodeURIComponent(leaderId)}`, { method: "DELETE" }); }
  function apiUpdateSample(id, sampleId, sentenceName) { return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(id)}/samples/${encodeURIComponent(sampleId)}`, J("PATCH", { sentenceName })); }
  function apiDeleteScript(id, scriptId) { return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(id)}/scripts/${encodeURIComponent(scriptId)}`, { method: "DELETE" }); }
  function apiCreateLeader(body) { return apiFetch("/api/studio/headleader/leaders", J("POST", body)); }
  function apiUpdateLeader(id, body) { return apiFetch(`/api/studio/headleader/leaders/${encodeURIComponent(id)}`, J("PATCH", body)); }
  function apiQaStats() { return apiFetch("/api/studio/headleader/qa-stats"); }
  function apiDriveStatus() { return apiFetch("/api/studio/drive/status"); }
  function apiDriveConnectUrl() { return apiFetch("/api/studio/drive/connect-url"); }
  function apiLeaderOverview() { return apiFetch("/api/studio/leader/overview"); }
  function apiFinalizeInfo(taskId) { return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(taskId)}/finalize`); }
  function apiFinalizeRun(taskId) { return apiFetch(`/api/studio/headleader/tasks/${encodeURIComponent(taskId)}/finalize`, { method: "POST", body: "{}" }); }
  function apiPurgeStorage(mode) { return apiFetch("/api/studio/delivery/storage/purge", { method: "POST", body: JSON.stringify({ mode }) }); }
  function apiCollectGroup(group) {
    return apiFetch("/api/studio/delivery/collect", { method: "POST", body: JSON.stringify(group) });
  }
  // Downloads need the Authorization header, which a plain <a href> can't
  // send — so fetch the file ourselves and save it from a blob: URL.
  async function downloadWithAuth(path, filename) {
    const token = authToken();
    const res = await safeFetch(`${API_BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      let msg = "تعذر تحميل الملف";
      try { msg = (await res.json()).error || msg; } catch (_) {}
      throw new Error(msg);
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function downloadGroupSheet(group, filename) {
    const q = new URLSearchParams({ taskId: group.taskId, gender: group.gender, qaReviewerId: group.qaReviewerId || "none", day: group.day });
    return downloadWithAuth(`/api/studio/delivery/sheet?${q}`, filename);
  }
  function downloadBatchSheet(batchId, filename) {
    return downloadWithAuth(`/api/studio/delivery/batches/${batchId}/sheet`, filename);
  }


  // ---- company feedback (Phase 7) --------------------------------------
  // The spreadsheet travels with every step, the mapping rides along as fields.
  function apiFeedbackParse(file, taskId) { return apiUploadFile("/api/studio/feedback/parse", file, taskId ? { taskId } : undefined); }
  function apiFeedbackPreview(file, mapping) { return apiUploadFile("/api/studio/feedback/preview", file, mapping); }
  function apiFeedbackApply(file, mapping) { return apiUploadFile("/api/studio/feedback/apply", file, mapping); }
  function apiFeedbackItems(taskId) {
    return apiFetch(`/api/studio/feedback/items${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ""}`);
  }
  function apiMyFeedback() { return apiFetch("/api/studio/feedback/mine"); }
  // v7: the feedback page (task -> file -> person), collecting the rework, the delivered rework
  const qTask = (taskId) => (taskId ? `?taskId=${encodeURIComponent(taskId)}` : "");
  // ---- company acceptance (القبول من الشركة) ----
  function apiAcceptanceParse(file, taskId) { return apiUploadFile("/api/studio/acceptance/parse", file, taskId ? { taskId } : undefined); }
  function apiAcceptancePreview(file, mapping) { return apiUploadFile("/api/studio/acceptance/preview", file, mapping); }
  function apiAcceptanceApply(file, mapping) { return apiUploadFile("/api/studio/acceptance/apply", file, mapping); }
  function apiAcceptanceBoard() { return apiFetch("/api/studio/acceptance/board"); }
  function apiAcceptanceTask(taskId) { return apiFetch(`/api/studio/acceptance/tasks/${encodeURIComponent(taskId)}`); }
  function apiAcceptanceDeleteFile(fileId) { return apiFetch(`/api/studio/acceptance/files/${encodeURIComponent(fileId)}`, { method: "DELETE" }); }
  function apiAcceptanceRemove(sessionId) { return apiFetch(`/api/studio/acceptance/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }); }
  function apiFeedbackBoard(taskId) { return apiFetch(`/api/studio/feedback/board${qTask(taskId)}`); }
  function apiFeedbackDelivered(taskId) { return apiFetch(`/api/studio/feedback/delivered${qTask(taskId)}`); }
  function apiFeedbackCollect(fileId, gender) {
    return apiFetch(`/api/studio/feedback/files/${encodeURIComponent(fileId)}/collect`, { method: "POST", body: JSON.stringify({ gender }) });
  }
  function downloadFeedbackSheet(fileId, filename) { return downloadWithAuth(`/api/studio/feedback/files/${encodeURIComponent(fileId)}/sheet`, filename); }
  function downloadReworkBatchSheet(batchId, filename) { return downloadWithAuth(`/api/studio/feedback/batches/${encodeURIComponent(batchId)}/sheet`, filename); }

  // "باقي 7 ساعات و 20 دقيقة" / "المهلة خلصت من 3 ساعات"
  function timeLeft(iso) {
    if (!iso) return { text: "", overdue: false };
    const ms = new Date(iso).getTime() - Date.now();
    const abs = Math.abs(ms);
    const h = Math.floor(abs / 3600000), m = Math.floor((abs % 3600000) / 60000);
    const span = h ? `${h} ساعة${m ? ` و ${m} دقيقة` : ""}` : `${Math.max(m, 1)} دقيقة`;
    return ms >= 0 ? { text: `باقي ${span}`, overdue: false } : { text: `المهلة خلصت من ${span}`, overdue: true };
  }

  window.NMStudio = {
    authToken, currentUser, currentRole, login, logout,
    apiFetch, refreshMe, requireStudioRole,
    apiCreateTask, apiUploadScript, apiUploadScripts, apiAssignScripts, apiUploadCodes, apiUploadFakeNames, apiUploadSampleAudio, apiUploadBulkSampleAudio, apiPublishTask,
    apiGetMyTasks, apiGetTaskDetail, apiGetLeaders, apiCreateQaReviewer, apiGetQaReviewers,
    apiGetPendingReviews, apiGetReviewDetail, apiApproveSession, apiRejectAllSession,
    apiSubmitReview, qaFetchSampleAudioUrl,
    apiFinalizeInfo, apiFinalizeRun, apiLeaderOverview, apiDriveStatus, apiDriveConnectUrl,
    apiGetTask, apiUpdateTask, apiDeleteTask, apiRemoveTaskLeader, apiUpdateSample, apiDeleteScript, apiUpdateQuotas, apiUpdateLeaderQuotas, apiAddTaskLeader, apiCreateLeader, apiUpdateLeader, apiQaStats,
    apiGetPendingDelivery, apiGetDeliveredBatches, openBatchZip, apiGetStorage, apiMarkDownloaded, apiPurgeStorage, apiCollectGroup, downloadGroupSheet, downloadBatchSheet,
    apiFeedbackParse, apiFeedbackPreview, apiFeedbackApply, apiFeedbackItems, apiMyFeedback, timeLeft,
    apiAcceptanceParse, apiAcceptancePreview, apiAcceptanceApply, apiAcceptanceBoard, apiAcceptanceTask, apiAcceptanceDeleteFile, apiAcceptanceRemove,
    apiFeedbackBoard, apiFeedbackDelivered, apiFeedbackCollect, downloadFeedbackSheet, downloadReworkBatchSheet,
  };
})();
