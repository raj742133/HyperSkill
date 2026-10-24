// HyperSkill live view. Live mode reads /live/state.json and /live/events (served by `hyperskill.py live`).
// With neither available (the public site) it plays /live/replay.json, a recording of a real run.
// Everything is drawn as plain text nodes, never as markup, because activity text comes from files and commands.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const MAX_ROWS = 400;

  let state = { phases: [], decisions: [], current: null };
  let events = [];
  let filter = "all";
  let mode = "connecting";
  let replay = null;
  let timer = null;
  let ideaDirty = false, ideaSig = "";
  let catalogData = null, pick = new Set(), dirty = false, activeGroup = null, kitSig = "", kitLimit = 80, editingExtra = null;
  let editingSkill = null; // { slot, kind: "use" | "skip", value }
  let editing = null; // { id, kind: "pass" | "waive", value } while a check's inline form is open
  const token = document.querySelector('meta[name="hs-token"]')?.content || "";

  const GROUP = { file: "files", test: "tests", gate_pass: "gates", gate_waive: "gates", check_failed: "gates", refused: "gates", advance: "gates", skip: "gates", decision: "notes", note: "notes", skill: "notes" };
  const KIND_LABEL = { building: "Building", testing: "Testing", reviewing: "Reviewing", waiting: "Waiting for you", done: "Done" };

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const clock = (ts) => { const d = new Date(ts); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour12: false }); };
  const ago = (ts) => {
    const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
    return s < 5 ? "just now" : s < 90 ? `${s} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
  };
  const short = (t, n) => (t && t.length > n ? t.slice(0, n - 1) + "…" : t || "");

  /* ---------- how one event looks ---------- */
  function describe(e) {
    const main = el("span");
    let tag = "Note", kind = "note", sub = "";
    switch (e.type) {
      case "file":
        tag = e.action === "write" ? "Wrote" : "Edited"; kind = "file";
        main.append(el("code", "", e.path || e.text));
        if (e.lines) sub = `${e.lines} lines`;
        break;
      case "command":
        tag = "Ran"; kind = e.ok === false ? "bad" : "note";
        if (e.ok === false) main.append(el("span", "pill bad", e.exit ? `EXIT ${e.exit}` : "FAILED"));
        main.append(el("code", "", e.text));
        sub = e.desc || "";
        break;
      case "test": {
        const bad = e.failed > 0;
        tag = "Tests"; kind = bad ? "bad" : "ok";
        main.append(el("span", `pill ${bad ? "bad" : "ok"}`, bad ? "FAILING" : "PASSING"), `${e.passed} passed, ${e.failed} failed` + (e.skipped ? `, ${e.skipped} skipped` : ""));
        sub = [e.runner, e.cmd].filter(Boolean).join(" · ");
        break;
      }
      case "gate_pass": tag = "Passed"; kind = "ok"; main.append(e.label || e.text); sub = short(e.evidence || e.output || "", 220); break;
      case "gate_waive": tag = "Waived"; kind = "warn"; main.append(e.label || e.text); sub = short(e.reason || "", 220); break;
      case "check_failed": tag = "Failed"; kind = "bad"; main.append(e.text); sub = short(e.output || e.cmd || "", 220); break;
      case "refused": tag = "Refused"; kind = "bad"; main.append(e.text); sub = e.open ? "Open: " + e.open.split(",").join(", ") : ""; break;
      case "advance": tag = "Phase"; kind = "go"; main.append(e.text); break;
      case "decision": tag = "Decided"; kind = "go"; main.append(e.text); sub = short(e.choice || "", 220); break;
      case "progress": tag = KIND_LABEL[e.kind] || "Working"; kind = e.kind === "waiting" ? "warn" : "go"; main.append(e.text); break;
      case "skill": tag = "Skill"; kind = e.action === "skipped" ? "note" : "go"; main.append(e.text); break;
      case "agent": tag = "Helper"; kind = "go"; main.append(e.text); break;
      case "skip": tag = "Skipped"; kind = "warn"; main.append(e.text); sub = short(e.reason || "", 200); break;
      default: tag = e.type === "init" ? "Start" : "Note"; main.append(e.text || e.type);
    }
    return { tag, kind, main, sub };
  }

  function row(e) {
    const d = describe(e);
    const li = el("li", "ev");
    li.dataset.k = d.kind; li.dataset.g = GROUP[e.type] || "other";
    const t = el("time", "", clock(e.ts)); t.dateTime = e.ts;
    const body = el("div", "ev-main"); body.append(d.main);
    if (d.sub) body.append(el("span", "ev-sub", d.sub));
    li.append(t, el("span", "tag", d.tag), body);
    return li;
  }

  /* ---------- drawing ---------- */
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; drawAll(); }); } };

  function drawAll() { drawFeed(); drawNow(); drawRail(); drawPanels(); drawControls(); drawKit(); drawExtras(); drawIdea(); drawChat(); drawWork(); drawPreview(); drawAttach(); }

  function drawFeed() {
    const list = $("feed");
    const shown = events.filter((e) => filter === "all" || (GROUP[e.type] || "other") === filter).slice(-MAX_ROWS).reverse();
    const frag = document.createDocumentFragment();
    for (const e of shown) frag.append(row(e));
    list.replaceChildren(frag);
    $("feed-empty").hidden = shown.length > 0;
  }

  function drawNow() {
    const last = events[events.length - 1];
    if (!last) { $("now-text").textContent = mode === "offline" ? "No live project here, and no replay available." : "Waiting for the first event."; $("now-meta").textContent = ""; return; }
    const d = describe(last);
    $("now-text").textContent = (last.type === "file" ? `${d.tag} ${last.path}` : last.type === "test" ? `Tests: ${last.passed} passed, ${last.failed} failed` : last.text);
    $("now-meta").textContent = `${d.tag.toLowerCase()} · ${mode === "replay" ? "replay" : ago(last.ts)}${last.phase ? " · phase " + last.phase : ""}`;
  }

  function drawRail() {
    const rail = $("rail");
    const frag = document.createDocumentFragment();
    state.phases.forEach((p, i) => {
      const li = el("li", "ph"); li.dataset.s = p.status;
      li.append(el("b", "", `${i} ${p.id}`), el("span", "", `${p.done}/${p.total} checks`));
      const m = el("div", "meter"), bar = el("i"); bar.style.width = p.total ? `${Math.round((100 * p.done) / p.total)}%` : "0%";
      m.append(bar); li.append(m); frag.append(li);
    });
    rail.replaceChildren(frag);
    $("proj").textContent = state.name ? `${state.name}${state.tenancy ? " · tenancy " + state.tenancy : ""}` : "";
    const b = $("banner");
    b.hidden = state.current !== null || !state.phases.length;
    if (!b.hidden) b.textContent = "Every phase is finished.";
  }

  function drawPanels() {
    const runs = events.filter((e) => e.type === "test");
    const last = runs[runs.length - 1];
    const big = $("t-last"); big.textContent = "";
    if (last) {
      const ok = el("span", last.failed ? "bad" : "ok", `${last.passed} passed`);
      big.append(ok); if (last.failed) big.append(" · ", el("span", "bad", `${last.failed} failed`));
      $("t-sub").textContent = `${last.runner || "tests"} · ${clock(last.ts)} · ${runs.length} run${runs.length === 1 ? "" : "s"} so far`;
    } else { big.textContent = "No test run yet"; $("t-sub").textContent = ""; }
    const hist = $("t-hist"); hist.replaceChildren();
    const recent = runs.slice(-24), top = Math.max(1, ...recent.map((r) => r.total || r.passed + r.failed));
    for (const r of recent) { const i = el("i", r.failed ? "bad" : ""); i.style.height = `${Math.max(12, Math.round((100 * (r.total || r.passed + r.failed)) / top))}%`; i.title = `${r.passed} passed, ${r.failed} failed`; hist.append(i); }
    hist.hidden = !recent.length;

    const cur = state.phases.find((p) => p.id === state.current);
    $("o-phase").textContent = cur ? cur.id : "the current phase";
    const open = $("open"); open.replaceChildren();
    const openItems = cur ? cur.items.filter((i) => i.state === "open") : [];
    const canAct = controlOn() && cur;
    for (const i of openItems.slice(0, 12)) {
      const li = el("li", "", i.text);
      if (i.needs) li.append(el("span", "need", `needs ${i.needs.join("+")}`));
      if (canAct) {
        const btns = el("span", "item-btns");
        for (const kind of ["pass", "waive"]) { const b = el("button", "", kind === "pass" ? "Pass" : "Waive"); b.type = "button"; b.addEventListener("click", () => { editing = { id: i.id, kind, value: "" }; drawPanels(); const f = document.getElementById("item-input"); if (f) f.focus(); }); btns.append(b); }
        li.append(btns);
        if (editing && editing.id === i.id) li.append(itemForm(cur.id, i));
      }
      open.append(li);
    }
    if (cur && !openItems.length) open.append(el("li", "", "All checks in this phase are passed or waived."));
    if (!openItems.length) editing = null;
    if (!cur) open.append(el("li", "", state.phases.length ? "No phase is active." : "Waiting for the project state."));

    const seen = new Map();
    for (const e of events) if (e.type === "file" && e.path) seen.set(e.path, e);
    $("f-count").textContent = seen.size ? `· ${seen.size} touched` : "";
    const list = $("files"); list.replaceChildren();
    for (const [path] of [...seen].reverse().slice(0, 8)) { const li = el("li"); li.append(el("code", "", path)); list.append(li); }
    if (!seen.size) list.append(el("li", "", "No files recorded yet."));

    const decisions = state.decisions || [];
    $("d-count").textContent = decisions.length ? `· ${decisions.length}` : "";
    const dl = $("decisions"); dl.replaceChildren();
    for (const d of decisions.slice(-8).reverse()) { const li = el("li", "", `${d.n}. ${d.title}`); dl.append(li); }
    if (!decisions.length) dl.append(el("li", "", "No decisions recorded yet."));
  }

  /* ---------- controls (live mode with the page token only) ---------- */
  const controlOn = () => Boolean(token && state.control && state.control.enabled);

  function say(text, bad) { const m = $("c-msg"); m.textContent = text; m.className = "c-msg" + (bad === undefined ? "" : bad ? " bad" : " ok"); }

  async function api(action, body) {
    try {
      const r = await fetch(`/live/api/${action}`, { method: "POST", headers: { "Content-Type": "application/json", "X-HS-Token": token }, body: JSON.stringify(body || {}) });
      const j = await r.json();
      say(j.output ? j.output.split("\n").slice(-3).join(" · ") : (j.ok ? "Done." : "Refused."), !(r.ok && j.ok));
      await refreshState();
      return r.ok && j.ok;
    } catch (err) { say("Could not reach the dashboard server.", true); return false; }
  }

  function itemForm(phaseId, item) {
    const form = el("form", "item-form");
    const input = el("input"); input.id = "item-input"; input.maxLength = 500; input.required = true; input.value = editing.value;
    input.placeholder = editing.kind === "pass" ? "Evidence: what you ran or saw" : "Reason for waiving";
    input.setAttribute("aria-label", input.placeholder);
    input.addEventListener("input", () => { editing.value = input.value; });
    const go = el("button", "btn", editing.kind === "pass" ? "Pass" : "Waive"); go.type = "submit";
    form.append(input, go);
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const ok = await api(editing.kind, editing.kind === "pass" ? { phase: phaseId, item: item.id, evidence: input.value } : { phase: phaseId, item: item.id, reason: input.value });
      if (ok) editing = null;
      drawPanels();
    });
    return form;
  }

  function drawControls() {
    const on = controlOn();
    $("ctl").hidden = !on;
    $("integ").hidden = !(state.integrations && state.integrations.length && mode === "live");
    $("d-new").hidden = !on;
    if (on) {
      const c = state.control;
      $("c-pause").textContent = c.paused ? "Resume Claude" : "Pause Claude";
      $("c-pause").classList.toggle("warn", !c.paused);
      $("c-advance").disabled = state.current === null;
      const inbox = c.inbox || [];
      $("c-inbox").textContent = c.pending ? `${c.pending} instruction${c.pending === 1 ? "" : "s"} waiting for Claude's next step.` : (inbox.length ? "Your last instruction was delivered." : "");
    }
    drawSkillPlan(on);
    const list = $("i-list"); list.replaceChildren();
    const other = $("i-other"); other.replaceChildren();
    const rows = (state.integrations || []).filter((r) => r.bundled || r.builtin || r.policy === "recommended" || r.policy === "opt-in");
    const loose = rows.filter((r) => !r.bundled && !r.builtin);
    $("i-more-h").textContent = `Not bundled: install these yourself (${loose.length})`;
    $("i-count").textContent = rows.length ? `· ${rows.filter((r) => r.bundled && r.enabled).length} switched on` : "";
    $("i-slots").textContent = "";
    for (const r of rows) {
      const li = el("li");
      const target = r.bundled || r.builtin ? list : other;
      li.append(el("span", "i-name", r.name));
      const st = r.builtin ? "built in" : r.bundled ? (r.enabled && r.installed ? "on" : "off") : (r.installed ? "found on this computer" : "not bundled");
      const badge = el("span", "i-state" + (st === "on" || st === "built in" ? " on" : ""), st);
      if (on && r.bundled) {
        const b = el("button", "btn", r.enabled ? "Switch off" : "Switch on"); b.type = "button";
        b.addEventListener("click", () => api(r.enabled ? "disable" : "enable", { id: r.id }));
        li.append(b);
      } else li.append(badge);
      li.append(el("span", "i-meta", [r.policy, r.license, r.bundled ? `${r.bundled} skill${r.bundled === 1 ? "" : "s"}` : r.install[0] || ""].filter(Boolean).join(" · ")));
      target.append(li);
    }
  }

  const STATUS = { ready: "ready", pull: "pull it", ask: "needs your OK", install: "you install it", fallback: "built-in fallback" };

  function drawSkillPlan(on) {
    const rows = state.skillplan || [];
    $("sp").hidden = !(rows.length && mode === "live");
    if ($("sp").hidden) return;
    $("sp-phase").textContent = state.current || "";
    $("sp-count").textContent = `· ${rows.filter((r) => r.decision).length} of ${rows.length} decided`;
    const list = $("sp-list"); list.replaceChildren();
    for (const r of rows) {
      const li = el("li");
      const head = el("div", "sp-head");
      const need = el("span", "sp-need", r.need); need.dataset.n = r.need;
      const st = el("span", "sp-st", STATUS[r.status] || r.status); st.dataset.s = r.status;
      head.append(el("span", "sp-slot", r.slot), need, st, el("span", "sp-prov", r.provider ? `→ ${r.provider}` : "→ built-in fallback"));
      li.append(head, el("p", "sp-why", `When: ${r.when}. Why: ${r.why}.`));
      if (r.decision) { const d = el("p", "sp-dec", `${r.decision === "used" ? "Using" : "Skipping"}${r.decision_provider ? " " + r.decision_provider : ""}: ${r.decision_why}`); d.dataset.d = r.decision; li.append(d); }
      if (on) {
        const btns = el("div", "sp-btns");
        if ((r.status === "pull" || r.status === "ask") && r.provider) {
          const b = el("button", "", r.status === "ask" ? `Approve and pull ${r.provider}` : `Pull ${r.provider}`); b.type = "button";
          b.addEventListener("click", () => api("pull", { id: r.provider }));
          btns.append(b);
        }
        for (const kind of ["use", "skip"]) {
          const b = el("button", "", kind === "use" ? "Mark as used…" : "Skip…"); b.type = "button";
          b.addEventListener("click", () => { editingSkill = { slot: r.slot, kind, value: "" }; drawControls(); const f = document.getElementById("sp-input"); if (f) f.focus(); });
          btns.append(b);
        }
        li.append(btns);
        if (editingSkill && editingSkill.slot === r.slot) {
          const form = el("form", "item-form");
          const input = el("input"); input.id = "sp-input"; input.maxLength = 500; input.required = true; input.value = editingSkill.value;
          input.placeholder = "Why"; input.setAttribute("aria-label", "Why");
          input.addEventListener("input", () => { editingSkill.value = input.value; });
          const go = el("button", "btn", "Save"); go.type = "submit"; form.append(input, go);
          form.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            const ok = await api(editingSkill.kind === "use" ? "skill_use" : "skill_skip", Object.assign({ slot: r.slot, why: input.value }, editingSkill.kind === "use" && r.provider ? { provider: r.provider } : {}));
            if (ok) editingSkill = null;
            drawControls();
          });
          li.append(form);
        }
      }
      list.append(li);
    }
  }

  /* ---------- the catalogue: pick what to use ---------- */
  const CLUSTERS = [["Checks and scope", ["tells", "concepts", "fixes", "addons"]], ["Sitewright", ["sw-"]], ["Design systems (UI UX Pro Max)", ["uu-"]], ["Skills and figures", ["impeccable", "skills", "figures"]]];
  const clusterOf = (id) => CLUSTERS.findIndex(([, ids]) => ids.some((p) => id === p || (p.endsWith("-") && id.startsWith(p))));

  async function loadCatalog() {
    try { const r = await fetch("/live/catalog.json", { cache: "no-store" }); if (r.ok) { catalogData = await r.json(); activeGroup = catalogData.groups[0].id; syncPick(); schedule(); } } catch (err) { /* the section just stays hidden */ }
  }
  function syncPick() { if (!dirty) pick = new Set((state.catalog && state.catalog.selected) || []); }
  const savedSet = () => new Set((state.catalog && state.catalog.selected) || []);

  function togglePick(it, g) {
    if (!controlOn()) return;
    if (pick.has(it.id)) pick.delete(it.id);
    else { if (it.exclusive) for (const o of g.items) if (o.exclusive === it.exclusive) pick.delete(o.id); pick.add(it.id); }
    dirty = true; drawKit();
  }

  const PRE = "/live/previews/";

  function mediaEl(it, big) {
    const m = it.media, wrap = el("div", "kit-media"); wrap.dataset.k = m.kind;
    if (m.kind === "video") {
      const v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = big ? "auto" : "none"; v.poster = PRE + m.poster; v.src = PRE + m.src; v.setAttribute("aria-label", it.name + " (looping preview)");
      if (big) { v.controls = true; v.autoplay = true; v.addEventListener("loadeddata", () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); }); }
      else {
        const go = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); }, stop = () => { v.pause(); };
        wrap.addEventListener("pointerenter", go); wrap.addEventListener("pointerleave", stop); wrap.addEventListener("focusin", go); wrap.addEventListener("focusout", stop);
        wrap.append(el("span", "play", "▶ hover to play"));
      }
      wrap.prepend(v);
    } else {
      const img = document.createElement("img"); img.src = PRE + m.src; img.alt = it.name + " preview"; img.loading = big ? "eager" : "lazy"; img.decoding = "async"; wrap.prepend(img);
    }
    return wrap;
  }

  function openBox(it, g) {
    const dlg = $("kit-box"); const body = $("kit-box-body"); body.replaceChildren();
    body.append(mediaEl(it, true), el("h3", "kit-title", it.name), el("p", "sub", it.desc));
    const meta = el("p", "tags"); meta.append(el("span", "chip2 ph", "phase: " + it.phase)); for (const t of (it.tags || []).slice(0, 3)) meta.append(el("span", "chip2", short(t, 60))); body.append(meta);
    const pickBtn = $("kit-box-pick"); pickBtn.textContent = pick.has(it.id) ? "Remove from my picks" : "Add to my picks"; pickBtn.disabled = !controlOn();
    pickBtn.onclick = () => { togglePick(it, g); dlg.close(); };
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  }

  function itemCard(it, g) {
    const b = el("div", "kit-item"); b.tabIndex = 0; b.setAttribute("role", it.exclusive ? "radio" : "checkbox"); b.setAttribute("aria-checked", String(pick.has(it.id)));
    if (it.exclusive) b.dataset.x = "1";
    if (it.media) {
      const m = mediaEl(it, false);
      const ex = el("button", "expand", "⤢"); ex.type = "button"; ex.title = "Enlarge"; ex.setAttribute("aria-label", "Enlarge " + it.name);
      ex.addEventListener("click", (e) => { e.stopPropagation(); openBox(it, g); });
      m.append(ex); b.append(m);
    }
    b.append(el("span", "box"), el("b", "", it.name));
    if (it.swatch) { const sw = el("div", "sw"); for (const c of it.swatch) { const i = el("i"); if (/^#[0-9a-fA-F]{3,8}$/.test(c)) i.style.background = c; sw.append(i); } b.append(sw); }
    if (it.desc) b.append(el("span", "d", short(it.desc, 190)));
    const tags = el("span", "tags");
    tags.append(el("span", "chip2 ph", it.phase));
    for (const t of (it.tags || []).slice(0, 2)) tags.append(el("span", "chip2", short(t, 40)));
    if (it.mode === "track") tags.append(el("span", "chip2", "becomes a check"));
    if (it.link) { const a = el("a", "", "see it live"); a.href = it.link; a.target = "_blank"; a.rel = "noopener noreferrer"; a.addEventListener("click", (e) => e.stopPropagation()); tags.append(a); }
    b.append(tags);
    b.addEventListener("click", () => togglePick(it, g));
    b.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); togglePick(it, g); } });
    return b;
  }

  function drawKit() {
    const box = $("kit");
    box.hidden = !(catalogData && mode === "live");
    if (box.hidden) return;
    syncPick();
    const on = controlOn(), saved = savedSet();
    const g = catalogData.groups.find((x) => x.id === activeGroup) || catalogData.groups[0];
    const q = $("kit-search").value.trim().toLowerCase();
    const sig = [g.id, q, kitLimit, [...pick].sort().join("|"), [...saved].sort().join("|"), on].join("#");
    const changes = [...pick].filter((i) => !saved.has(i)).length + [...saved].filter((i) => !pick.has(i)).length;
    $("kit-count").textContent = `· ${pick.size} picked`;
    $("kit-status").textContent = changes ? `${changes} unsaved change${changes === 1 ? "" : "s"}` : (on ? "Nothing unsaved" : "Read-only: start the dashboard with controls to pick");
    $("kit-save").disabled = !on || !changes; $("kit-discard").disabled = !changes;
    if (sig === kitSig) return;
    kitSig = sig;
    const nav = $("kit-nav"); nav.replaceChildren();
    CLUSTERS.forEach(([title], ci) => {
      const gs = catalogData.groups.filter((x) => clusterOf(x.id) === ci); if (!gs.length) return;
      nav.append(el("h4", "", title));
      for (const x of gs) {
        const b = el("button"); b.type = "button"; if (x.id === g.id) b.setAttribute("aria-current", "true");
        const n = x.items.filter((i) => pick.has(i.id)).length;
        b.append(el("span", "", x.title.replace(/^(Sitewright|UI UX Pro Max|Impeccable|Hyperfigure): /, "")), el("span", "n" + (n ? " on" : ""), n ? `${n}/${x.items.length}` : String(x.items.length)));
        b.addEventListener("click", () => { activeGroup = x.id; kitLimit = 80; $("kit-search").value = ""; kitSig = ""; drawKit(); });
        nav.append(b);
      }
    });
    $("kit-title").textContent = g.title; $("kit-blurb").textContent = g.blurb;
    $("kit-rec").hidden = !g.items.some((i) => i.rec) || g.exclusive; $("kit-clear").disabled = !on;
    const rows = g.items.filter((i) => !q || (i.name + " " + i.desc + " " + (i.sub || "") + " " + (i.tags || []).join(" ")).toLowerCase().includes(q));
    const list = $("kit-list"); list.replaceChildren();
    let last = null, shown = 0;
    for (const it of rows) {
      if (shown >= kitLimit) break;
      if (it.sub && it.sub !== last) { list.append(el("p", "kit-sub", it.sub)); last = it.sub; }
      list.append(itemCard(it, g)); shown++;
    }
    if (!rows.length) list.append(el("p", "sub", "Nothing matches."));
    const more = $("kit-more"); more.hidden = rows.length <= shown;
    more.textContent = rows.length > shown ? `Showing ${shown} of ${rows.length}. Search to narrow, or ` : "";
    if (rows.length > shown) { const b = el("button", "chip", "show more"); b.type = "button"; b.addEventListener("click", () => { kitLimit += 120; kitSig = ""; drawKit(); }); more.append(b); }
  }

  function drawPlacements() {
    const pl = state.placements || [], list = $("pl-list"); list.replaceChildren();
    $("pl-count").textContent = pl.length ? `· ${pl.filter((p) => p.placed && p.used_in).length} of ${pl.length} placed and used` : "";
    for (const p of pl) {
      const li = el("li"), head = el("div", "xt-head"); const st = el("span", "xt-st", p.placed && p.used_in ? "used" : (p.placed ? "placed, not in code yet" : "not placed")); st.dataset.s = p.placed && p.used_in ? "done" : "open";
      head.append(st, el("b", "", p.name), el("span", "sub", p.where || "Claude has not said where yet")); li.append(head);
      if (p.used_in) li.append(el("p", "sp-dec", "found in " + p.used_in)); list.append(li);
    }
    if (!pl.length) list.append(el("li", "sub", "Pick Sitewright components or figures above; Claude records where each one goes and the check confirms it is really used."));
  }

  function drawExtras() {
    const ex = state.extras || [];
    $("xt").hidden = !(ex.length && mode === "live");
    if ($("xt").hidden) return;
    drawPlacements();
    const open = ex.filter((e) => e.state === "open").length;
    $("xt-count").textContent = `· ${open} open of ${ex.length}`;
    const list = $("xt-list"); list.replaceChildren();
    const order = state.phases.map((p) => p.id);
    for (const e of [...ex].sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase) || (a.state === "open" ? -1 : 1))) {
      const li = el("li"); const head = el("div", "xt-head");
      const st = el("span", "xt-st", e.state); st.dataset.s = e.state;
      head.append(st, el("b", "", e.name), el("span", "chip2 ph", e.phase), el("span", "sub", e.group));
      li.append(head, el("p", "sp-why", e.text));
      if (e.state !== "open") li.append(el("p", "sp-dec", e.evidence || e.reason || ""));
      if (e.state === "open" && controlOn()) {
        const btns = el("div", "sp-btns");
        for (const kind of ["done", "waive"]) { const b = el("button", "", kind === "done" ? "Mark done…" : "Waive…"); b.type = "button"; b.addEventListener("click", () => { editingExtra = { id: e.id, kind, value: "" }; drawExtras(); const f = document.getElementById("xt-input"); if (f) f.focus(); }); btns.append(b); }
        li.append(btns);
        if (editingExtra && editingExtra.id === e.id) {
          const form = el("form", "item-form"); const input = el("input"); input.id = "xt-input"; input.maxLength = 500; input.required = true; input.value = editingExtra.value;
          input.placeholder = editingExtra.kind === "done" ? "Evidence: what you ran or saw" : "Reason for waiving"; input.setAttribute("aria-label", input.placeholder);
          input.addEventListener("input", () => { editingExtra.value = input.value; });
          const go = el("button", "btn", "Save"); go.type = "submit"; form.append(input, go);
          form.addEventListener("submit", async (ev) => { ev.preventDefault(); const ok = await api(editingExtra.kind === "done" ? "extra_done" : "extra_waive", editingExtra.kind === "done" ? { id: e.id, evidence: input.value } : { id: e.id, reason: input.value }); if (ok) editingExtra = null; drawExtras(); });
          li.append(form);
        }
      }
      list.append(li);
    }
  }

  /* ---------- chat: talk to Claude, or run it, from here ---------- */
  let chatSig = "";
  function drawChat() {
    const box = $("chat"), r = state.run;
    box.hidden = !(mode === "live" && r && controlOn());
    if (box.hidden) return;
    const can = r.allowed && r.available;
    $("chat-state").textContent = r.running ? "· Claude is working" : (can ? "· ready" : "· messages are queued");
    $("chat-note").textContent = can
      ? "Each message starts or continues a headless Claude run in this project, using your own Claude login and usage. You choose per message whether it may run shell commands."
      : (r.allowed ? "The `claude` command was not found on this computer, so messages are queued for an open Claude session instead."
        : "Messages here are queued for the Claude session you have open, and it reads them at its next step. To let this box start Claude itself, stop the dashboard and start it with: hyperskill.py live --allow-run");
    drawModels(r, can);
    $("chat-mode").disabled = $("chat-budget").disabled = $("chat-helpers").disabled = !can; $("chat-new").hidden = !can || !r.session; $("chat-send").disabled = r.running;
    $("chat-stop").hidden = !r.running;
    const sig = JSON.stringify([r.messages.length, r.messages.length ? r.messages[r.messages.length - 1].ts : "", r.running, r.last]);
    if (sig === chatSig) return;
    chatSig = sig;
    const log = $("chat-log"), atEnd = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
    log.replaceChildren();
    for (const m of r.messages) { const li = el("li", "", m.text); li.dataset.r = m.role; log.append(li); }
    if (r.running) { const li = el("li", "", "Claude is working..."); li.dataset.r = "system"; log.append(li); }
    else if (r.last && r.last.cost != null) { const li = el("li", "", `Finished: ${r.last.turns || "?"} steps, ${r.last.seconds || 0} s, about $${Number(r.last.cost).toFixed(2)}`); li.dataset.r = "system"; log.append(li); }
    if (atEnd || r.running) log.scrollTop = log.scrollHeight;
  }
  function drawModels(r, can) {
    const m = state.models || {}, sel = { model: $("chat-model"), effort: $("chat-effort") };
    for (const [k, list] of [["model", m.aliases || []], ["effort", m.efforts || []]]) {
      const s = sel[k], sig = list.join();
      if (s.dataset.sig !== sig) {
        const keep = s.value;
        s.replaceChildren(...[["suggested", "Suggested for this phase"], ["", "Claude Code default"], ...list.map((x) => [x, x])].map(([v, t]) => { const o = el("option", "", t); o.value = v; return o; }));
        s.value = keep || "suggested"; s.dataset.sig = sig;
      }
      s.disabled = !can;
    }
    $("chat-chrome").disabled = !can;
    const c = m.current;
    $("chat-suggest").textContent = c ? `For the ${state.current} phase we suggest ${c.model}, effort ${c.effort}. ${c.why} Pick another above any time; this is a suggestion, not a rule.` : "";
  }
  function runBody(text, extra) {
    return Object.assign({ helpers: $("chat-helpers").value, text, mode: $("chat-mode").value, budget: Number($("chat-budget").value), model: $("chat-model").value || null, effort: $("chat-effort").value || null, chrome: $("chat-chrome").checked }, extra || {});
  }
  function wireChat() {
    $("chat-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const t = $("chat-text").value, r = state.run || {};
      if (!t.trim()) return;
      const ok = r.allowed && r.available
        ? await api("run_start", runBody(t))
        : await api("say", { text: t });
      if (ok) $("chat-text").value = "";
    });
    $("chat-stop").addEventListener("click", () => api("run_stop"));
    $("chat-new").addEventListener("click", () => api("run_new"));
  }

  /* ---------- helper agents: the work board ---------- */
  function drawWork() {
    const box = $("wk"), w = state.work, m = state.models || {};
    box.hidden = !(mode === "live" && w && (w.tasks.length || controlOn()));
    if (box.hidden) return;
    const sig = JSON.stringify([w, controlOn()]);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    $("wk-count").textContent = w.tasks.length ? `· ${w.tasks.filter((t) => ["done", "dropped"].includes(t.status)).length} of ${w.tasks.length} finished` : "· no tasks yet";
    const tiers = $("wk-tiers"); tiers.replaceChildren(); box.querySelectorAll(".wk-advice").forEach((n) => n.remove());
    const stat = Object.fromEntries((w.stats || []).map((x) => [x.tier, x]));
    for (const t of m.tiers || []) {
      const d = el("div", "wk-tier"), st = stat[t.id];
      d.append(el("b", "", t.label), el("span", "", `${t.model} · ${t.effort}${t.writes ? "" : " · read-only"}`), el("div", "", t.use));
      if (st && (st.done || st.failed)) d.append(el("div", "wk-why", `${st.done} done, ${st.rate}% right first time${st.failed ? `, ${st.failed} pushed up` : ""}`));
      tiers.append(d);
    }
    for (const a of w.advice || []) { const n = el("p", "sub", "Note: " + a); tiers.after(n); n.className = "sub wk-advice"; }
    const list = $("wk-list"); list.replaceChildren();
    if (!w.tasks.length) list.append(el("li", "", "Nothing split yet. Claude does this itself when a phase has several separate pieces of work."));
    for (const t of w.tasks) {
      const li = el("li"); li.dataset.s = t.status;
      const top = el("div", "wk-top");
      top.append(el("span", "wk-id", t.id), el("b", "", t.title), el("span", "wk-chip", t.label), el("span", "wk-chip", t.status + (t.wave && ["todo", "failed"].includes(t.status) ? ` · wave ${t.wave}` : "")));
      if (controlOn() && ["todo", "failed", "blocked"].includes(t.status)) { const x = el("button", "btn", "Drop"); x.type = "button"; x.addEventListener("click", () => api("work_drop", { id: t.id, why: "dropped from the dashboard" })); top.append(x); }
      li.append(top, el("div", "wk-why", t.reasons.join("; ")));
      if (t.paths.length) li.append(el("div", "wk-paths", "owns: " + t.paths.join(", ")));
      if (t.result) li.append(el("div", "wk-why", "result: " + t.result));
      list.append(li);
    }
    const par = $("wk-par"); par.replaceChildren(...[1, 2, 3, 4, 6, 8].map((n) => { const o = el("option", "", String(n)); o.value = n; return o; })); par.value = String(w.policy.parallel);
    $("wk-form").hidden = !controlOn();
  }
  function wireWork() { $("wk-par").addEventListener("change", () => api("work_policy", { parallel: Number($("wk-par").value) })); }

  /* ---------- live preview of what is being built ---------- */
  let pvSel = "", pvSrc = "";
  function pvTargets() {
    const p = state.preview || { targets: [], found: [] }, rows = [];
    for (const t of p.targets) rows.push({ name: t.name, kind: t.kind, where: t.kind === "web" ? t.url : t.path, saved: true });
    for (const f of p.found) if (!rows.some((x) => x.where === f.url)) rows.push({ name: `${f.title || "dev server"} :${f.port}`, kind: "web", where: f.url, saved: false });
    return rows;
  }
  function drawPreview() {
    const box = $("pv"), rows = pvTargets();
    box.hidden = !(mode === "live" && state.preview);
    if (box.hidden) return;
    if (!rows.some((x) => x.name === pvSel)) pvSel = rows.length ? rows[0].name : "";
    const cur = rows.find((x) => x.name === pvSel);
    $("pv-state").textContent = rows.length ? `· ${rows.length} to look at` : "· nothing yet";
    const sig = JSON.stringify([rows, pvSel, controlOn()]);
    const tabs = $("pv-tabs");
    if (tabs.dataset.sig !== sig) {
      tabs.dataset.sig = sig; tabs.replaceChildren();
      for (const r of rows) {
        const b = el("button", "", (r.kind === "web" ? "App · " : "File · ") + r.name); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(r.name === pvSel));
        b.addEventListener("click", () => { pvSel = r.name; drawPreview(); });
        tabs.append(b);
        if (r.saved && controlOn() && r.name === pvSel) { const x = el("button", "", "Remove"); x.type = "button"; x.addEventListener("click", () => api("preview_remove", { name: r.name })); tabs.append(x); }
        if (!r.saved && controlOn() && r.name === pvSel) { const x = el("button", "", "Keep this one"); x.type = "button"; x.addEventListener("click", () => api("preview_add", { name: r.name.replace(/ :\d+$/, "").slice(0, 40) || "app", url: r.where })); tabs.append(x); }
      }
    }
    const frame = $("pv-frame");
    $("pv-empty").hidden = Boolean(cur); frame.hidden = !cur;
    $("pv-addr").textContent = cur ? cur.where : "";
    $("pv-debug").disabled = !(cur && cur.kind === "web" && controlOn() && state.run && state.run.allowed && state.run.available && !state.run.running);
    $("pv-debug").title = !cur ? "" : cur.kind !== "web" ? "Chrome tests need a running app address, not a file." : "";
    const open = $("pv-open");
    if (cur) open.href = cur.kind === "web" ? cur.where : "/live/site/" + cur.where.split("/").map(encodeURIComponent).join("/"); else open.removeAttribute("href");
    if (cur) {
      const src = open.getAttribute("href");
      if (src !== pvSrc) {
        pvSrc = src;
        frame.setAttribute("sandbox", cur.kind === "web" ? "allow-scripts allow-forms allow-same-origin allow-popups" : "allow-scripts allow-forms");
        frame.src = src;
      }
    } else pvSrc = "";
    frame.style.width = $("pv-width").value;
    $("pv-form").hidden = !controlOn();
  }
  function wirePreview() {
    $("pv-width").addEventListener("change", drawPreview);
    $("pv-reload").addEventListener("click", () => { pvSrc = ""; const f = $("pv-frame"); const s = f.src; f.src = "about:blank"; setTimeout(() => { f.src = s; pvSrc = $("pv-open").getAttribute("href"); }, 30); });
    $("pv-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      let where = $("pv-where").value.trim(); const name = $("pv-name").value.trim();
      if (/^(localhost|127\.0\.0\.1):\d+/i.test(where)) where = "http://" + where;
      const ok = await api("preview_add", /^https?:/i.test(where) ? { name, url: where } : { name, path: where });
      if (ok) { pvSel = name; $("pv-name").value = $("pv-where").value = ""; drawPreview(); }
    });
    $("pv-debug").addEventListener("click", () => {
      const cur = pvTargets().find((x) => x.name === pvSel);
      if (!cur || cur.kind !== "web") return;
      $("chat-chrome").checked = true;
      api("run_start", runBody("Open the running app in Chrome, click through its main screens and forms, check the console and failed network requests, and fix what is broken. Re-test after each fix and report what you checked.", { chrome: true, preview_url: cur.where }));
      $("chat").scrollIntoView({ block: "start" });
    });
  }

  /* ---------- attached files ---------- */
  function drawAttach() {
    const list = $("attach-list"), rows = state.inputs || [], sig = JSON.stringify(rows) + controlOn();
    if (list.dataset.sig === sig) return;
    list.dataset.sig = sig; list.replaceChildren();
    $("attach-file").disabled = !controlOn();
    for (const f of rows) {
      const li = el("li"), head = el("div", "xt-head");
      head.append(el("b", "", f.name), el("span", "sub", `${Math.max(1, Math.round(f.size / 1024))} KB · ${f.text ? "text extracted" : "original only (Claude reads it directly)"}`));
      if (controlOn()) { const b = el("button", "chip", "Remove"); b.type = "button"; b.addEventListener("click", () => api("input_remove", { name: f.name })); head.append(b); }
      li.append(head); list.append(li);
    }
  }
  async function upload(file) {
    try {
      const r = await fetch(`/live/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-HS-Token": token }, body: await file.arrayBuffer() });
      const j = await r.json(); say(j.output || (r.ok ? "attached" : "refused"), !(r.ok && j.ok));
    } catch (err) { say("Could not upload " + file.name, true); }
  }
  function wireAttach() {
    $("attach-file").addEventListener("change", async (ev) => { for (const f of ev.target.files) await upload(f); ev.target.value = ""; await refreshState(); });
  }

  /* ---------- the idea: paste a brief, see what Claude found, answer ---------- */
  function drawIdea() {
    const on = controlOn(), box = $("idea");
    box.hidden = !(mode === "live" && state.brief !== undefined);
    if (box.hidden) return;
    const b = state.brief, ta = $("idea-text");
    if (!ideaDirty && document.activeElement !== ta && ta.value !== b.text) ta.value = b.text;
    ta.disabled = !on; $("idea-save").disabled = !on;
    $("idea-ver").textContent = b.version ? `· saved as version ${b.version}` : "";
    $("idea-status").textContent = ideaDirty ? "Unsaved changes" : (b.version ? "Saved. Claude reads it at its next step." : (on ? "Nothing saved yet" : "Read-only"));
    const sig = JSON.stringify([b.findings, b.requirements, on]);
    $("idea-found").hidden = !(b.findings.length || b.requirements.length);
    if (sig === ideaSig) return;
    ideaSig = sig;
    const open = b.findings.filter((f) => f.state === "open").length;
    $("idea-open").textContent = b.findings.length ? `· ${open} waiting for you` : "";
    const list = $("idea-list"); list.replaceChildren();
    for (const f of b.findings) {
      const li = el("li"), head = el("div", "xt-head");
      const k = el("span", "fd-kind", f.kind); k.dataset.k = f.kind;
      const st = el("span", "xt-st", f.state); st.dataset.s = f.state === "open" ? "open" : (f.state === "rejected" ? "waived" : "done");
      head.append(k, el("b", "", f.text), st); li.append(head);
      if (f.proposed) li.append(el("p", "fd-proposed", "Proposed: " + f.proposed));
      if (f.state !== "open") li.append(el("p", "sp-dec", f.answer ? `You: ${f.answer}` : `You ${f.state} this.`));
      else if (on) {
        const form = el("form", "item-form"); const input = el("input"); input.maxLength = 600;
        input.placeholder = f.kind === "gap" ? "Your answer" : "Optional note"; input.setAttribute("aria-label", input.placeholder); if (f.kind === "gap") input.required = true;
        form.append(input);
        const mk = (label, state) => { const x = el("button", state === "rejected" ? "chip" : "btn", label); x.type = state === "answered" ? "submit" : "button"; return x; };
        if (f.kind === "gap") form.append(mk("Answer", "answered"));
        else {
          const a = mk("Accept", "accepted"), r = mk("Reject", "rejected"); a.className = "btn go"; r.className = "btn";
          a.addEventListener("click", () => api("finding_resolve", { id: f.id, state: "accepted", answer: input.value }));
          r.addEventListener("click", () => api("finding_resolve", { id: f.id, state: "rejected", answer: input.value }));
          form.append(a, r);
        }
        form.addEventListener("submit", (ev) => { ev.preventDefault(); if (f.kind === "gap") api("finding_resolve", { id: f.id, state: "answered", answer: input.value }); });
        li.append(form);
      }
      list.append(li);
    }
    const rl = $("req-list"); rl.replaceChildren();
    $("req-count").textContent = b.requirements.length ? `· ${b.requirements.filter((r) => r.state === "covered").length} of ${b.requirements.length} covered` : "";
    for (const r of b.requirements) { const li = el("li"), head = el("div", "xt-head"); const st = el("span", "xt-st", r.state); st.dataset.s = r.state === "covered" ? "done" : "open"; head.append(st, el("span", "", r.text)); li.append(head); if (r.evidence) li.append(el("p", "sp-dec", r.evidence)); rl.append(li); }
  }

  function wireIdea() {
    $("idea-text").addEventListener("input", () => { ideaDirty = true; drawIdea(); });
    $("idea-form").addEventListener("submit", async (ev) => { ev.preventDefault(); const t = $("idea-text").value; if (t.trim() && await api("brief_save", { text: t })) ideaDirty = false; drawIdea(); });
  }

  function wireKit() {
    $("kit-search").addEventListener("input", () => { kitLimit = 80; kitSig = ""; drawKit(); });
    $("kit-rec").addEventListener("click", () => { const g = catalogData.groups.find((x) => x.id === activeGroup); for (const i of g.items) if (i.rec) pick.add(i.id); dirty = true; drawKit(); });
    $("kit-clear").addEventListener("click", () => { const g = catalogData.groups.find((x) => x.id === activeGroup); for (const i of g.items) pick.delete(i.id); dirty = true; drawKit(); });
    $("kit-discard").addEventListener("click", () => { dirty = false; syncPick(); kitSig = ""; drawKit(); });
    $("kit-box-close").addEventListener("click", () => $("kit-box").close());
    $("kit-box").addEventListener("close", () => $("kit-box-body").replaceChildren());
    $("kit-save").addEventListener("click", async () => { if (await api("catalog_apply", { ids: [...pick], tell_claude: true })) { dirty = false; kitSig = ""; } drawKit(); });
  }

  function wireControls() {
    $("c-pause").addEventListener("click", () => api(state.control && state.control.paused ? "resume" : "pause"));
    $("c-advance").addEventListener("click", () => { if (window.confirm("Move to the next phase? The tracker refuses it while checks are open.")) api("advance"); });
    $("c-install").addEventListener("click", () => { if (window.confirm("Copy every recommended bundled skill into this project's .claude/skills?")) api("enable_all"); });
    $("c-say").addEventListener("submit", async (ev) => { ev.preventDefault(); const t = $("c-say-text"); if (t.value.trim() && await api("say", { text: t.value })) t.value = ""; });
    $("d-form").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (await api("decide", { title: $("d-title").value, choice: $("d-choice").value, why: $("d-why").value })) $("d-form").reset();
    });
  }

  function setMode(m, text) {
    mode = m;
    $("badge").dataset.mode = m;
    $("badge-text").textContent = text || ({ live: "Live", replay: "Replay", offline: "Offline", connecting: "Connecting" }[m]);
  }

  /* ---------- filters ---------- */
  document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
    filter = c.dataset.f;
    document.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
    drawFeed();
  }));

  /* ---------- live mode ---------- */
  async function refreshState() {
    try {
      const r = await fetch("/live/state.json", { cache: "no-store" });
      if (r.ok) { state = await r.json(); schedule(); }
    } catch (err) { setMode("offline", "Lost the connection"); }
  }

  function startLive() {
    setMode("live");
    $("foot").textContent = controlOn() ? "Controls act on this project only, through the same tracker commands a person would type. Nothing leaves this computer." : "Read-only view of this project's .hyperskill/activity.jsonl. It never leaves this computer.";
    wireControls(); wireKit(); wireIdea(); wireChat(); wireWork(); wirePreview(); wireAttach(); loadCatalog();
    const es = new EventSource("/live/events");
    es.onopen = () => setMode("live");
    es.onerror = () => setMode("offline", "Reconnecting");
    es.addEventListener("activity", (m) => { events.push(JSON.parse(m.data)); schedule(); });
    es.addEventListener("state", refreshState);
    setInterval(drawNow, 1000);
  }

  /* ---------- replay mode ---------- */
  function resetReplay() {
    clearTimeout(timer);
    events = [];
    state = {
      name: replay.project, tenancy: replay.tenancy, current: replay.phases[0].id, decisions: [],
      phases: replay.phases.map((p, i) => ({ id: p.id, title: p.title, skill: p.skill, status: i === 0 ? "active" : "pending", done: 0, total: p.items.length,
        items: p.items.map((it) => ({ id: it.id, text: it.text, state: "open", needs: it.needs })) })),
    };
    replay.pos = 0;
  }

  function apply(e) {
    const ph = state.phases.find((p) => p.id === e.phase);
    if ((e.type === "gate_pass" || e.type === "gate_waive") && ph) {
      const it = ph.items.find((i) => i.id === e.item);
      if (it && it.state === "open") { it.state = e.type === "gate_pass" ? "passed" : "waived"; ph.done += 1; }
    }
    if (e.type === "advance" && ph) {
      ph.status = "done";
      const next = state.phases.find((p) => p.id === e.to);
      state.current = next ? next.id : null;
      if (next) next.status = "active";
    }
    if (e.type === "decision") state.decisions.push({ n: e.n, title: (e.text || "").replace(/^Decision \d+: /, "") });
    events.push(e);
  }

  function step() {
    if (replay.pos >= replay.events.length) { $("r-play").textContent = "Replay"; replay.playing = false; return; }
    const e = replay.events[replay.pos++];
    apply(e);
    schedule();
    $("r-pos").textContent = `event ${replay.pos} of ${replay.events.length}`;
    $("r-bar").value = Math.round((100 * replay.pos) / replay.events.length);
    if (!replay.playing) return;
    const next = replay.events[replay.pos];
    const speed = Number($("r-speed").value);
    const gap = next ? new Date(next.ts) - new Date(e.ts) : 0;
    timer = setTimeout(step, Math.max(120, Math.min(gap / speed, 900)));
  }

  function play() { replay.playing = true; $("r-play").textContent = "Pause"; if (replay.pos >= replay.events.length) { resetReplay(); schedule(); } clearTimeout(timer); step(); }
  function pause() { replay.playing = false; clearTimeout(timer); $("r-play").textContent = "Play"; }

  function startReplay(data) {
    replay = data; replay.playing = false;
    setMode("replay");
    $("replay").hidden = false;
    $("back").hidden = false;
    $("foot").textContent = data.note || "This is a recording of a real run, not a live session.";
    resetReplay(); schedule();
    $("r-play").addEventListener("click", () => (replay.playing ? pause() : play()));
    $("r-restart").addEventListener("click", () => { resetReplay(); schedule(); play(); });
    play();
  }

  /* ---------- start ---------- */
  async function boot() {
    // The live server serves this page with hs-mode "live"; the public site leaves it as "replay". No probing, so no failed requests.
    const wantLive = document.querySelector('meta[name="hs-mode"]')?.content === "live";
    try {
      if (wantLive) {
        const r = await fetch("/live/state.json", { cache: "no-store" });
        if (r.ok) { state = await r.json(); startLive(); return; }
        setMode("offline", "Cannot read the project");
      } else {
        const r = await fetch("/live/replay.json");
        if (r.ok) { startReplay(await r.json()); return; }
      }
    } catch (err) { setMode("offline", wantLive ? "Cannot reach the live server" : "Replay unavailable"); }
    if (mode === "connecting") setMode("offline", "Nothing to show");
    drawAll();
  }
  boot();
})();
