// The liquid vessel: a canvas that draws a circular glass, two layers of moving waves, rising bubbles, a glossy
// highlight, ripples where the pointer touches it, and a burst of droplets when a session ends.
// It reads three things each frame (progress, colours, energy) and owns nothing else. With reduced motion it draws
// one still frame per change and never starts an animation loop.
const TAU = Math.PI * 2;

export function createLiquid(canvas, { getProgress, getColors, reduced = false }) {
  const ctx = canvas.getContext("2d");
  const state = { w: 0, h: 0, dpr: 1, t: 0, level: 0, energy: 0.25, frames: 0, running: false, raf: 0 };
  const bubbles = [], drops = [], ripples = [];
  let last = 0, colorTick = 0, colors = getColors();

  function resize() {
    const r = canvas.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.w = Math.max(1, Math.round(r.width)); state.h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(state.w * state.dpr); canvas.height = Math.round(state.h * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    if (reduced || !state.running) draw(0);
  }

  const geometry = () => {
    const pad = Math.min(state.w, state.h) * 0.06;
    const r = Math.min(state.w, state.h) / 2 - pad;
    return { cx: state.w / 2, cy: state.h / 2, r };
  };

  function spawnBubble(g) {
    const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * g.r * 0.8;
    bubbles.push({ x: g.cx + Math.cos(a) * d, y: g.cy + g.r * 0.9, r: 1.5 + Math.random() * 4, vy: 18 + Math.random() * 40, ph: Math.random() * TAU });
  }

  /** The pointer touched the glass at (x, y), in CSS pixels relative to the canvas. */
  function poke(x, y, strength = 1) {
    ripples.push({ x, y, age: 0, strength });
    state.energy = Math.min(1.6, state.energy + 0.35 * strength);
    if (reduced) draw(0);
  }

  /** Session finished: throw droplets up out of the vessel. */
  function burst() {
    const g = geometry();
    const n = reduced ? 0 : 70;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5, v = 220 + Math.random() * 380;
      drops.push({ x: g.cx + (Math.random() - 0.5) * g.r * 0.5, y: g.cy - g.r * 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2 + Math.random() * 5, life: 1 });
    }
    state.energy = 1.6;
  }

  function wave(g, level, amp, freq, speed, phase, fill) {
    const top = g.cy + g.r - level * g.r * 2;
    ctx.beginPath(); ctx.moveTo(g.cx - g.r, g.cy + g.r + 4);
    for (let x = g.cx - g.r; x <= g.cx + g.r; x += 4) {
      let y = top + Math.sin(x * freq + state.t * speed + phase) * amp + Math.sin(x * freq * 2.3 - state.t * speed * 0.7) * amp * 0.35;
      for (const rp of ripples) { const dx = x - rp.x, d = Math.abs(dx); const env = Math.exp(-d / 60) * Math.max(0, 1 - rp.age / 1.6); y += Math.sin(d * 0.12 - rp.age * 9) * 9 * rp.strength * env; }
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.cx + g.r, g.cy + g.r + 4); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }

  function draw(dt) {
    const g = geometry();
    ctx.clearRect(0, 0, state.w, state.h);
    // glass
    ctx.save();
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.045)"; ctx.fill();
    ctx.clip();
    // liquid fills toward the target level and settles
    const target = getProgress();
    state.level += (target - state.level) * (reduced ? 1 : Math.min(1, dt * 3));
    const level = 0.012 + Math.max(0, Math.min(1, state.level)) * 0.9; // a full glass stops short of the rim so the surface stays visible
    const amp = reduced ? 0 : 5 + state.energy * 9;
    const back = ctx.createLinearGradient(0, g.cy - g.r, 0, g.cy + g.r);
    back.addColorStop(0, colors.b); back.addColorStop(1, colors.a);
    wave(g, level, amp * 1.2, 0.018, 1.3, 1.7, hexA(colors.b, 0.45));
    wave(g, level, amp, 0.024, 1.9, 0, back);
    // bubbles, only inside the liquid
    const top = g.cy + g.r - level * g.r * 2;
    for (const b of bubbles) {
      if (b.y < top + 6) continue;
      ctx.beginPath(); ctx.arc(b.x + Math.sin(b.ph + state.t * 2) * 6, b.y, b.r, 0, TAU);
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
    // rim and gloss
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.stroke();
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r - 10, Math.PI * 1.08, Math.PI * 1.42); ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.stroke();
    // droplets fly outside the clip
    for (const d of drops) { ctx.beginPath(); ctx.arc(d.x, d.y, d.r * d.life, 0, TAU); ctx.fillStyle = hexA(colors.b, Math.max(0, d.life)); ctx.fill(); }
  }

  function step(ts) {
    if (!state.running) return;
    const dt = Math.min(0.1, (ts - last) / 1000 || 0.016); // capped so a stalled frame cannot make the water jump last = ts;
    state.t += dt; state.frames += 1;
    if (++colorTick % 8 === 0) colors = getColors();
    state.energy += (0.25 - state.energy) * Math.min(1, dt * 1.2);
    const g = geometry();
    if (Math.random() < 0.06 + state.energy * 0.12 && bubbles.length < 40) spawnBubble(g);
    for (const b of bubbles) b.y -= b.vy * dt;
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].y < g.cy - g.r) bubbles.splice(i, 1);
    for (const d of drops) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 900 * dt; d.life -= dt * 0.9; }
    for (let i = drops.length - 1; i >= 0; i--) if (drops[i].life <= 0) drops.splice(i, 1);
    for (const r of ripples) r.age += dt;
    for (let i = ripples.length - 1; i >= 0; i--) if (ripples[i].age > 1.6) ripples.splice(i, 1);
    draw(dt);
    state.raf = requestAnimationFrame(step);
  }

  function start() {
    if (reduced || state.running) return;
    state.running = true; last = performance.now(); state.raf = requestAnimationFrame(step);
  }
  function stop() { state.running = false; cancelAnimationFrame(state.raf); }
  function refresh() { colors = getColors(); if (reduced || !state.running) draw(0); }

  new ResizeObserver(resize).observe(canvas);
  resize();
  return { start, stop, poke, burst, refresh, resize, stats: () => ({ frames: state.frames, bubbles: bubbles.length, drops: drops.length, ripples: ripples.length, level: state.level, running: state.running }) };
}

/** "rgb(r, g, b)" or "#rrggbb" plus an alpha, as an rgba() string. */
function hexA(color, a) {
  let r = 255, g = 255, b = 255;
  const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(color);
  if (m) [r, g, b] = [m[1], m[2], m[3]].map(Number);
  else if (/^#[0-9a-f]{6}$/i.test(color)) { r = parseInt(color.slice(1, 3), 16); g = parseInt(color.slice(3, 5), 16); b = parseInt(color.slice(5, 7), 16); }
  return `rgba(${r},${g},${b},${a})`;
}
