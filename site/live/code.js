// The code view: a read-only file tree, a file's text and a file's diff, for the project being built. Live dashboard only.
// Everything comes from /live/code/*.json (confined to the project folder, secrets hidden); text is only ever set with textContent.
(function () {
  "use strict";
  const meta = document.querySelector('meta[name="hs-mode"]');
  const box = document.getElementById("code");
  if (!box || !meta || meta.content !== "live") return;
  box.hidden = false;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  let files = [], recent = [], selected = null, view = "diff", lastFollow = "", openDirs = new Set(), timer = null;
  const STATUS = { M: "changed", A: "new", D: "deleted" };

  async function getJSON(url) {
    const r = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) { let e = "not available"; try { e = (await r.json()).error || e; } catch (_) {} throw new Error(e); }
    return r.json();
  }

  function ago(ts) {
    const s = Math.max(0, (Date.now() - Date.parse(ts)) / 1000);
    return s < 90 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " d ago";
  }

  function nowBanner() {
    const n = $("code-now");
    const r = recent[0];
    if (!r) { n.textContent = "No file written yet in this session."; return; }
    n.textContent = (r.action === "write" ? "Last written: " : "Last edited: ") + r.path + " (" + ago(r.ts) + ")";
  }

  function buildTree() {
    const list = $("code-tree"), q = $("code-filter").value.trim().toLowerCase(), only = $("code-changed").checked;
    list.replaceChildren();
    const rows = files.filter((f) => (!only || f.status) && (!q || f.path.toLowerCase().includes(q)));
    $("code-count").textContent = files.length + " files, " + files.filter((f) => f.status).length + " changed";
    if (!rows.length) { list.append(el("li", "code-empty", only ? "No changes against git yet." : "No files match.")); return; }
    const root = { dirs: new Map(), files: [] };
    for (const f of rows) {
      let node = root; const parts = f.path.split("/");
      for (const d of parts.slice(0, -1)) { if (!node.dirs.has(d)) node.dirs.set(d, { dirs: new Map(), files: [] }); node = node.dirs.get(d); }
      node.files.push({ name: parts[parts.length - 1], f });
    }
    const touched = new Set(recent.map((r) => r.path));
    const draw = (node, prefix, ul) => {
      for (const [name, sub] of [...node.dirs].sort((a, b) => a[0].localeCompare(b[0]))) {
        const path = prefix + name + "/", li = el("li", "code-dir");
        const d = document.createElement("details");
        d.open = Boolean(q) || only || openDirs.has(path) || (selected && selected.startsWith(path));
        d.addEventListener("toggle", () => { if (d.open) openDirs.add(path); else openDirs.delete(path); });
        d.append(el("summary", "", name + "/")); const inner = el("ul", "code-ul"); d.append(inner); draw(sub, path, inner); li.append(d); ul.append(li);
      }
      for (const { name, f } of node.files.sort((a, b) => a.name.localeCompare(b.name))) {
        const li = el("li", "code-file"), b = el("button", "code-pick" + (f.path === selected ? " on" : ""), name);
        b.type = "button"; b.title = f.path; b.addEventListener("click", () => select(f.path));
        if (f.status) b.append(el("span", "code-badge " + f.status, STATUS[f.status]));
        if (touched.has(f.path)) b.append(el("span", "code-badge claude", "Claude"));
        li.append(b); ul.append(li);
      }
    };
    draw(root, "", list);
  }

  function drawText(text) {
    const pre = $("code-pre"); pre.replaceChildren();
    const lines = text.split("\n"), frag = document.createDocumentFragment();
    lines.forEach((l, i) => { const row = el("div", "ln"); row.append(el("span", "no", String(i + 1)), el("span", "tx", l || " ")); frag.append(row); });
    pre.append(frag);
  }
  function drawDiff(text) {
    const pre = $("code-pre"); pre.replaceChildren();
    const frag = document.createDocumentFragment();
    for (const l of text.split("\n")) {
      const cls = l.startsWith("+++") || l.startsWith("---") || l.startsWith("diff ") || l.startsWith("index ") ? "meta" : l.startsWith("@@") ? "hunk" : l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "";
      frag.append(el("div", "ln " + cls, l || " "));
    }
    pre.append(frag);
  }

  async function show() {
    $("code-file").textContent = selected || "Pick a file on the left";
    document.querySelectorAll(".code-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.v === view)));
    if (!selected) { $("code-pre").replaceChildren(el("div", "code-empty", "Changed files are marked; the ones Claude wrote or edited lately carry a Claude tag.")); return; }
    try {
      if (view === "diff") {
        const d = await getJSON("/live/code/diff.json?path=" + encodeURIComponent(selected));
        if (d.diff) drawDiff(d.diff); else $("code-pre").replaceChildren(el("div", "code-empty", d.note || "No changes against git for this file."));
      } else {
        const f = await getJSON("/live/code/file.json?path=" + encodeURIComponent(selected));
        if (f.text == null) $("code-pre").replaceChildren(el("div", "code-empty", f.note || "Not shown.")); else drawText(f.text);
      }
    } catch (e) { $("code-pre").replaceChildren(el("div", "code-empty", String(e.message || e))); }
  }

  function select(path, as) { selected = path; if (as) view = as; buildTree(); show(); }

  async function refresh() {
    try {
      const t = await getJSON("/live/code/tree.json");
      files = t.files; recent = t.recent || [];
      $("code-nogit").hidden = t.git; nowBanner();
      const top = recent[0] && recent[0].path;
      if ($("code-follow").checked && top && top !== lastFollow && files.some((f) => f.path === top)) { lastFollow = top; selected = top; view = "diff"; show(); }
      buildTree();
      if (selected && $("code-follow").checked) show();
    } catch (_) { /* the dashboard keeps working without the code view */ }
  }

  $("code-filter").addEventListener("input", buildTree);
  $("code-changed").addEventListener("change", buildTree);
  document.querySelectorAll(".code-tab").forEach((b) => b.addEventListener("click", () => { view = b.dataset.v; show(); }));
  function schedule() { clearInterval(timer); timer = setInterval(() => { if (!document.hidden) refresh(); }, 4000); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  refresh(); schedule(); show();
})();
