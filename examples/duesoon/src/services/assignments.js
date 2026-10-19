import { randomUUID } from "node:crypto";
import { HttpError } from "../errors.js";
import { can } from "./can.js";

export const MAX_PER_USER = 500;
const COLS = "id, user_id, title, course, due_date, done, created_at, updated_at";
const present = (r) => ({ id: r.id, title: r.title, course: r.course, dueDate: r.due_date, done: r.done === 1, createdAt: r.created_at, updatedAt: r.updated_at });

function forbidden() { return new HttpError(404, "not_found", "Not found"); } // never reveal that another user's id exists

export function createAssignment(db, user, { title, course = "", dueDate }) {
  if (!can(user, "assignment:create")) throw forbidden();
  const count = db.prepare("SELECT COUNT(*) AS n FROM assignments WHERE user_id = ?").get(user.id).n;
  if (count >= MAX_PER_USER) throw new HttpError(422, "limit_reached", `You can keep at most ${MAX_PER_USER} assignments`);
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(`INSERT INTO assignments (id, user_id, title, course, due_date, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`)
    .run(id, user.id, title, course, dueDate, now, now);
  return getAssignment(db, user, id);
}

export function getAssignment(db, user, id) {
  const row = db.prepare(`SELECT ${COLS} FROM assignments WHERE id = ? AND user_id = ?`).get(id, user.id);
  if (!row || !can(user, "assignment:read", row)) throw forbidden();
  return present(row);
}

export function updateAssignment(db, user, id, patch) {
  const row = db.prepare(`SELECT ${COLS} FROM assignments WHERE id = ? AND user_id = ?`).get(id, user.id);
  if (!row || !can(user, "assignment:update", row)) throw forbidden();
  const next = {
    title: patch.title ?? row.title,
    course: patch.course ?? row.course,
    due_date: patch.dueDate ?? row.due_date,
    done: patch.done === undefined ? row.done : patch.done ? 1 : 0,
  };
  db.prepare("UPDATE assignments SET title = ?, course = ?, due_date = ?, done = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(next.title, next.course, next.due_date, next.done, new Date().toISOString(), id, user.id);
  return getAssignment(db, user, id);
}

export function deleteAssignment(db, user, id) {
  const row = db.prepare(`SELECT ${COLS} FROM assignments WHERE id = ? AND user_id = ?`).get(id, user.id);
  if (!row || !can(user, "assignment:delete", row)) throw forbidden();
  db.prepare("DELETE FROM assignments WHERE id = ? AND user_id = ?").run(id, user.id);
}

const encode = (r) => Buffer.from(JSON.stringify([r.done, r.due_date, r.id])).toString("base64url");
function decode(cursor) {
  try {
    const [done, due, id] = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if ((done !== 0 && done !== 1) || typeof due !== "string" || typeof id !== "string") throw new Error();
    return [done, due, id];
  } catch {
    throw new HttpError(400, "invalid_cursor", "Invalid cursor");
  }
}

/** Not-done first, then by due date. Cursor pagination, always scoped to the caller's own rows. */
export function listAssignments(db, user, { limit = 20, cursor } = {}) {
  const args = [user.id];
  let after = "";
  if (cursor) {
    const [d, due, id] = decode(cursor);
    after = "AND (done, due_date, id) > (?, ?, ?)";
    args.push(d, due, id);
  }
  const rows = db.prepare(`SELECT ${COLS} FROM assignments WHERE user_id = ? ${after} ORDER BY done, due_date, id LIMIT ?`).all(...args, limit + 1);
  const page = rows.slice(0, limit);
  return { items: page.map(present), nextCursor: rows.length > limit ? encode(page[page.length - 1]) : null };
}
