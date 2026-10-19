const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACT = /pass(word)?|token|secret|authorization|cookie|email/i;

function redact(value, depth = 0) {
  if (value === null || typeof value !== "object" || depth > 4) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? "[redacted]" : redact(v, depth + 1);
  return out;
}

/** Structured JSON-lines logger. Sensitive field names are redacted before writing. */
export function createLogger({ level = "info", write = (line) => process.stdout.write(line + "\n") } = {}) {
  const min = LEVELS[level];
  const emit = (lvl, msg, fields = {}) => {
    if (LEVELS[lvl] < min) return;
    write(JSON.stringify({ level: lvl, time: new Date().toISOString(), msg, ...redact(fields) }));
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
  };
}
