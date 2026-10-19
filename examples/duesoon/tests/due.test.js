import { test } from "node:test";
import assert from "node:assert/strict";
import { localToday, daysBetween, dueInfo, summarize, weekStrip, addDays, weekdayShort, shortDate } from "../public/due.js";

test("localToday uses the local date parts, not UTC", () => {
  // 23:30 local on 31 Dec stays 31 Dec even though UTC may already be 1 Jan
  assert.equal(localToday(new Date(2026, 11, 31, 23, 30)), "2026-12-31");
  assert.equal(localToday(new Date(2027, 0, 1, 0, 5)), "2027-01-01");
});

test("daysBetween crosses month, year and leap-day boundaries", () => {
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
  assert.equal(daysBetween("2028-02-28", "2028-03-01"), 2, "2028 is a leap year");
  assert.equal(daysBetween("2027-02-28", "2027-03-01"), 1);
  assert.equal(daysBetween("2026-11-05", "2026-11-05"), 0);
  assert.equal(daysBetween("2026-11-05", "2026-11-01"), -4);
});

test("dueInfo: yesterday, today, tomorrow, within a week, later, done", () => {
  const today = "2026-11-10";
  assert.deepEqual(dueInfo("2026-11-09", today, false), { kind: "overdue", days: 1, label: "Overdue by 1 day" });
  assert.equal(dueInfo("2026-11-01", today, false).label, "Overdue by 9 days");
  assert.equal(dueInfo("2026-11-10", today, false).kind, "today");
  assert.equal(dueInfo("2026-11-11", today, false).label, "Due tomorrow");
  assert.equal(dueInfo("2026-11-17", today, false).label, "Due in 7 days");
  assert.equal(dueInfo("2026-11-18", today, false).kind, "later");
  assert.equal(dueInfo("2026-11-18", today, false).label, "Due 18 Nov");
  assert.equal(dueInfo("2020-01-01", today, true).kind, "done", "done items are never overdue");
});

test("the same assignment flips from today to overdue at local midnight", () => {
  assert.equal(dueInfo("2026-12-31", "2026-12-31", false).kind, "today");
  assert.equal(dueInfo("2026-12-31", "2027-01-01", false).kind, "overdue");
});

test("summarize counts overdue and next-7-days from the rows, ignoring done ones", () => {
  const today = "2026-11-10";
  const items = [
    { dueDate: "2026-11-08", done: false }, { dueDate: "2026-11-09", done: false }, { dueDate: "2026-11-01", done: true },
    { dueDate: "2026-11-10", done: false }, { dueDate: "2026-11-17", done: false }, { dueDate: "2026-11-18", done: false },
  ];
  assert.deepEqual(summarize(items, today), { overdue: 2, soon: 2, open: 5 });
  assert.deepEqual(summarize([], today), { overdue: 0, soon: 0, open: 0 });
});

test("weekStrip buckets by day, separates overdue, and drops anything beyond the window", () => {
  const today = "2026-11-10";
  const items = [
    { dueDate: "2026-11-09", done: false }, { dueDate: "2026-11-10", done: false }, { dueDate: "2026-11-10", done: false },
    { dueDate: "2026-11-23", done: false }, { dueDate: "2026-11-24", done: false }, { dueDate: "2026-11-12", done: true },
  ];
  const s = weekStrip(items, today, 14);
  assert.equal(s.counts.length, 14);
  assert.equal(s.counts[0], 2);
  assert.equal(s.counts[13], 1, "day 13 is 2026-11-23");
  assert.equal(s.counts.reduce((a, b) => a + b, 0), 3, "2026-11-24 is beyond the window and done items are excluded");
  assert.equal(s.overdue, 1);
});

test("addDays and weekdayShort agree with the calendar", () => {
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(weekdayShort("2026-11-10"), "Tue");
  assert.equal(shortDate("2026-03-04"), "4 Mar");
});
