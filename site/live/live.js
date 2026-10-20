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

  const GROUP = { file: "files", test: "tests", gate_pass: "gates", gate_waive: "gates", check_failed: "gates", refused: "gates", advance: "gates", skip: "gates", decision: "notes", note: "notes" };
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

  function drawAll() { drawFeed(); drawNow(); drawRail(); drawPanels(); }

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
    for (const i of openItems.slice(0, 12)) { const li = el("li", "", i.text); if (i.needs) li.append(el("span", "need", `needs ${i.needs.join("+")}`)); open.append(li); }
    if (cur && !openItems.length) open.append(el("li", "", "All checks in this phase are passed or waived."));
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
    $("foot").textContent = "Read-only view of this project's .hyperskill/activity.jsonl. It never leaves this computer.";
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
    try {
      const r = await fetch("/live/state.json", { cache: "no-store" });
      if ((r.headers.get("content-type") || "").includes("json") && r.ok) { state = await r.json(); startLive(); return; }
    } catch (err) { /* not served by the live command: fall through to the recording */ }
    try {
      const r = await fetch("/live/replay.json");
      if (r.ok) { startReplay(await r.json()); return; }
    } catch (err) { /* no recording either */ }
    setMode("offline", "Nothing to show");
    drawAll();
  }
  boot();
})();
