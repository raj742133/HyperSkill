import { localToday, dueInfo, summarize, weekStrip, addDays, weekdayShort, shortDate } from "/due.js";

const $ = (id) => document.getElementById(id);
const state = { user: null, items: [], loading: false, error: null, editingId: null, confirmId: null, mode: "login" };

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) el.append(kid);
  return el;
}

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", "X-Requested-By": "duesoon" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error("Can't reach DueSoon. Check your connection and try again."), { network: true });
  }
  if (res.status === 204) return null;
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const e = json && json.error;
    let message = (e && e.message) || "Something went wrong. Try again.";
    if (e && e.details && e.details.length) message = e.details.map((d) => d.message).join(". ");
    throw Object.assign(new Error(message), { status: res.status, code: e && e.code });
  }
  return json;
}

// After a re-render the focused control is gone; put focus back so keyboard users keep their place.
const focusIn = (id, sel) => { const el = document.querySelector(`.row[data-id="${CSS.escape(id)}"] ${sel}`); if (el) el.focus(); };

const byOrder = (a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id);
const today = () => localToday();

// One h1 for the whole page; its text follows the view (a single-page app should never have two).
function show(which) {
  for (const id of ["boot", "auth", "home"]) $(id).hidden = id !== which;
  $("who").hidden = which !== "home";
  if (which === "home") $("pageTitle").textContent = "Due soon";
  else if (which === "auth") { $("pageTitle").textContent = state.mode === "signup" ? "Create your DueSoon account" : "Sign in to DueSoon"; $("finding").textContent = "See what is due next, and never be surprised by a deadline."; }
  else { $("pageTitle").textContent = "DueSoon"; $("finding").textContent = ""; }
}
function say(text, bad = false, undo = null) {
  const s = $("status");
  s.textContent = text;
  s.classList.toggle("bad", bad);
  if (undo) {
    const b = h("button", { type: "button", class: "text-btn", text: "Undo" });
    b.addEventListener("click", undo);
    s.append(b);
  }
}

/* ---------- auth ---------- */
function setMode(mode) {
  state.mode = mode;
  const signup = mode === "signup";
  $("modeLogin").setAttribute("aria-pressed", String(!signup));
  $("modeSignup").setAttribute("aria-pressed", String(signup));
  $("pageTitle").textContent = signup ? "Create your DueSoon account" : "Sign in to DueSoon";
  $("authSubmit").textContent = signup ? "Create account" : "Sign in";
  $("password").autocomplete = signup ? "new-password" : "current-password";
  $("pwHint").hidden = !signup;
  $("authError").hidden = true;
}
$("modeLogin").addEventListener("click", () => setMode("login"));
$("modeSignup").addEventListener("click", () => setMode("signup"));

$("authForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const err = $("authError");
  err.hidden = true;
  const email = $("email").value.trim();
  const password = $("password").value;
  $("email").removeAttribute("aria-invalid");
  $("password").removeAttribute("aria-invalid");
  if (!email || !email.includes("@")) { fail("Enter a valid email address.", "email"); return; }
  if (state.mode === "signup" && password.length < 10) { fail("Password must be at least 10 characters.", "password"); return; }
  if (!password) { fail("Enter your password.", "password"); return; }
  const btn = $("authSubmit");
  btn.disabled = true;
  try {
    const r = await api("POST", state.mode === "signup" ? "/api/auth/signup" : "/api/auth/login", { email, password });
    $("password").value = "";
    await enter(r.user);
  } catch (e) {
    fail(e.message);
  } finally {
    btn.disabled = false;
  }
  function fail(msg, field) {
    err.textContent = msg;
    err.hidden = false;
    if (field) { $(field).setAttribute("aria-invalid", "true"); $(field).focus(); }
  }
});

$("logout").addEventListener("click", async () => {
  try { await api("POST", "/api/auth/logout"); } catch { /* the cookie is cleared server-side when reachable */ }
  state.user = null; state.items = [];
  show("auth");
  $("email").focus();
});

/* ---------- home ---------- */
async function enter(user) {
  state.user = user;
  $("whoEmail").textContent = user.email;
  $("addDue").value = today();
  show("home");
  await loadAll();
}

async function loadAll() {
  state.loading = true; state.error = null;
  render();
  try {
    const items = [];
    let cursor;
    do {
      const r = await api("GET", `/api/assignments?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      items.push(...r.items);
      cursor = r.nextCursor;
    } while (cursor);
    state.items = items.sort(byOrder);
  } catch (e) {
    if (e.status === 401) { state.user = null; show("auth"); return; }
    state.error = e.message;
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  renderFinding();
  renderStrip();
  renderList();
}

function renderFinding() {
  const el = $("finding");
  el.textContent = "";
  if (state.loading) { el.textContent = " "; return; }
  if (state.error) { el.textContent = "Your assignments could not be loaded."; return; }
  const s = summarize(state.items, today());
  if (s.open === 0) { el.textContent = state.items.length ? "Everything is done." : "Nothing due."; return; }
  el.append(h("strong", { class: s.overdue > 0 ? "late" : "", text: `${s.overdue} overdue` }), `. ${s.soon} due in the next 7 days. ${s.open} open in all.`);
}

function renderStrip() {
  const block = $("stripBlock");
  block.hidden = state.loading || !!state.error || summarize(state.items, today()).open === 0;
  if (block.hidden) return;
  const t = today();
  const { counts, overdue } = weekStrip(state.items, t, 14);
  const max = Math.max(1, overdue, ...counts);
  const strip = $("strip");
  strip.textContent = "";
  const cols = [{ n: overdue, label: "Late", over: true, tip: `${overdue} overdue` }];
  counts.forEach((n, i) => {
    const d = addDays(t, i);
    cols.push({ n, label: String(Number(d.slice(8))), today: i === 0, tip: `${weekdayShort(d)} ${shortDate(d)}: ${n}` });
  });
  for (const c of cols) {
    const fill = h("div", { class: "bar-fill" });
    fill.style.setProperty("--h", String(c.n / max));
    strip.append(h("div", { class: `col${c.over ? " over" : ""}${c.n === 0 ? " zero" : ""}`, title: c.tip },
      h("span", { class: `n${c.n ? " has" : ""}`, text: String(c.n) }), fill));
  }
  strip.append(h("div", { class: "base" }));
  for (const c of cols) strip.append(h("span", { class: `lbl${c.today ? " today" : ""}`, text: c.label }));
  const said = cols.filter((c) => c.n).map((c) => c.tip).join("; ");
  strip.setAttribute("aria-label", `Open assignments per day, overdue first, then the next 14 days starting today. ${said || "None."}`);
}

function renderList() {
  const ul = $("list");
  const st = $("listState");
  ul.textContent = ""; st.textContent = "";
  const open = state.items.filter((i) => !i.done).length;
  $("count").textContent = state.loading || state.error ? "" : `${open} open, ${state.items.length - open} done`;
  if (state.loading) {
    for (let i = 0; i < 4; i++) st.append(h("div", { class: "skel", "aria-hidden": "true" }, h("i"), h("i"), h("i")));
    st.setAttribute("aria-busy", "true");
    return;
  }
  st.removeAttribute("aria-busy");
  if (state.error) {
    const retry = h("button", { type: "button", class: "text-btn", text: "Retry" });
    retry.addEventListener("click", loadAll);
    st.append(h("p", { class: "state err", role: "alert" }, `Couldn't load your assignments. ${state.error}`, retry));
    return;
  }
  if (!state.items.length) {
    st.append(h("p", { class: "state", text: "No assignments yet. Add one above and it will appear here, soonest first." }));
    return;
  }
  for (const it of state.items) ul.append(state.editingId === it.id ? editRow(it) : row(it));
}

function row(it) {
  const info = dueInfo(it.dueDate, today(), it.done);
  const dueText = it.done ? `Done, was due ${shortDate(it.dueDate)}` : info.label;
  const cb = h("input", { type: "checkbox", id: `c-${it.id}`, "aria-label": `Mark “${it.title}” as ${it.done ? "not done" : "done"}` });
  cb.checked = it.done;
  cb.addEventListener("change", async () => { await patch(it.id, { done: cb.checked }, cb.checked ? `Marked “${it.title}” done.` : `Marked “${it.title}” as not done.`, { done: !cb.checked }); focusIn(it.id, 'input[type="checkbox"]'); });
  const edit = h("button", { type: "button", class: "text-btn", text: "Edit", "aria-label": `Edit “${it.title}”` });
  edit.addEventListener("click", () => { state.editingId = it.id; state.confirmId = null; renderList(); const f = document.getElementById("e-title"); if (f) f.focus(); });
  const del = h("button", { type: "button", class: "text-btn", text: "Delete", "aria-label": `Delete “${it.title}”` });
  del.addEventListener("click", () => { state.confirmId = it.id; renderList(); const y = document.getElementById("confirm-yes"); if (y) y.focus(); });
  const li = h("li", { class: `row${it.done ? " is-done" : ""}`, "data-id": it.id },
    h("span", { class: "chk" }, cb),
    h("div", { class: "main" }, h("div", { class: "t", text: it.title }),
      h("div", { class: "c" }, it.course ? h("span", { text: it.course }) : null, h("span", { class: `due-inline ${info.kind}`, text: dueText }))),
    h("span", { class: `due ${info.kind}`, title: it.dueDate, text: dueText }),
    h("span", { class: "act" }, edit, del));
  if (state.confirmId === it.id) {
    const yes = h("button", { type: "button", class: "text-btn danger", id: "confirm-yes", text: "Delete" });
    const no = h("button", { type: "button", class: "text-btn", text: "Keep it" });
    yes.addEventListener("click", () => remove(it));
    no.addEventListener("click", () => { state.confirmId = null; renderList(); focusIn(it.id, ".act .text-btn:last-child"); });
    li.append(h("div", { class: "confirm", role: "group", "aria-label": "Confirm delete" }, h("span", { text: `Delete “${it.title}”?` }), yes, no));
  }
  return li;
}

function editRow(it) {
  const title = h("input", { id: "e-title", value: it.title, maxlength: "120", required: true });
  const course = h("input", { id: "e-course", value: it.course, maxlength: "60" });
  const due = h("input", { id: "e-due", type: "date", value: it.dueDate, required: true });
  const save = h("button", { type: "submit", class: "primary", text: "Save" });
  const cancel = h("button", { type: "button", class: "secondary", text: "Cancel" });
  cancel.addEventListener("click", () => { state.editingId = null; renderList(); focusIn(it.id, ".act .text-btn"); });
  const form = h("form", { class: "edit-row", novalidate: true, "aria-label": `Edit “${it.title}”` },
    h("div", { class: "field grow" }, h("label", { for: "e-title", text: "Assignment" }), title),
    h("div", { class: "field" }, h("label", { for: "e-course", text: "Course" }), course),
    h("div", { class: "field" }, h("label", { for: "e-due", text: "Due date" }), due),
    h("div", { class: "btns" }, save, cancel));
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const t = title.value.trim();
    if (!t) { say("Give the assignment a title.", true); title.setAttribute("aria-invalid", "true"); title.focus(); return; }
    save.disabled = true;
    if (await patch(it.id, { title: t, course: course.value.trim(), dueDate: due.value }, "Saved.")) state.editingId = null;
    save.disabled = false;
    renderList();
    if (!state.editingId) focusIn(it.id, ".act .text-btn");
  });
  return h("li", {}, form);
}

async function patch(id, body, okMsg, undoBody = null) {
  try {
    const before = state.items.find((i) => i.id === id);
    const r = await api("PATCH", `/api/assignments/${id}`, body);
    state.items = state.items.map((i) => (i.id === id ? r.assignment : i)).sort(byOrder);
    say(okMsg, false, undoBody && before ? () => patch(id, undoBody, "Undone.").then(() => focusIn(id, 'input[type="checkbox"]')) : null);
    render();
    return true;
  } catch (e) {
    say(e.message, true);
    render();
    return false;
  }
}

async function remove(it) {
  try {
    await api("DELETE", `/api/assignments/${it.id}`);
    const at = state.items.findIndex((i) => i.id === it.id);
    state.items = state.items.filter((i) => i.id !== it.id);
    state.confirmId = null;
    say(`Deleted “${it.title}”.`);
    render();
    const next = state.items[Math.min(at, state.items.length - 1)];
    if (next) focusIn(next.id, 'input[type="checkbox"]'); else $("addTitle").focus();
  } catch (e) {
    say(e.message, true);
  }
}

$("addForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const title = $("addTitle");
  const due = $("addDue");
  title.removeAttribute("aria-invalid"); due.removeAttribute("aria-invalid");
  if (!title.value.trim()) { say("Give the assignment a title.", true); title.setAttribute("aria-invalid", "true"); title.focus(); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due.value)) { say("Pick a due date.", true); due.setAttribute("aria-invalid", "true"); due.focus(); return; }
  const btn = $("addBtn");
  btn.disabled = true;
  try {
    const r = await api("POST", "/api/assignments", { title: title.value.trim(), course: $("addCourse").value.trim(), dueDate: due.value });
    state.items = [...state.items, r.assignment].sort(byOrder);
    title.value = ""; $("addCourse").value = "";
    say(`Added “${r.assignment.title}”.`);
    render();
    title.focus();
  } catch (e) {
    say(e.message, true);
  } finally {
    btn.disabled = false;
  }
});

function closeDeleteConfirm() {
  $("deleteConfirm").hidden = true; $("deleteAccount").hidden = false;
  $("deletePassword").value = ""; $("deletePassword").removeAttribute("aria-invalid");
}
$("deleteAccount").addEventListener("click", () => { $("deleteConfirm").hidden = false; $("deleteAccount").hidden = true; $("deletePassword").focus(); });
$("deleteNo").addEventListener("click", () => { closeDeleteConfirm(); $("deleteAccount").focus(); });
$("deleteYes").addEventListener("click", async () => {
  const pw = $("deletePassword");
  if (!pw.value) { say("Enter your password to delete the account.", true); pw.setAttribute("aria-invalid", "true"); pw.focus(); return; }
  try {
    await api("DELETE", "/api/me", { password: pw.value });
    state.user = null; state.items = [];
    closeDeleteConfirm();
    show("auth"); setMode("signup");
    $("authError").hidden = true;
  } catch (e) {
    if (e.code === "invalid_credentials") { say("That password is wrong. Your account was not deleted.", true); pw.setAttribute("aria-invalid", "true"); pw.focus(); }
    else say(e.message, true);
  }
});

/* ---------- boot ---------- */
(async function boot() {
  try {
    const r = await api("GET", "/api/session");
    if (!r.user) { setMode("login"); show("auth"); return; }
    await enter(r.user);
  } catch (e) {
    if (e.status === 401) { setMode("login"); show("auth"); return; }
    $("boot").textContent = "";
    const retry = h("button", { type: "button", class: "text-btn", text: "Retry" });
    retry.addEventListener("click", () => location.reload());
    $("boot").append(h("p", { class: "state err", role: "alert" }, e.message, retry));
  }
})();
