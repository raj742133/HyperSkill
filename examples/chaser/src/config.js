// Environment parsing. The server refuses to start on a bad value, with a readable message.
export function loadConfig(env = process.env) {
  const errors = [];
  const int = (name, def, min, max) => {
    const raw = env[name] ?? String(def);
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) errors.push(`${name} must be an integer from ${min} to ${max}`);
    return n;
  };
  const cfg = {
    NODE_ENV: env.NODE_ENV ?? "production",
    HOST: env.HOST || "127.0.0.1",
    PORT: int("PORT", 3000, 1, 65535),
    DATA_DIR: env.DATA_DIR || "./data",
    OPERATOR_TOKEN: env.OPERATOR_TOKEN ?? "",
    ALLOWED_SRC: (env.ALLOWED_SRC ?? "me,friends,community,post").split(",").map((s) => s.trim()).filter(Boolean),
  };
  if (!["development", "production", "test"].includes(cfg.NODE_ENV)) errors.push("NODE_ENV must be development, production or test");
  if (cfg.OPERATOR_TOKEN.length < 24) errors.push("OPERATOR_TOKEN must be at least 24 characters");
  if (cfg.ALLOWED_SRC.some((s) => !/^[a-z0-9_-]{1,20}$/.test(s))) errors.push("ALLOWED_SRC entries must be 1-20 characters of a-z, 0-9, _ or -");
  if (errors.length) throw new Error("Invalid configuration: " + errors.join("; "));
  return Object.freeze(cfg);
}
