// Browser glue. build.mjs puts the kit, the machine and the scene in front of this file, so camera(), createMachine(),
// staticParts() and the rest are in scope, and defines PHASES (from gates.json) and REDUCED_AT_BUILD.
(function () {
  var stage = document.getElementById("fig-stage"), group = document.getElementById("fig-scene");
  var readout = document.getElementById("fig-readout"), live = document.getElementById("fig-live");
  var cam = camera({ az: 45, el: 30, scale: 1 });
  var machine = createMachine(PHASES), statics = staticParts(PHASES);
  var query = window.matchMedia("(prefers-reduced-motion: reduce)");
  var snap = machine.snapshot(), anim = startAnim(PHASES, snap);
  var raf = 0, last = 0, visible = true, lastTouch = performance.now(), tourAt = 0, doneAt = 0, announced = "";

  function draw() { group.innerHTML = renderScene(cam, statics.concat(dynamicParts(PHASES, anim))); }
  function tick(now) {
    var dt = Math.min((now - last) / 1000, 0.1); last = now;
    var moving = stepAnim(PHASES, snap, anim, dt, query.matches);
    draw();
    raf = moving && visible && !document.hidden ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }

  function show() {
    readout.textContent = snap.readout;
    // announce only when the phase changes or the run finishes, not on every check
    var key = snap.done ? "done" : String(snap.phase);
    if (key !== announced) { announced = key; live.textContent = snap.done ? snap.readout : "Phase " + (snap.phase + 1) + " of " + PHASES.length + ": " + PHASES[snap.phase].title; }
    kick();
  }
  function touch() { lastTouch = performance.now(); doneAt = 0; }
  function act(name) {
    touch();
    if (name === "step") snap = machine.step();
    else if (name === "phase") snap = machine.passPhase();
    else if (name === "reset") snap = machine.reset();
    show();
  }

  stage.addEventListener("click", function () { act("step"); });
  stage.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " ") { e.preventDefault(); act("step"); }
    else if (e.key === "Enter") { e.preventDefault(); act("phase"); }
    else if (e.key === "r" || e.key === "R") act("reset");
  });

  // Idle tour: when nobody has touched it for a few seconds it plays itself, then starts over. Never under reduced motion.
  setInterval(function () {
    if (query.matches || !visible || document.hidden || performance.now() - lastTouch < 5000) return;
    var now = performance.now();
    if (snap.done) { if (!doneAt) doneAt = now; else if (now - doneAt > 2500) { snap = machine.reset(); doneAt = 0; show(); } return; }
    if (now - tourAt > 420) { tourAt = now; snap = machine.step(); show(); }
  }, 120);

  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }).observe(stage);
  query.addEventListener && query.addEventListener("change", function () { show(); });
  draw(); show();
  window.__figure = { machine: machine, snapshot: function () { return machine.snapshot(); }, anim: anim, act: act }; // for tests
})();
