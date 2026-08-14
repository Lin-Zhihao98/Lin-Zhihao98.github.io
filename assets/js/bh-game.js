/*!
 * Black-hole gravity-slingshot mini-game — homepage easter egg (dark cosmos).
 *
 * A faint hotspot sits over the corner WebGL black hole; clicking it opens a
 * modal with a tiny canvas game: drag to pull back your probe, release to
 * launch it, and curve it around the black hole's REAL (softened Newtonian)
 * gravity into the glowing target ring. Slingshot off the hole without being
 * swallowed.
 *
 * Self-contained: injects its own <style> + DOM, runs its animation loop ONLY
 * while open (zero cost when closed), and supports mouse + touch. Nothing is
 * simulated until the user opens it. Homepage-only (loaded from about.liquid).
 */
(function () {
  "use strict";

  // Desktop / tablet only (matches the corner black hole's own gate).
  if (!window.matchMedia || !window.matchMedia("(min-width: 600px)").matches) return;

  var doc = document;

  /* ---------------------------------------------------------------- styles */
  var style = doc.createElement("style");
  style.textContent =
    "#bhg-hotspot{position:fixed;bottom:22px;right:22px;z-index:50;cursor:pointer;display:flex;" +
    "align-items:center;gap:8px;padding:9px 16px 9px 14px;border-radius:999px;" +
    "font:600 13px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e6eeff;" +
    "background:rgba(18,24,44,.72);border:1px solid rgba(160,200,255,.55);" +
    "-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);" +
    "animation:bhg-hint 2.6s ease-in-out infinite}" +
    "#bhg-hotspot:hover{background:rgba(30,40,72,.92);border-color:rgba(200,225,255,.95);color:#fff}" +
    "#bhg-hotspot .bhg-tri{width:0;height:0;border-left:9px solid #9ec5ff;" +
    "border-top:6px solid transparent;border-bottom:6px solid transparent}" +
    "@keyframes bhg-hint{0%,100%{box-shadow:0 0 0 0 rgba(150,195,255,0)}" +
    "50%{box-shadow:0 0 14px 1px rgba(150,195,255,.35)}}" +
    "#bhg-modal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;" +
    "justify-content:center;background:rgba(4,6,14,.82);-webkit-backdrop-filter:blur(6px);" +
    "backdrop-filter:blur(6px)}" +
    "#bhg-modal.open{display:flex}" +
    "#bhg-stage{position:relative;width:min(93vw,900px)}" +
    "#bhg-canvas{width:100%;height:auto;display:block;border-radius:14px;touch-action:none;" +
    "box-shadow:0 24px 70px rgba(0,0,0,.65)}" +
    ".bhg-x{position:absolute;top:10px;right:12px;width:34px;height:34px;border:0;border-radius:50%;" +
    "background:rgba(255,255,255,.12);color:#e8eefc;font-size:20px;line-height:34px;cursor:pointer;" +
    "z-index:2}" +
    ".bhg-x:hover{background:rgba(255,255,255,.22)}";
  doc.head.appendChild(style);

  /* ------------------------------------------------------------------- DOM */
  var hotspot = doc.createElement("div");
  hotspot.id = "bhg-hotspot";
  hotspot.setAttribute("role", "button");
  hotspot.setAttribute("aria-label", "Play the gravity-slingshot mini-game");
  hotspot.setAttribute("tabindex", "0");
  hotspot.title = "Gravity slingshot — sling a probe around the black hole 🛰️";
  hotspot.innerHTML = '<span class="bhg-tri"></span><span>mini-game</span>';
  doc.body.appendChild(hotspot);

  var modal = doc.createElement("div");
  modal.id = "bhg-modal";
  var stage = doc.createElement("div");
  stage.id = "bhg-stage";
  var canvas = doc.createElement("canvas");
  canvas.id = "bhg-canvas";
  var W = 900,
    H = 560;
  canvas.width = W;
  canvas.height = H;
  var closeBtn = doc.createElement("button");
  closeBtn.className = "bhg-x";
  closeBtn.innerHTML = "&times;";
  closeBtn.setAttribute("aria-label", "Close");
  stage.appendChild(canvas);
  stage.appendChild(closeBtn);
  modal.appendChild(stage);
  doc.body.appendChild(modal);

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  /* -------------------------------------------------------- game constants */
  var GRAV = 6.6e6; // gravitational constant * (mass units below)
  var SOFT2 = 1500; // softening^2 so gravity never blows up at the center
  var PROBE_R = 6;
  var POWER = 1.25; // drag pixels -> launch px/s
  var VMAX = 640;
  var SUBSTEPS = 6;

  // Levels: black holes (with visual radius rv + capture radius rc), a start
  // pad and a target ring. Tuned so each needs a curve, not a straight shot.
  var LEVELS = [
    {
      bhs: [{ x: 620, y: 285, m: 1.0, rv: 26, rc: 34 }],
      start: { x: 120, y: 470 },
      target: { x: 470, y: 110, r: 26 },
    },
    {
      bhs: [{ x: 450, y: 280, m: 1.25, rv: 30, rc: 40 }],
      start: { x: 110, y: 300 },
      target: { x: 790, y: 300, r: 24 },
    },
    {
      bhs: [
        { x: 360, y: 360, m: 0.85, rv: 22, rc: 30 },
        { x: 640, y: 190, m: 0.85, rv: 22, rc: 30 },
      ],
      start: { x: 110, y: 470 },
      target: { x: 800, y: 90, r: 24 },
    },
  ];

  var level = 0;
  var probe, state, msg, attempts, trail, aiming, aimStart, aimNow, rafId, lastT;
  // state: "aim" | "fly" | "win" | "dead"

  function L() {
    return LEVELS[level];
  }

  function reset(keepAttempts) {
    var s = L().start;
    probe = { x: s.x, y: s.y, vx: 0, vy: 0 };
    state = "aim";
    trail = [];
    aiming = false;
    if (!keepAttempts) attempts = 0;
    msg = "";
  }

  function accel(x, y) {
    var ax = 0,
      ay = 0;
    var bhs = L().bhs;
    for (var i = 0; i < bhs.length; i++) {
      var dx = bhs[i].x - x,
        dy = bhs[i].y - y;
      var d2 = dx * dx + dy * dy + SOFT2;
      var inv = GRAV * bhs[i].m / (d2 * Math.sqrt(d2));
      ax += dx * inv;
      ay += dy * inv;
    }
    return [ax, ay];
  }

  // Forward-simulate a launch to preview the path while aiming.
  function predict(vx, vy) {
    var pts = [],
      x = probe.x,
      y = probe.y,
      dt = 1 / (60 * SUBSTEPS);
    for (var i = 0; i < 340; i++) {
      var a = accel(x, y);
      vx += a[0] * dt;
      vy += a[1] * dt;
      x += vx * dt;
      y += vy * dt;
      if (i % 4 === 0) pts.push([x, y]);
      var bhs = L().bhs;
      for (var k = 0; k < bhs.length; k++) {
        var ex = bhs[k].x - x,
          ey = bhs[k].y - y;
        if (ex * ex + ey * ey < bhs[k].rc * bhs[k].rc) return pts;
      }
      var tg = L().target,
        tx = tg.x - x,
        ty = tg.y - y;
      if (tx * tx + ty * ty < tg.r * tg.r) return pts;
      if (x < -180 || x > W + 180 || y < -180 || y > H + 180) return pts;
    }
    return pts;
  }

  function step(dt) {
    if (state !== "fly") return;
    var sub = dt / SUBSTEPS;
    for (var s = 0; s < SUBSTEPS; s++) {
      var a = accel(probe.x, probe.y);
      probe.vx += a[0] * sub;
      probe.vy += a[1] * sub;
      probe.x += probe.vx * sub;
      probe.y += probe.vy * sub;

      var bhs = L().bhs;
      for (var i = 0; i < bhs.length; i++) {
        var dx = bhs[i].x - probe.x,
          dy = bhs[i].y - probe.y;
        if (dx * dx + dy * dy < bhs[i].rc * bhs[i].rc) {
          state = "dead";
          msg = "swallowed 🕳️  — click to retry";
          return;
        }
      }
      var tg = L().target,
        tx = tg.x - probe.x,
        ty = tg.y - probe.y;
      if (tx * tx + ty * ty < tg.r * tg.r) {
        state = "win";
        msg = "orbit achieved 🌟  — click for next";
        return;
      }
      if (probe.x < -200 || probe.x > W + 200 || probe.y < -200 || probe.y > H + 200) {
        state = "dead";
        msg = "lost to deep space 🚀  — click to retry";
        return;
      }
    }
    trail.push([probe.x, probe.y]);
    if (trail.length > 260) trail.shift();
  }

  /* ------------------------------------------------------------ rendering */
  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
  }

  function draw() {
    // backdrop
    var bg = ctx.createRadialGradient(W * 0.5, H * 0.32, 40, W * 0.5, H * 0.32, W * 0.75);
    bg.addColorStop(0, "#0b1226");
    bg.addColorStop(1, "#04060e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // target ring
    var tg = L().target;
    ctx.save();
    ctx.strokeStyle = "rgba(130,230,180,.9)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(120,240,180,.9)";
    ctx.shadowBlur = 16;
    circle(tg.x, tg.y, tg.r);
    ctx.stroke();
    circle(tg.x, tg.y, tg.r * 0.4);
    ctx.fillStyle = "rgba(130,230,180,.25)";
    ctx.fill();
    ctx.restore();

    // black holes with accretion glow
    var bhs = L().bhs;
    for (var i = 0; i < bhs.length; i++) {
      var b = bhs[i];
      var g = ctx.createRadialGradient(b.x, b.y, b.rv * 0.6, b.x, b.y, b.rv * 2.6);
      g.addColorStop(0, "rgba(255,150,60,0)");
      g.addColorStop(0.55, "rgba(255,150,70,.35)");
      g.addColorStop(0.8, "rgba(120,90,255,.22)");
      g.addColorStop(1, "rgba(120,90,255,0)");
      ctx.fillStyle = g;
      circle(b.x, b.y, b.rv * 2.6);
      ctx.fill();
      ctx.fillStyle = "#000";
      circle(b.x, b.y, b.rv);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,190,120,.9)";
      ctx.lineWidth = 2;
      circle(b.x, b.y, b.rv);
      ctx.stroke();
    }

    // trail
    if (trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(trail[0][0], trail[0][1]);
      for (var t = 1; t < trail.length; t++) ctx.lineTo(trail[t][0], trail[t][1]);
      ctx.strokeStyle = "rgba(150,200,255,.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // aim preview
    if (state === "aim" && aiming) {
      var vx = (aimStart.x - aimNow.x) * POWER,
        vy = (aimStart.y - aimNow.y) * POWER;
      var sp = Math.hypot(vx, vy);
      if (sp > VMAX) {
        vx *= VMAX / sp;
        vy *= VMAX / sp;
      }
      var pts = predict(vx, vy);
      ctx.save();
      ctx.setLineDash([2, 7]);
      ctx.strokeStyle = "rgba(200,220,255,.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(probe.x, probe.y);
      for (var p = 0; p < pts.length; p++) ctx.lineTo(pts[p][0], pts[p][1]);
      ctx.stroke();
      ctx.restore();
      // pull-back handle
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(probe.x, probe.y);
      ctx.lineTo(aimNow.x, aimNow.y);
      ctx.stroke();
    }

    // probe
    ctx.save();
    ctx.shadowColor = "rgba(180,215,255,.95)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#eaf2ff";
    circle(probe.x, probe.y, PROBE_R);
    ctx.fill();
    ctx.restore();

    // HUD
    ctx.fillStyle = "rgba(220,230,250,.92)";
    ctx.font = "600 16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Gravity Slingshot  ·  Level " + (level + 1) + "/" + LEVELS.length, 20, 30);
    ctx.fillStyle = "rgba(170,190,220,.8)";
    ctx.font = "13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    ctx.fillText("drag to pull back, release to launch · attempts " + attempts, 20, 52);

    if (msg) {
      ctx.textAlign = "center";
      ctx.fillStyle = state === "win" ? "rgba(140,240,180,.95)" : "rgba(255,180,180,.95)";
      ctx.font = "600 22px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
      ctx.fillText(msg, W / 2, H - 34);
    }
  }

  function loop(ts) {
    if (!modal.classList.contains("open")) return;
    if (!lastT) lastT = ts;
    var dt = Math.min((ts - lastT) / 1000, 0.032);
    lastT = ts;
    step(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  /* --------------------------------------------------------------- input */
  function toCanvas(e) {
    var r = canvas.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    var cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: (cx / r.width) * W, y: (cy / r.height) * H };
  }

  function onDown(e) {
    e.preventDefault();
    if (state === "win") {
      level = (level + 1) % LEVELS.length;
      reset(false);
      return;
    }
    if (state === "dead") {
      reset(true);
      return;
    }
    if (state !== "aim") return;
    aiming = true;
    aimStart = toCanvas(e);
    aimNow = aimStart;
  }
  function onMove(e) {
    if (!aiming) return;
    e.preventDefault();
    aimNow = toCanvas(e);
  }
  function onUp(e) {
    if (!aiming) return;
    e.preventDefault();
    aiming = false;
    var vx = (aimStart.x - aimNow.x) * POWER,
      vy = (aimStart.y - aimNow.y) * POWER;
    var sp = Math.hypot(vx, vy);
    if (sp < 20) return; // too small a flick — ignore
    if (sp > VMAX) {
      vx *= VMAX / sp;
      vy *= VMAX / sp;
    }
    probe.vx = vx;
    probe.vy = vy;
    trail = [[probe.x, probe.y]];
    state = "fly";
    attempts++;
  }

  canvas.addEventListener("mousedown", onDown);
  canvas.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("touchstart", onDown, { passive: false });
  canvas.addEventListener("touchmove", onMove, { passive: false });
  canvas.addEventListener("touchend", onUp, { passive: false });

  /* --------------------------------------------------------- open / close */
  function open() {
    reset(false);
    modal.classList.add("open");
    lastT = 0;
    rafId = requestAnimationFrame(loop);
  }
  function close() {
    modal.classList.remove("open");
    if (rafId) cancelAnimationFrame(rafId);
  }
  hotspot.addEventListener("click", open);
  hotspot.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) close();
  });
  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("open")) close();
  });
})();
