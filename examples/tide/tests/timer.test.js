import { test } from "node:test";
import assert from "node:assert/strict";
import { createTimer, formatTime, MODES, LIMITS } from "../timer.js";

const clock = (t = 1_000_000) => ({ now: () => t, set: (v) => { t = v; }, add: (ms) => { t += ms; } });

test("formatTime rounds up so 0.1 s left still shows 00:01, and never goes negative", () => {
  assert.equal(formatTime(25 * 60 * 1000), "25:00");
  assert.equal(formatTime(61_000), "01:01");
  assert.equal(formatTime(100), "00:01");
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(-5000), "00:00");
  assert.equal(formatTime(120 * 60 * 1000), "120:00");
});

test("a new timer is idle on a full focus session", () => {
  const t = createTimer({ now: clock().now });
  assert.deepEqual([t.snapshot().mode, t.snapshot().status, t.snapshot().remainingMs, t.snapshot().progress], ["focus", "idle", 1_500_000, 0]);
});

test("remaining time comes from the deadline, not from counting ticks: ticks may be late, skipped or bunched", () => {
  const c = clock(), t = createTimer({ now: c.now });
  t.start();
  c.add(10_000);
  assert.equal(t.tick().remainingMs, 1_490_000);
  c.add(500_000); // the tab slept; no ticks happened
  assert.equal(t.tick().remainingMs, 990_000);
  assert.equal(t.tick().remainingMs, 990_000, "ticking twice at the same moment changes nothing");
});

test("pause freezes time and resume continues from where it stopped", () => {
  const c = clock(), t = createTimer({ now: c.now });
  t.start(); c.add(60_000); t.pause();
  c.add(3_600_000); // an hour paused
  assert.equal(t.tick().remainingMs, 1_440_000);
  assert.equal(t.snapshot().status, "paused");
  t.start(); c.add(40_000);
  assert.equal(t.tick().remainingMs, 1_400_000);
});

test("toggle starts, pauses and resumes; start while running is a no-op", () => {
  const c = clock(), t = createTimer({ now: c.now });
  assert.equal(t.toggle().status, "running");
  assert.equal(t.toggle().status, "paused");
  assert.equal(t.toggle().status, "running");
  c.add(5000);
  t.start();
  assert.equal(t.tick().remainingMs, 1_495_000, "a second start did not restart the clock");
});

test("completion fires once, counts a focus session, and stops at zero", () => {
  const c = clock(); const done = [];
  const t = createTimer({ now: c.now, seconds: { focus: 3 }, onDone: (s) => done.push(s) });
  t.start(); c.add(2999);
  assert.equal(t.tick().status, "running");
  c.add(1);
  const s = t.tick();
  assert.deepEqual([s.status, s.remainingMs, s.progress, s.focusDone], ["done", 0, 1, 1]);
  c.add(10_000); t.tick(); t.tick();
  assert.equal(done.length, 1, "onDone fired exactly once");
  assert.equal(t.snapshot().focusDone, 1);
});

test("breaks do not count as focus sessions", () => {
  const c = clock(), t = createTimer({ now: c.now, seconds: { short: 2 } });
  t.setMode("short"); t.start(); c.add(2000);
  assert.deepEqual([t.tick().status, t.snapshot().focusDone], ["done", 0]);
});

test("starting after done begins a fresh session of the same mode", () => {
  const c = clock(), t = createTimer({ now: c.now, seconds: { focus: 2 } });
  t.start(); c.add(2000); t.tick();
  const s = t.start();
  assert.deepEqual([s.status, s.remainingMs], ["running", 2000]);
});

test("reset returns to idle at full length; switching mode does the same for that mode", () => {
  const c = clock(), t = createTimer({ now: c.now });
  t.start(); c.add(100_000);
  assert.deepEqual([t.reset().status, t.snapshot().remainingMs], ["idle", 1_500_000]);
  t.start(); c.add(5000);
  const s = t.setMode("long");
  assert.deepEqual([s.mode, s.status, s.remainingMs], ["long", "idle", 900_000]);
  assert.throws(() => t.setMode("nap"), /unknown mode/);
});

test("lengths are clamped to the limits and apply at once only when not in progress", () => {
  const c = clock(), t = createTimer({ now: c.now });
  assert.equal(t.setMinutes("focus", 0), 1);
  assert.equal(t.setMinutes("focus", 500), 120);
  assert.equal(t.setMinutes("focus", "abc"), 1);
  assert.equal(t.setMinutes("focus", 50.4), 50);
  assert.equal(t.snapshot().remainingMs, 50 * 60_000, "idle timer picks up the new length");
  t.start(); c.add(1000);
  t.setMinutes("focus", 10);
  assert.equal(t.tick().remainingMs, 50 * 60_000 - 1000, "a running session is not cut short");
  for (const k of Object.keys(LIMITS)) assert.equal(t.setMinutes(k, 9999), LIMITS[k][1]);
});

test("a long break is suggested after every fourth focus session, otherwise a short one", () => {
  const c = clock(), t = createTimer({ now: c.now, seconds: { focus: 1, short: 1 } });
  const finishFocus = () => { t.setMode("focus"); t.start(); c.add(1000); t.tick(); };
  const seen = [];
  for (let i = 0; i < 4; i++) { finishFocus(); seen.push(t.suggestNext()); }
  assert.deepEqual(seen, ["short", "short", "short", "long"]);
  t.setMode("short");
  assert.equal(t.suggestNext(), "focus");
});

test("the default lengths are the classic 25, 5 and 15 minutes", () => {
  assert.deepEqual(Object.values(MODES).map((m) => m.seconds / 60), [25, 5, 15]);
});
