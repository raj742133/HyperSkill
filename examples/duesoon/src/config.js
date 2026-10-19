import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"), // secure by default: cookie Secure, HSTS
  HOST: z.string().min(1).default("127.0.0.1"), // loopback unless the operator opens it up (containers set 0.0.0.0)
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0), // number of proxies in front of the app; 0 = trust none
  SIGNUP_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(10),
  LOGIN_LIMIT_PER_15MIN: z.coerce.number().int().min(1).default(10), // per ip+email
  LOGIN_IP_LIMIT_PER_15MIN: z.coerce.number().int().min(1).default(100), // per ip, whatever the email
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  DB_PATH: z.string().min(1).default(":memory:"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

/** Parse and validate environment variables. Throws a readable error and refuses to start if invalid. */
export function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${lines.join("\n")}`);
  }
  return Object.freeze(parsed.data);
}
