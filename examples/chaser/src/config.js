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
    TRUST_PROXY: int("TRUST_PROXY", 0, 0, 5),
    PRICE_INR: int("PRICE_INR", 149, 1, 100000),
    OPERATOR_NAME: (env.OPERATOR_NAME ?? "").trim(),
    OPERATOR_CONTACT: (env.OPERATOR_CONTACT ?? "").trim(),
    TEST_END_DATE: (env.TEST_END_DATE ?? "").trim(),
    NOTICE_VERSION: (env.NOTICE_VERSION ?? "1").trim(),
    ALLOWED_SRC: (env.ALLOWED_SRC ?? "me,friends,community,post").split(",").map((s) => s.trim()).filter(Boolean),
  };
  if (!["development", "production", "test"].includes(cfg.NODE_ENV)) errors.push("NODE_ENV must be development, production or test");
  if (cfg.OPERATOR_TOKEN.length < 24) errors.push("OPERATOR_TOKEN must be at least 24 characters");
  if (cfg.ALLOWED_SRC.some((s) => !/^[a-z0-9_-]{1,20}$/.test(s))) errors.push("ALLOWED_SRC entries must be 1-20 characters of a-z, 0-9, _ or -");
  if (cfg.TEST_END_DATE && !/^\d{4}-\d{2}-\d{2}$/.test(cfg.TEST_END_DATE)) errors.push("TEST_END_DATE must be YYYY-MM-DD");
  if (cfg.OPERATOR_CONTACT && !/^[^\s@]+@[^\s@]+\.[^\s@]+$|^https:\/\/\S+$/.test(cfg.OPERATOR_CONTACT)) errors.push("OPERATOR_CONTACT must be an email address or an https URL");
  if (errors.length) throw new Error("Invalid configuration: " + errors.join("; "));
  // The waitlist collects personal data, so it stays off until the notice can name who runs the test, how to reach them and when it ends.
  cfg.WAITLIST_ENABLED = Boolean(cfg.OPERATOR_NAME && cfg.OPERATOR_CONTACT && cfg.TEST_END_DATE);
  return Object.freeze(cfg);
}
