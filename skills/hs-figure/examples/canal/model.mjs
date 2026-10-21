// The truth layer. Nothing here draws. It reads the real gate list and keeps the little machine's state, so every number
// the figure shows (phases, checks per phase, how many are passed) comes from skills/hyperskill/gates.json.
import fs from "node:fs";

/** Phases and their check counts from gates.json. A check that applies only to some tenancy models is counted for `tenancy`. */
export function loadPhases(gatesPath, tenancy = "organization") {
  const raw = JSON.parse(fs.readFileSync(gatesPath, "utf8"));
  return raw.phases.map((p) => ({
    id: p.id,
    title: p.title.replace(/\s*\(.*\)\s*$/, ""), // "Foundation (data, auth, API)" -> "Foundation"
    checks: p.gate.filter((g) => !g.tenancy || g.tenancy.includes(tenancy)).length,
  }));
}

export { createMachine } from "./machine.mjs";
