import { createTimer, formatTime, MODES, LIMITS } from "./timer.js";
import { createLiquid } from "./liquid.js";

const $ = (id) => document.getElementById(id);
const body = document.body;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; // read once: changing the OS setting takes effect on the next page load
const STORE = "tide.v1";

/* ---------- saved settings (best effort: private windows can refuse storage) ---------- */
function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) ?? {}; } catch (err) { return {}; }
}
function save(patch) {
  try { localStorage.setItem(STORE, JSON.stringify({ ...load(), ...patch })); } catch (err) { /* nothing to do: settings just will not persist */ }
}
/** Stored settings come from the visitor's browser and can be anything: keep only values of the right type and range. */
function clean(raw) {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const seconds = {};
  for (const [which, [lo, hi]] of Object.entries(LIMITS)) {
    const v = o.seconds?.[which];
    if (Number.isInteger(v) && v % 60 === 0 && v / 60 >= lo && v / 60 <= hi) seconds[which] = v;
  }
  return {
    seconds,
    sound: o.sound === true,
    day: typeof o.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.day) ? o.day : undefined,
    focusDone: Number.isInteger(o.focusDone) && o.focusDone >= 0 && o.focusDone < 1000 ? o.focusDone : 0,
  };
}
const saved = clean(load());
const localDay = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const today = localDay(); // the visitor's own date, not UTC

/* ---------- sound: a soft two-note chime, off until asked ---------- */
let soundOn = saved.sound === true, audio = null;
// Browsers only let audio start after a click or key press, so the context is made and woken when a session starts, not when it ends.
function unlockAudio() {
  if (!soundOn) return;
  try { audio ??= new AudioContext(); audio.resume?.(); } catch (err) { /* no audio here: chime() turns sound off */ }
}
function chime() {
  if (!soundOn) return;
  try {
    audio ??= new AudioContext();
    audio.resume?.();
    [660, 990].forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.18;
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 1);
    });
  } catch (err) { soundOn = false; paintSound(); } // no audio available here
}

/* ---------- state ---------- */
const timer = createTimer({
  seconds: saved.seconds ?? {},
  onDone: (s) => { finished(s); },
});
timer.setFocusDone(saved.day === today ? saved.focusDone ?? 0 : 0);

const liquid = createLiquid($("liquid"), {
  reduced,
  getProgress: () => 1 - timer.snapshot().progress, // the glass starts full and drains as time passes
  getColors: () => {
    const cs = getComputedStyle(body);
    return { a: cs.getPropertyValue("--liq-a").trim() || "#1fb6a6", b: cs.getPropertyValue("--liq-b").trim() || "#66f3d8" };
  },
});

/* ---------- odometer digits ---------- */
const digits = $("digits");
let shown = "";
function setDigits(text) {
  if (text === shown) return;
  if (digits.children.length !== text.length) {
    digits.replaceChildren();
    for (const ch of text) {
      const cell = document.createElement("span");
      cell.className = ch === ":" ? "colon" : "d";
      const cur = document.createElement("span"); cur.textContent = ch; cell.append(cur);
      digits.append(cell);
    }
    shown = text; return;
  }
  [...text].forEach((ch, i) => {
    const cell = digits.children[i];
    // Layers left over from earlier rolls (a throttled tab, a big jump in time) are dropped so they can never pile up.
    while (cell.children.length > 1) cell.firstElementChild.remove();
    const cur = cell.firstElementChild;
    cur.getAnimations().forEach((a) => a.finish());
    if (cur.textContent === ch) return;
    if (reduced || ch === ":" || !cur.animate) { cur.textContent = ch; return; }
    const next = document.createElement("span"); next.textContent = ch; cell.append(next);
    const opts = { duration: 380, easing: "cubic-bezier(.2,.9,.2,1)", fill: "forwards" };
    cur.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-70%)", opacity: 0 }], opts);
    next.animate([{ transform: "translateY(70%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], opts).finished
      .then(() => { cur.remove(); }, () => { cur.remove(); });
  });
  shown = text;
}

/* ---------- drawing the whole state ---------- */
let lastSecond = -1, lastStatus = "", lastMode = "";
const titleFor = (s, text) => s.status === "running" || s.status === "paused" ? `${text} · ${MODES[s.mode].label} · Tide`
  : s.status === "done" ? `Time is up · ${MODES[s.mode].label} · Tide` : "Tide: a focus timer";
function render(force = false) {
  const s = timer.snapshot();
  const text = formatTime(s.remainingMs);
  const sec = Math.ceil(s.remainingMs / 1000);
  if (sec !== lastSecond || force) {
    setDigits(text);
    $("spoken").textContent = spoken(s.remainingMs);
    document.title = titleFor(s, text);
    lastSecond = sec;
  }
  if (s.status !== lastStatus || s.mode !== lastMode || force) {
    body.dataset.status = s.status; body.dataset.mode = s.mode;
    document.title = titleFor(s, formatTime(s.remainingMs)); // a finished session says so in the tab title, which stays visible when the page is in the background
    $("go").textContent = s.status === "running" ? "Pause" : s.status === "paused" ? "Resume" : s.status === "done" ? "Start " + MODES[timer.suggestNext()].label.toLowerCase() : "Start";
    $("caption").textContent = caption(s);
    document.querySelectorAll("#modes button").forEach((b) => { const on = b.dataset.mode === s.mode; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
    if (s.mode !== lastMode) liquid.refresh();
    lastStatus = s.status; lastMode = s.mode;
  }
}
const caption = (s) => ({ idle: "Ready when you are", running: s.mode === "focus" ? "Stay with it" : "Rest", paused: "Paused", done: s.mode === "focus" ? "Done. Take a break?" : "Break over" })[s.status];
function spoken(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(total / 60), s = total % 60;
  return `${m} minute${m === 1 ? "" : "s"} ${s} second${s === 1 ? "" : "s"}`;
}

function drawDots() {
  const n = timer.snapshot().focusDone, list = $("dots");
  while (list.children.length < Math.min(n, 12)) list.append(document.createElement("li"));
  while (list.children.length > Math.min(n, 12)) list.lastChild.remove();
}

function finished(s) {
  liquid.burst(); chime();
  $("live").textContent = s.mode === "focus" ? "Focus session finished. Take a break." : "Break finished.";
  if (s.mode === "focus") { save({ focusDone: s.focusDone, day: today }); drawDots(); }
}

/* ---------- actions ---------- */
function act(name) {
  if (name === "toggle") {
    const s = timer.snapshot();
    if (s.status === "done") timer.setMode(timer.suggestNext());
    timer.toggle();
    unlockAudio();
    $("live").textContent = timer.snapshot().status === "running" ? "Started" : "Paused";
  } else if (name === "reset") { timer.reset(); $("live").textContent = "Reset"; }
  else if (MODES[name]) { timer.setMode(name); $("live").textContent = `${MODES[name].label} selected`; }
  render(true);
}
$("go").addEventListener("click", () => act("toggle"));
$("reset").addEventListener("click", () => act("reset"));
$("modes").addEventListener("click", (e) => { const b = e.target.closest("button[data-mode]"); if (b) act(b.dataset.mode); });
$("modes").addEventListener("keydown", (e) => {
  const order = ["focus", "short", "long"], i = order.indexOf(timer.snapshot().mode);
  const move = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!move) return;
  e.preventDefault(); act(order[(i + move + 3) % 3]); document.querySelector("#modes button[aria-checked=true]").focus();
});

// A field that is no longer on screen (the dialog just closed) cannot be typed into, so it must not block the shortcuts.
const typing = (el) => el && el.checkVisibility?.() !== false && (el.matches("input, textarea, select, [contenteditable]") || el.closest("dialog[open]"));
addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || typing(document.activeElement)) return;
  const a = document.activeElement, onButton = a?.matches("button") && a.checkVisibility?.() !== false; // a hidden button (the dialog just closed) cannot act, so it must not swallow the key
  const k = e.key.toLowerCase();
  if (k === " " && !onButton) { e.preventDefault(); act("toggle"); }
  else if (k === "r") act("reset");
  else if (k === "1") act("focus"); else if (k === "2") act("short"); else if (k === "3") act("long");
  else if (k === "m") toggleSound();
  else if (k === "s") openSettings();
});

/* ---------- sound toggle ---------- */
function paintSound() {
  const b = $("sound"); b.setAttribute("aria-pressed", String(soundOn)); b.setAttribute("aria-label", soundOn ? "Sound, on" : "Sound, off");
}
function toggleSound() { soundOn = !soundOn; save({ sound: soundOn }); paintSound(); if (soundOn) chime(); $("live").textContent = soundOn ? "Sound on" : "Sound off"; }
$("sound").addEventListener("click", toggleSound);
paintSound();

/* ---------- settings dialog ---------- */
const dlg = $("settings"), form = $("settings-form");
function openSettings() {
  const s = timer.snapshot().seconds;
  for (const k of ["focus", "short", "long"]) form.elements[k].value = s[k] / 60;
  dlg.showModal(); form.elements.focus.select();
}
$("open-settings").addEventListener("click", openSettings);
$("cancel").addEventListener("click", () => dlg.close("cancel"));
form.addEventListener("submit", () => {
  for (const k of ["focus", "short", "long"]) timer.setMinutes(k, form.elements[k].value);
  save({ seconds: timer.snapshot().seconds }); render(true);
  $("live").textContent = "Session lengths saved";
});
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close("cancel"); });
// Closing must leave focus somewhere defined: a hidden button holding focus would swallow the next keyboard shortcut.
dlg.addEventListener("close", () => { const a = document.activeElement; if (a instanceof HTMLElement && (dlg.contains(a) || a === document.body)) a.blur(); });

/* ---------- pointer play: parallax sky, magnetic buttons, ripples in the glass ---------- */
let pending = null;
addEventListener("pointermove", (e) => {
  if (reduced) return;
  pending = e;
  if (pending.queued) return;
  pending.queued = true;
  requestAnimationFrame(() => {
    const ev = pending; pending = null;
    document.documentElement.style.setProperty("--mx", String((ev.clientX / innerWidth - 0.5) * 2));
    document.documentElement.style.setProperty("--my", String((ev.clientY / innerHeight - 0.5) * 2));
    document.querySelectorAll(".magnet").forEach((b) => {
      const r = b.getBoundingClientRect(), dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy);
      const pull = d < 110 ? (1 - d / 110) : 0;
      b.style.setProperty("--tx", `${(dx * 0.18 * pull).toFixed(1)}px`); b.style.setProperty("--ty", `${(dy * 0.18 * pull).toFixed(1)}px`);
    });
  });
}, { passive: true });
$("liquid").addEventListener("pointermove", (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  if (e.buttons || e.pointerType === "mouse") liquid.poke(e.clientX - r.left, e.clientY - r.top, e.buttons ? 1 : 0.35);
});
$("liquid").addEventListener("pointerdown", (e) => { const r = e.currentTarget.getBoundingClientRect(); liquid.poke(e.clientX - r.left, e.clientY - r.top, 1.4); });
document.addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".primary, .ghost"); if (!b || reduced) return;
  const r = b.getBoundingClientRect(), size = Math.max(r.width, r.height), dot = document.createElement("span");
  dot.className = "ripple"; dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  b.append(dot); dot.addEventListener("animationend", () => dot.remove());
});

/* ---------- go ---------- */
// Refresh just after each second boundary while running, so the display is never a second behind; idle, a slow check is enough.
function loop() {
  const s = timer.tick(); render();
  const wait = s.status === "running" ? (s.remainingMs % 1000 || 1000) + 8 : 250;
  setTimeout(loop, Math.min(wait, 1008));
}
loop();
document.addEventListener("visibilitychange", () => { timer.tick(); render(true); });
drawDots(); render(true); liquid.start();
window.__tide = { liquid, timer }; // read by the browser tests (frame counts, state); nothing else uses it
