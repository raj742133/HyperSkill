import { z } from "zod";

const realDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const pw = z.string().min(10, "Password must be at least 10 characters").refine((s) => Buffer.byteLength(s) <= 72, "Password must be at most 72 bytes");
export const signup = z.object({ email, password: pw }).strict();
export const login = z.object({ email, password: z.string().min(1).max(200) }).strict();

const dueDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine(realDate, "Not a real date");
export const assignmentCreate = z.object({
  title: z.string().trim().min(1).max(120),
  course: z.string().trim().max(60).optional(),
  dueDate,
}).strict();
export const assignmentPatch = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  course: z.string().trim().max(60).optional(),
  dueDate: dueDate.optional(),
  done: z.boolean().optional(),
}).strict().refine((o) => Object.keys(o).length > 0, "Provide at least one field to change");

export const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().max(300).optional(),
}).strict();
export const idParam = z.string().uuid();
