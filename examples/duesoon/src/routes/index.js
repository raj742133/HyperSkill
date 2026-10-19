import express from "express";
import { HttpError } from "../errors.js";
import * as users from "../services/users.js";
import * as assignments from "../services/assignments.js";
import { createLimiter } from "../middleware/security.js";
import * as schemas from "./schemas.js";

function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    const details = r.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    throw new HttpError(400, "validation_error", "Invalid input", details);
  }
  return r.data;
}

function requireAuth(db) {
  return (req, _res, next) => {
    const user = req.session?.userId ? users.findUser(db, req.session.userId) : null;
    if (!user) return next(new HttpError(401, "unauthenticated", "Please log in"));
    req.user = user;
    next();
  };
}

const regenerate = (req) => new Promise((res, rej) => req.session.regenerate((e) => (e ? rej(e) : res())));
const destroy = (req) => new Promise((res, rej) => req.session.destroy((e) => (e ? rej(e) : res())));

export function apiRouter({ db, config, limits }) {
  const r = express.Router();
  const auth = requireAuth(db);
  // Key on the SAME normalised email the schema uses, so padding with spaces or changing case cannot get a fresh budget.
  const normEmail = (req) => { const e = schemas.email.safeParse(req.body?.email); return e.success ? e.data : "invalid"; };
  const loginLimiter = createLimiter({ ...limits.login, key: (req) => `${req.ip}|${normEmail(req)}` });
  const loginIpLimiter = createLimiter({ ...limits.loginIp, key: (req) => req.ip });
  const signupLimiter = createLimiter({ ...limits.signup, key: (req) => req.ip });

  r.post("/auth/signup", signupLimiter, async (req, res) => {
    const input = parse(schemas.signup, req.body);
    const user = await users.createUser(db, input, config.BCRYPT_ROUNDS);
    await regenerate(req);
    req.session.userId = user.id;
    res.status(201).json({ user });
  });

  r.post("/auth/login", loginIpLimiter, loginLimiter, async (req, res) => {
    const input = parse(schemas.login, req.body);
    const user = await users.authenticate(db, input, config.BCRYPT_ROUNDS);
    await regenerate(req); // new session id on login: prevents session fixation
    req.session.userId = user.id;
    res.json({ user });
  });

  r.post("/auth/logout", async (req, res) => {
    await destroy(req);
    res.clearCookie("sid");
    res.status(204).end();
  });

  // Session probe for the browser: signed-out is a normal state, so it answers 200 with user null (no console error).
  r.get("/session", (req, res) => {
    const user = req.session?.userId ? users.findUser(db, req.session.userId) : null;
    res.json({ user });
  });
  r.get("/me", auth, (req, res) => res.json({ user: req.user }));
  r.delete("/me", auth, async (req, res) => {
    // Re-enter the password: a stolen or left-open session must not be able to erase the account.
    const { password } = parse(schemas.deleteAccount, req.body);
    await users.authenticate(db, { email: req.user.email, password }, config.BCRYPT_ROUNDS);
    users.deleteUser(db, req.user.id);
    await destroy(req);
    res.clearCookie("sid");
    res.status(204).end();
  });

  r.get("/assignments", auth, (req, res) => res.json(assignments.listAssignments(db, req.user, parse(schemas.listQuery, req.query))));
  r.post("/assignments", auth, (req, res) => res.status(201).json({ assignment: assignments.createAssignment(db, req.user, parse(schemas.assignmentCreate, req.body)) }));
  r.get("/assignments/:id", auth, (req, res) => res.json({ assignment: assignments.getAssignment(db, req.user, parse(schemas.idParam, req.params.id)) }));
  r.patch("/assignments/:id", auth, (req, res) => res.json({ assignment: assignments.updateAssignment(db, req.user, parse(schemas.idParam, req.params.id), parse(schemas.assignmentPatch, req.body)) }));
  r.delete("/assignments/:id", auth, (req, res) => { assignments.deleteAssignment(db, req.user, parse(schemas.idParam, req.params.id)); res.status(204).end(); });

  return r;
}
