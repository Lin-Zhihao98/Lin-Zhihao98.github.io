/*!
 * Locks the twinkling stars to fixed points of the deep-field background image,
 * so they stay on the same galaxies regardless of screen size / aspect ratio
 * / browser. Each .twinkle carries data-ix / data-iy = its position as a
 * percentage (0–100) of the cosmic-bg.jpg image. This mirrors the CSS
 * `background: center / cover`, so the stars track the image exactly.
 */
(function () {
  "use strict";
  var IMG = 2560; // cosmic-bg.jpg natural size (square, 2560x2560)
  var layer = document.getElementById("twinkle-layer");
  if (!layer) return;

  function place() {
    var vw = window.innerWidth,
      vh = window.innerHeight;
    var s = Math.max(vw / IMG, vh / IMG); // same scaling as background-size: cover
    var left0 = vw / 2 - (IMG * s) / 2; // image's top-left corner, in viewport px
    var top0 = vh / 2 - (IMG * s) / 2;
    var stars = layer.querySelectorAll(".twinkle");
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var ix = parseFloat(st.getAttribute("data-ix"));
      var iy = parseFloat(st.getAttribute("data-iy"));
      if (isNaN(ix) || isNaN(iy)) continue;
      st.style.left = left0 + (ix / 100) * IMG * s + "px";
      st.style.top = top0 + (iy / 100) * IMG * s + "px";
    }
  }

  place();
  window.addEventListener("resize", place);
  window.addEventListener("orientationchange", place);
})();
