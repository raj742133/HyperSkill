(function () {
  "use strict";
  var HS = window.HS;
  if (!HS) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  };
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* numbers */
  var reviewed = HS.providers.filter(function (p) { return p.policy !== "unreviewed"; }).length;
  var nums = [
    [HS.counts.phases, "phases, idea to scale"],
    [HS.counts.gateItems, "gate checks"],
    [HS.counts.slots, "capability slots"],
    [reviewed, "third-party tools reviewed"],
    [HS.counts.tests, "automated tests"]
  ];
  var dl = $("#numbers");
  nums.forEach(function (n) {
    dl.appendChild(el("div", {}, [el("dt", { text: String(n[0]) }), el("dd", { text: n[1] })]));
  });
  $("#gate-total").textContent = HS.counts.gateItems;

  /* demo terminal */
  var body = $("#term-body");
  var timer = null;
  function lineSpan(cls, text) { return el("span", { "class": cls, text: text }); }
  function paintStep(step, instant) {
    var wrap = el("div", {});
    var cmd = el("div", {}, [lineSpan("p", "$ "), lineSpan("c", step.cmd)]);
    wrap.appendChild(cmd);
    step.out.split("\n").forEach(function (l) {
      var cls = "dim";
      if (/^\[x\]/.test(l) || /^initialised/.test(l) || /^\s+passed:/.test(l)) cls = "ok";
      if (/^error:/.test(l) || /allowed=False/.test(l)) cls = "bad";
      if (/^\[ \]/.test(l)) cls = "c";
      wrap.appendChild(el("div", { "class": cls, text: l }));
    });
    wrap.appendChild(el("div", { text: " " }));
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }
  function play() {
    clearTimeout(timer);
    body.textContent = "";
    var i = 0;
    if (reduced) { HS.demo.forEach(function (s) { paintStep(s, true); }); return; }
    (function next() {
      if (i >= HS.demo.length) return;
      paintStep(HS.demo[i++]);
      timer = setTimeout(next, 1300);
    })();
  }
  play();
  $("#replay").addEventListener("click", play);

  /* copy */
  $("#copy").addEventListener("click", function () {
    var btn = this, text = $("#cmd-text").textContent;
    var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else done();
  });

  /* pipeline tabs */
  var tabs = $("#phase-tabs"), panel = $("#phase-panel");
  function showPhase(i, focus) {
    var p = HS.phases[i];
    Array.prototype.forEach.call(tabs.children, function (t, j) {
      t.setAttribute("aria-selected", j === i ? "true" : "false");
      t.tabIndex = j === i ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", "tab-" + p.id);
    panel.textContent = "";
    panel.appendChild(el("h3", { text: p.title }));
    panel.appendChild(el("p", { "class": "skillname", text: "skill: " + p.skill }));
    panel.appendChild(el("h4", { text: "Must be true before it advances" }));
    var ul = el("ul", { "class": "gate-items" });
    p.gate.forEach(function (g) { ul.appendChild(el("li", { text: g.text })); });
    panel.appendChild(ul);
    if (p.slots.length) {
      panel.appendChild(el("h4", { text: "Capabilities it can borrow" }));
      var row = el("div", { "class": "slot-row" });
      p.slots.forEach(function (s) { row.appendChild(el("span", { "class": "slot", text: s })); });
      panel.appendChild(row);
    }
    if (focus) tabs.children[i].focus();
  }
  HS.phases.forEach(function (p, i) {
    var b = el("button", { "class": "phase-tab", role: "tab", id: "tab-" + p.id, "aria-controls": "phase-panel", type: "button" },
      [el("span", { "class": "num", text: String(i + 1).padStart(2, "0") }), el("span", { text: p.title })]);
    b.addEventListener("click", function () { showPhase(i); });
    b.addEventListener("keydown", function (e) {
      var n = HS.phases.length, k = e.key, t = null;
      if (k === "ArrowDown" || k === "ArrowRight") t = (i + 1) % n;
      else if (k === "ArrowUp" || k === "ArrowLeft") t = (i - 1 + n) % n;
      else if (k === "Home") t = 0;
      else if (k === "End") t = n - 1;
      if (t !== null) { e.preventDefault(); showPhase(t, true); }
    });
    tabs.appendChild(b);
  });
  showPhase(0);

  /* provider table */
  var order = ["recommended", "opt-in", "blocked-if-commercial", "reference-only", "unreviewed"];
  var labels = { "recommended": "Recommended", "opt-in": "Opt-in", "blocked-if-commercial": "Blocked if commercial", "reference-only": "Reference only", "unreviewed": "Unreviewed" };
  var tbody = $("#prov-table tbody"), chips = $("#chips"), active = "all";
  var sorted = HS.providers.slice().sort(function (a, b) {
    return order.indexOf(a.policy) - order.indexOf(b.policy) || a.name.localeCompare(b.name);
  });
  function renderTable() {
    tbody.textContent = "";
    sorted.forEach(function (p) {
      if (active !== "all" && p.policy !== active) return;
      var tr = el("tr", {});
      tr.appendChild(el("td", { "class": "tool" }, [el("b", { text: p.name }), el("span", { text: p.repo })]));
      tr.appendChild(el("td", { "class": "lic", text: p.license.length > 60 ? p.license.slice(0, 57) + "..." : p.license }));
      tr.appendChild(el("td", { "class": "slots", text: p.slots.join(", ") || "none" }));
      tr.appendChild(el("td", {}, [el("span", { "class": "tag " + p.policy, text: labels[p.policy] || p.policy })]));
      tr.appendChild(el("td", { "class": "risk", text: p.risks[0] || "No specific risks recorded." }));
      tbody.appendChild(tr);
    });
  }
  function chip(key, label, count) {
    var b = el("button", { "class": "chip", type: "button", "aria-pressed": key === active ? "true" : "false" },
      [document.createTextNode(label), el("small", { text: String(count) })]);
    b.addEventListener("click", function () {
      active = key;
      Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
      renderTable();
    });
    chips.appendChild(b);
  }
  chip("all", "All", HS.providers.length);
  order.forEach(function (k) { if (HS.policyCounts[k]) chip(k, labels[k], HS.policyCounts[k]); });
  renderTable();
})();
