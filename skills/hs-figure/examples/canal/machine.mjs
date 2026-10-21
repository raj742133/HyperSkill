// The machine: pure state, no file access, so it also runs in the browser.
// One chamber per phase, one check passed at a time, a gate that opens when its chamber is full.
export function createMachine(phases) {
  const total = phases.reduce((n, p) => n + p.checks, 0);
  let phase = 0, passed = phases.map(() => 0), done = false;
  const full = (i) => passed[i] >= phases[i].checks;
  const snapshot = () => ({
    phase, done, passed: [...passed], total,
    passedTotal: passed.reduce((n, c) => n + c, 0),
    gatesOpen: phases.map((_, i) => full(i)),
    fill: phases.map((p, i) => passed[i] / p.checks),
    readout: done
      ? `All ${phases.length} phases clear, ${total} of ${total} checks passed`
      : `Phase ${phase + 1} of ${phases.length}: ${phases[phase].title}, ${passed[phase]} of ${phases[phase].checks} checks, ${passed.reduce((n, c) => n + c, 0)} of ${total} overall`,
  });
  return {
    snapshot,
    /** Pass one check. When it was the last of its phase the gate opens and the boat moves on. */
    step() {
      if (done) return snapshot();
      passed[phase]++;
      if (full(phase)) { if (phase === phases.length - 1) done = true; else phase++; }
      return snapshot();
    },
    /** Pass every remaining check of the current phase. */
    passPhase() {
      if (done) return snapshot();
      const here = phase;
      while (!done && phase === here) this.step();
      return snapshot();
    },
    reset() { phase = 0; passed = phases.map(() => 0); done = false; return snapshot(); },
  };
}
