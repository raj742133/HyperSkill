import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createApp } from "./app.js";
import { openDb } from "./db/connection.js";

let config;
try {
  config = loadConfig();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
process.umask(0o077); // database, WAL and backup files are readable by this user only
const logger = createLogger({ level: config.LOG_LEVEL });
const db = openDb(config.DB_PATH);
const app = createApp({ config, logger, db });
const server = app.listen(config.PORT, config.HOST, () => logger.info("listening", { host: config.HOST, port: config.PORT, trustProxy: config.TRUST_PROXY }));
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => server.close(() => { db.close(); process.exit(0); }));
}
