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
  };
  if (!["development", "production", "test"].includes(cfg.NODE_ENV)) errors.push("NODE_ENV must be development, production or test");
  if (errors.length) throw new Error("Invalid configuration: " + errors.join("; "));
  return Object.freeze(cfg);
}
