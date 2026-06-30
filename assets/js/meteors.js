/*!
 * Occasional shooting stars across the cosmic background (dark mode only).
 * Spawns a faint streak every few seconds; each animates across the sky and
 * removes itself. Sits behind the page content. Honors reduced-motion.
 */
(function () {
  "use strict";

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var layer = document.createElement("div");
  layer.id = "meteor-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function spawn() {
    if (!isDark() || document.hidden) return;
    var m = document.createElement("div");
    m.className = "meteor";
    var len = rand(240, 460); // streak length (px) — ~2x bigger
    var dur = rand(1.3, 3.2); // seconds to cross
    var ang = rand(140, 165); // travel direction (deg) — down-left
    var startX = rand(window.innerWidth * 0.5, window.innerWidth * 1.05);
    var startY = rand(-60, window.innerHeight * 0.4);
    var dist = rand(window.innerWidth * 0.9, window.innerWidth * 1.8);
    m.style.width = len + "px";
    m.style.left = startX + "px";
    m.style.top = startY + "px";
    m.style.setProperty("--ang", ang + "deg");
    m.style.setProperty("--dist", dist + "px");
    m.style.animationDuration = dur + "s";
    layer.appendChild(m);
    setTimeout(function () {
      m.remove();
    }, dur * 1000 + 150);
  }

  function loop() {
    spawn();
    setTimeout(loop, rand(700, 1100)); // next meteor ~1 s (staggered)
  }
  setTimeout(loop, 1500);
})();
