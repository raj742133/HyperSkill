import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { HttpError } from "../errors.js";

// Compared against when the email is unknown, so "no such user" and "wrong password" take similar time.
// Built at the same cost as real hashes (cached per cost).
const dummy = new Map();
const dummyHash = (rounds) => { if (!dummy.has(rounds)) dummy.set(rounds, bcrypt.hashSync("not-a-real-password", rounds)); return dummy.get(rounds); };

export async function createUser(db, { email, password }, rounds) {
  const hash = await bcrypt.hash(password, rounds);
  const now = new Date().toISOString();
  const id = randomUUID();
  try {
    db.prepare("INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, email, hash, now, now);
  } catch (e) {
    if (/UNIQUE/.test(String(e.message))) throw new HttpError(409, "email_taken", "An account with this email already exists");
    throw e;
  }
  return { id, email };
}

export async function authenticate(db, { email, password }, rounds = 10) {
  const row = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(email);
  const ok = await bcrypt.compare(password, row ? row.password_hash : dummyHash(rounds));
  if (!row || !ok) throw new HttpError(401, "invalid_credentials", "Wrong email or password");
  return { id: row.id, email: row.email };
}

export function findUser(db, id) {
  const row = db.prepare("SELECT id, email FROM users WHERE id = ?").get(id);
  return row ? { id: row.id, email: row.email } : null;
}

/** Deletes the account and, through ON DELETE CASCADE, every row the user owns. */
export function deleteUser(db, userId) {
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}
