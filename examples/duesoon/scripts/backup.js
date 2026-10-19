// Usage: DB_PATH=./data/duesoon.db node scripts/backup.js [out-file]
// Writes a consistent copy with VACUUM INTO. Restore by stopping the app and copying the file back to DB_PATH.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const src = process.env.DB_PATH;
if (!src || src === ":memory:") { console.error("Set DB_PATH to the database file"); process.exit(1); }
const out = process.argv[2] ?? `${src}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
if (fs.existsSync(out)) { console.error(`Refusing to overwrite ${out}`); process.exit(1); }
const db = new DatabaseSync(src);
db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
db.close();
console.log(out);
