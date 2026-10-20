// The timer's brain. Pure: time comes in through `now`, so tests can drive it exactly and the page can never drift
// (it works out what is left from a deadline, not from counting ticks, so a hidden tab or a slow frame cannot change the answer).
export const MODES = {
  focus: { label: "Focus", seconds: 25 * 60 },
  short: { label: "Short break", seconds: 5 * 60 },
  long: { label: "Long break", seconds: 15 * 60 },
};
export const LIMITS = { focus: [1, 120], short: [1, 60], long: [1, 60] }; // minutes

export function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60), s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function createTimer({ now = () => Date.now(), seconds = {}, onDone = () => {} } = {}) {
  const secs = { focus: MODES.focus.seconds, short: MODES.short.seconds, long: MODES.long.seconds, ...seconds };
  let mode = "focus", status = "idle", remaining = secs.focus * 1000, endsAt = 0, focusDone = 0;

  const total = () => secs[mode] * 1000;
  let cap = total(); // the full length of the session in progress: changing a setting mid-session does not change it
  const sync = () => {
    if (status !== "running") return;
    remaining = Math.min(cap, Math.max(0, endsAt - now())); // never more than the full length, even if the clock is set back
    if (remaining === 0) {
      status = "done";
      if (mode === "focus") focusDone += 1;
      onDone(snapshot());
    }
  };
  function snapshot() {
    return { mode, status, remainingMs: remaining, totalMs: cap, progress: 1 - remaining / cap, focusDone, seconds: { ...secs } };
  }
  return {
    snapshot: () => { sync(); return snapshot(); },
    tick() { sync(); return snapshot(); },
    start() {
      sync();
      if (status === "running") return snapshot();
      if (status === "done") { remaining = total(); }
      if (status === "idle" || status === "done") cap = remaining;
      status = "running"; endsAt = now() + remaining;
      return snapshot();
    },
    pause() { sync(); if (status === "running") { status = "paused"; } return snapshot(); },
    toggle() { sync(); return status === "running" ? this.pause() : this.start(); },
    reset() { status = "idle"; remaining = total(); cap = remaining; return snapshot(); },
    setMode(next) {
      if (!MODES[next]) throw new Error(`unknown mode: ${next}`);
      mode = next; status = "idle"; remaining = total(); cap = remaining; return snapshot();
    },
    /** Change a length in minutes; clamped to LIMITS. Applies at once when that mode is idle or finished. */
    setMinutes(which, minutes) {
      const [lo, hi] = LIMITS[which];
      const m = Math.min(hi, Math.max(lo, Math.round(Number(minutes)) || lo));
      secs[which] = m * 60;
      if (which === mode && status !== "running" && status !== "paused") { remaining = total(); cap = remaining; }
      return m;
    },
    /** The mode that should follow the current one: a long break after every fourth focus session. */
    suggestNext() {
      if (mode !== "focus") return "focus";
      return focusDone > 0 && focusDone % 4 === 0 ? "long" : "short";
    },
    setFocusDone(n) { focusDone = Math.max(0, Math.floor(n) || 0); },
  };
}
