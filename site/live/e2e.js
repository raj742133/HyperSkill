// End-to-end tests (Playwright): the last run, a button to run the suite, and a button to cite a green run as evidence. Live dashboard only.
(function () {
  "use strict";
  const meta = document.querySelector('meta[name="hs-mode"]');
  const box = document.getElementById("e2e");
  if (!box || !meta || meta.content !== "live") return;
  box.hidden = false;
  const $ = (id) => document.getElementById(id);
  const token = (document.querySelector('meta[name="hs-token"]') || {}).content || "";
  let timer = null;

  async function api(action) {
    const r = await fetch("/live/api/" + action, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-HS-Token": token }, body: "{}" });
    let j = {}; try { j = await r.json(); } catch (_) {}
    return j;
  }
  function say(t) { $("e2e-msg").textContent = t || ""; }

  function draw(s) {
    const l = s.last;
    $("e2e-verdict").textContent = s.running ? "running…" : s.verdict;
    $("e2e-verdict").className = "e2e-verdict " + (s.running ? "run" : s.verdict.replace(/\s+/g, "-"));
    $("e2e-setup").hidden = s.configured && s.installed;
    $("e2e-setup").textContent = !s.configured ? "Not set up yet. In the project run: hyperskill.py e2e init, then " + s.install.join(" && ") : !s.installed ? "Playwright is not installed here. Run: " + s.install.join(" && ") : "";
    $("e2e-run").disabled = s.running || !s.configured || !s.installed || !token;
    $("e2e-record").hidden = !(s.verdict === "green" && token);
    const list = $("e2e-list"); list.replaceChildren();
    if (l && l.error) { const li = document.createElement("li"); li.textContent = l.error; list.append(li); }
    else if (l && "passed" in l) {
      const head = document.createElement("li"); head.textContent = l.passed + " passed, " + l.failed + " failed, " + l.flaky + " flaky, " + l.skipped + " skipped, in " + (l.duration_ms / 1000).toFixed(1) + " s (" + l.at + ")"; list.append(head);
      for (const f of (l.failing || [])) { const li = document.createElement("li"); li.className = "bad"; li.textContent = "FAIL " + f.title + (f.error ? ": " + f.error : ""); list.append(li); }
      for (const t of (l.flaky_titles || [])) { const li = document.createElement("li"); li.className = "warn"; li.textContent = "FLAKY (passed only on retry) " + t; list.append(li); }
      if (l.skipped) { const li = document.createElement("li"); li.className = "warn"; li.textContent = l.skipped + " skipped. Each skip needs a written reason; replace every test.fixme with a real test."; list.append(li); }
    }
  }
  async function refresh() {
    try { const r = await fetch("/live/e2e.json", { cache: "no-store", credentials: "same-origin" }); if (r.ok) draw(await r.json()); } catch (_) {}
  }
  $("e2e-run").addEventListener("click", async () => { say("Starting…"); const j = await api("e2e_run"); say(j.output || ""); refresh(); });
  $("e2e-record").addEventListener("click", async () => { say("Recording…"); const j = await api("e2e_record"); say((j.output || "").split("\n").slice(0, 2).join(" ")); });
  refresh(); timer = setInterval(() => { if (!document.hidden) refresh(); }, 3000);
})();
