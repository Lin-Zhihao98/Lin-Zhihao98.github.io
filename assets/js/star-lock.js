/*!
 * Locks the twinkling stars to fixed points of the deep-field background image,
 * so they stay on the same galaxies regardless of screen size / aspect ratio
 * / browser. Each .twinkle carries data-ix / data-iy = its position as a
 * percentage (0–100) of the cosmic-bg.jpg image. This mirrors the CSS
 * `background: center / cover`, so the stars track the image exactly.
 */
!function(){"use strict";function t(){for(var t=window.innerWidth,n=window.innerHeight,a=Math.max(t/e,n/e),r=t/2-e*a/2,o=n/2-e*a/2,d=i.querySelectorAll(".twinkle"),l=0;l<d.length;l++){var s=d[l],w=parseFloat(s.getAttribute("data-ix")),u=parseFloat(s.getAttribute("data-iy"));isNaN(w)||isNaN(u)||(s.style.left=r+w/100*e*a+"px",s.style.top=o+u/100*e*a+"px")}}var e=2560,i=document.getElementById("twinkle-layer");i&&(t(),window.addEventListener("resize",t),window.addEventListener("orientationchange",t))}();