/* Shared behaviour for the ten style demos: switches, adding a habit, the toast, and the progress variable. No network, no storage. */
(function () {
  var habits = document.getElementById("habits");
  function update() {
    var all = habits.querySelectorAll(".habit"), done = habits.querySelectorAll(".habit[data-done]");
    document.documentElement.style.setProperty("--p", all.length ? done.length / all.length : 0);
    document.querySelectorAll("[data-count]").forEach(function (n) { n.textContent = done.length; });
    document.querySelectorAll("[data-total]").forEach(function (n) { n.textContent = all.length; });
    document.querySelectorAll("[data-pct]").forEach(function (n) { n.textContent = Math.round(100 * (all.length ? done.length / all.length : 0)) + "%"; });
  }
  document.addEventListener("click", function (e) {
    var sw = e.target.closest("[role=switch]");
    if (!sw) return;
    var on = sw.getAttribute("aria-checked") !== "true";
    sw.setAttribute("aria-checked", String(on));
    var h = sw.closest(".habit");
    if (h) h.toggleAttribute("data-done", on);
    update();
  });
  var toast = document.getElementById("toast"), timer;
  function say(t) { toast.textContent = t; toast.classList.add("show"); clearTimeout(timer); timer = setTimeout(function () { toast.classList.remove("show"); }, 2400); }
  document.getElementById("add-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("add-input"), name = input.value.trim();
    if (!name) { input.focus(); return; }
    var li = document.getElementById("tpl").content.firstElementChild.cloneNode(true);
    li.querySelectorAll("[data-name]").forEach(function (n) { n.textContent = name; });
    li.querySelectorAll("[role=switch]").forEach(function (n) { n.setAttribute("aria-label", name); });
    li.classList.add("new");
    habits.appendChild(li);
    input.value = "";
    say("Habit added: " + name);
    update();
  });
  update();
})();
