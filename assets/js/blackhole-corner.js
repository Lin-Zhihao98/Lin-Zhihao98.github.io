/*!
 * Corner black hole — a real-time ray-traced (geodesic) black hole in the
 * top-right corner of the viewport.
 *
 * This is a faithful port of the WebGL2 black hole by @s13k_ (MIT license),
 * with the page-specific UI (preset buttons, demo overlay, DOM starfield)
 * stripped out:
 *   https://github.com/s0xDk/ghostty-blackhole  ·  https://s13k.dev/blackhole/
 * Shaders are reproduced verbatim. Credit: s13k (https://x.com/s13k_).
 */
(function () {
  "use strict";

  // ----- which look to show (inferno | gargantua | quasar | m87* donut |
  //        blazar | face-on ember | pure lens | zen) -----
  var PRESET = "inferno";

  var DEFAULTS = {
    DISK_TEMP: 5500, DISK_INCL: 1.50, DISK_ROLL: 0.35, DISK_INNER: 1.5,
    DISK_OUTER: 8.0, DISK_OPACITY: 0.90, DOPPLER_MIX: 0.6, DISK_BEAM: 2.5,
    DISK_GAIN: 2.2, DISK_CONTRAST: 1.6, DISK_WIND: 7.0, DISK_SPEED: 5.0,
    STAR_GAIN: 0.35, EXPOSURE: 1.4,
  };
  var PRESETS = {
    "inferno": {},
    "gargantua": { DISK_TEMP: 4500, DISK_INCL: 1.52, DISK_ROLL: 0.10, DISK_INNER: 2.2,
                   DISK_OUTER: 7.0, DISK_OPACITY: 0.85, DOPPLER_MIX: 0.35, DISK_BEAM: 2.0,
                   DISK_GAIN: 1.4, DISK_CONTRAST: 0.5, EXPOSURE: 1.2 },
    "quasar":    { DISK_TEMP: 15000, DISK_INCL: 1.30, DISK_INNER: 3.0, DISK_OUTER: 14.0,
                   DISK_OPACITY: 0.35, DOPPLER_MIX: 1.0, DISK_BEAM: 4.0, DISK_GAIN: 1.2,
                   DISK_CONTRAST: 1.3, DISK_WIND: 8.0, EXPOSURE: 0.8 },
    "m87* donut":{ DISK_TEMP: 3800, DISK_INCL: 0.55, DISK_ROLL: -0.30, DISK_INNER: 2.2,
                   DISK_OUTER: 6.0, DISK_OPACITY: 0.45, DOPPLER_MIX: 0.9, DISK_BEAM: 3.5,
                   DISK_GAIN: 1.6, DISK_CONTRAST: 0.4, DISK_WIND: 3.0, DISK_SPEED: 2.5,
                   EXPOSURE: 1.1 },
    "blazar":    { DISK_TEMP: 18000, DISK_INCL: 1.05, DISK_ROLL: 0.55, DISK_INNER: 3.0,
                   DISK_OUTER: 16.0, DISK_OPACITY: 0.30, DOPPLER_MIX: 1.0, DISK_BEAM: 5.0,
                   DISK_GAIN: 1.0, DISK_CONTRAST: 1.5, DISK_WIND: 9.0, DISK_SPEED: 6.0,
                   EXPOSURE: 0.75 },
    "face-on ember": { DISK_TEMP: 6500, DISK_INCL: 0.30, DISK_ROLL: 0.0, DISK_INNER: 3.0,
                   DISK_OUTER: 10.0, DISK_OPACITY: 0.5, DOPPLER_MIX: 0.8, DISK_BEAM: 2.5,
                   DISK_GAIN: 1.0, DISK_CONTRAST: 1.1, EXPOSURE: 1.0 },
    "pure lens": { DISK_GAIN: 0.0, DISK_OPACITY: 0.0, DOPPLER_MIX: 1.0, STAR_GAIN: 0.7,
                   EXPOSURE: 1.0 },
    "zen":       { DISK_TEMP: 7000, DISK_INCL: 1.45, DISK_ROLL: 0.15, DISK_INNER: 3.5,
                   DISK_OUTER: 7.0, DISK_OPACITY: 0.40, DOPPLER_MIX: 0.5, DISK_BEAM: 2.0,
                   DISK_GAIN: 0.5, DISK_CONTRAST: 0.3, DISK_WIND: 3.0, DISK_SPEED: 1.5,
                   EXPOSURE: 0.7 },
  };

  var canvas = document.createElement("canvas");
  canvas.id = "bh-corner";
  canvas.setAttribute("aria-hidden", "true");
  var st = canvas.style;
  st.position = "fixed";
  st.top = "0";
  st.right = "0";
  st.zIndex = "1";
  st.pointerEvents = "none";

  var gl = canvas.getContext("webgl2", {
    alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: "low-power",
  });
  if (!gl || !(window.matchMedia && window.matchMedia("(min-width: 600px)").matches)) return;
  document.body.appendChild(canvas);

  var FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;        // full viewport size, device px
uniform vec2  uCanvas;     // canvas size, device px — the canvas hugs the top-right
uniform float uTime;
uniform float uDiskTemp, uDiskIncl, uDiskRoll, uDiskInner, uDiskOuter,
              uDiskOpacity, uDopplerMix, uDiskBeam, uDiskGain, uDiskContrast,
              uDiskWind, uDiskSpeed, uStarGain, uExposure;
#define DISK_TEMP     uDiskTemp
#define DISK_INCL     uDiskIncl
#define DISK_ROLL     uDiskRoll
#define DISK_INNER    uDiskInner
#define DISK_OUTER    uDiskOuter
#define DISK_OPACITY  uDiskOpacity
#define DOPPLER_MIX   uDopplerMix
#define DISK_BEAM     uDiskBeam
#define DISK_GAIN     uDiskGain
#define DISK_CONTRAST uDiskContrast
#define DISK_WIND     uDiskWind
#define DISK_SPEED    uDiskSpeed
#define STAR_GAIN     uStarGain
#define EXPOSURE      uExposure

out vec4 outColor;

const float DRIFT_SPEED   = 1.0;
const float HOLE_AREA     = 0.0064;
const float DILATION      = 0.56;
const float WORK_AREA     = 0.03;

#define N_STEPS 64
#define B_CRIT 2.5980762

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}
float vnoiseWrapY(vec2 p, float perY) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float y0 = mod(i.y, perY), y1 = mod(i.y + 1.0, perY);
    return mix(mix(hash21(vec2(i.x, y0)), hash21(vec2(i.x + 1.0, y0)), f.x),
               mix(hash21(vec2(i.x, y1)), hash21(vec2(i.x + 1.0, y1)), f.x),
               f.y);
}
vec2 rot(vec2 v, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
vec2 lissa(float t) {
    return vec2(0.75 * sin(t * 0.37) + 0.25 * sin(t * 0.83 + 1.0),
                0.70 * sin(t * 0.54 + 2.1) + 0.30 * sin(t * 1.07));
}
vec3 blackbody(float T) {
    float t = clamp(T, 1500.0, 40000.0) / 100.0;
    float r = t <= 66.0 ? 1.0
                        : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
    float g = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0)
                        : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
    float b = t >= 66.0 ? 1.0
                        : (t <= 19.0 ? 0.0
                                     : clamp(0.5432068 * log(t - 10.0) - 1.1962540, 0.0, 1.0));
    return vec3(r, g, b);
}
vec3 stars(vec3 d) {
    vec2 sph = vec2(atan(d.x, -d.z), asin(clamp(d.y, -1.0, 1.0)));
    vec2 g   = sph * 40.0;
    vec2 id  = floor(g);
    float h  = hash21(id);
    if (h < 0.92) return vec3(0.0);
    vec2 f   = fract(g) - 0.5;
    vec2 off = (vec2(hash21(id + 17.3), hash21(id + 31.7)) - 0.5) * 0.7;
    float spark = smoothstep(0.10, 0.0, length(f - off));
    float tw    = 0.7 + 0.3 * sin(uTime * (0.5 + 2.0 * hash21(id + 5.1)) + 40.0 * h);
    vec3 tint   = mix(vec3(1.0, 0.82, 0.60), vec3(0.75, 0.85, 1.0), hash21(id + 2.9));
    return tint * spark * tw * ((h - 0.92) / 0.08);
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
    vec2  res = uRes;
    vec2  uv  = vec2(gl_FragCoord.x + res.x - uCanvas.x,
                     uCanvas.y - gl_FragCoord.y) / res;
    float aspect = res.x / res.y;
    float yUp = 1.0 - uv.y;
    float t = uTime * DRIFT_SPEED;

    float rin  = max(DISK_INNER, 1.4);
    float rout = max(DISK_OUTER, rin + 0.5);

    float rh = sqrt(HOLE_AREA * aspect / 3.1415927);
    float marg = rh * 1.45;
    vec2  home = vec2(1.0 - max(0.10, marg / aspect) - 0.055,
                      max(0.12, marg) + 0.045);
    vec2  center = home + lissa(t * 0.22) * vec2(0.055, 0.045)
                 + vec2(0.008 * cos(t * 1.6), 0.007 * sin(t * 1.9));

    float dil = DILATION;
    float shield = smoothstep(WORK_AREA, WORK_AREA + 0.10, yUp);

    vec2  p    = (uv - center) * vec2(aspect, 1.0);
    float plen = length(p);

    float W  = B_CRIT / max(rh, 1e-4);
    vec2  pr = rot(vec2(p.x, -p.y), DISK_ROLL) * W;
    float b  = length(pr);

    float window = exp(-pow(plen / (3.5 * rh), 2.0));
    if (window < 0.002) { outColor = vec4(0.0); return; }

    float bmax = rout + 3.0;
    float Z0   = max(14.0, rout + 5.0);

    if (b >= bmax) {
        vec3 d = normalize(vec3(-(pr / b) * (2.0 / b), -1.0));
        vec3 st = stars(d) * STAR_GAIN * window * shield;
        outColor = vec4(st, clamp(luma(st) * 2.0, 0.0, 1.0));
        return;
    }

    vec3  x  = vec3(pr, Z0);
    vec3  v  = vec3(0.0, 0.0, -1.0);
    float h2 = dot(pr, pr);

    float ci = cos(DISK_INCL), si = sin(DISK_INCL);
    vec3  n  = vec3(0.0, si, ci);
    vec3  e2 = vec3(0.0, ci, -si);
    float sdir = DISK_SPEED < 0.0 ? -1.0 : 1.0;
    float spd  = abs(DISK_SPEED);

    vec3  emitc = vec3(0.0);
    float trans = 1.0;
    bool  captured = false;
    float sPrev = dot(x, n);
    vec3  xPrev = x;

    for (int i = 0; i < N_STEPS; i++) {
        float r2 = dot(x, x);
        if (r2 < 1.0) { captured = true; break; }
        if (x.z < -Z0 && v.z < 0.0) break;
        if (r2 > 4.0 * Z0 * Z0) break;
        float r  = sqrt(r2);
        float dt = clamp(0.20 * r, 0.03, 1.0);
        vec3 a = -1.5 * h2 * x / (r2 * r2 * r);
        v += a * (0.5 * dt);
        x += v * dt;
        r2 = dot(x, x);
        r  = sqrt(r2);
        a  = -1.5 * h2 * x / (r2 * r2 * r);
        v += a * (0.5 * dt);

        float s = dot(x, n);
        if (s * sPrev < 0.0 && trans > 0.02) {
            float tc = sPrev / (sPrev - s);
            vec3  xc = mix(xPrev, x, tc);
            float rc = length(xc);
            if (rc > rin && rc < rout) {
                float band = smoothstep(rin, rin * 1.25, rc)
                           * (1.0 - smoothstep(rout * 0.70, rout, rc));
                float phi   = atan(dot(xc, e2), xc.x);
                float turns = phi / 6.2831853;
                float kep   = pow(rin / rc, 1.5);
                float gloc  = sqrt(max(1.0 - 1.5 / rc, 0.02));
                float swirl = rc * DISK_WIND * 0.12 - t * kep * spd * gloc * dil * sdir;
                float streaks = vnoiseWrapY(vec2(rc * 2.8, turns * 19.0 + swirl * 3.0), 19.0) * 0.65 +
                                vnoiseWrapY(vec2(rc * 1.0, turns * 9.0  + swirl * 1.5 + 7.0), 9.0) * 0.35;
                streaks = 0.35 + DISK_CONTRAST * streaks * streaks;

                vec3  gasdir = normalize(cross(n, xc)) * sdir;
                float beta   = clamp(inversesqrt(max(2.0 * (rc - 1.0), 0.2)), 0.0, 0.99);
                float gf     = gloc / max(1.0 + beta * dot(gasdir, normalize(v)), 0.05);
                gf = mix(1.0, gf, DOPPLER_MIX);

                float xpr   = max(1.0 - sqrt(rin / rc), 0.0);
                float tprof = pow(rin / rc, 0.75) * pow(xpr, 0.25) / 0.488;
                vec3  cbb   = blackbody(DISK_TEMP * tprof * gf);
                float boost = pow(gf, DISK_BEAM);

                float density = band * streaks;
                emitc += trans * cbb * (DISK_GAIN * 2.2 * density * tprof * tprof * boost);
                trans *= 1.0 - clamp(DISK_OPACITY * density, 0.0, 1.0);
            }
        }
        sPrev = s;
        xPrev = x;
    }
    if (!captured && dot(x, x) < 4.0) captured = true;

    vec3 st = vec3(0.0);
    if (!captured) st = stars(normalize(v)) * STAR_GAIN * window * shield;

    vec3  disk = vec3(1.0) - exp(-emitc * EXPOSURE);
    vec3  col  = st * trans + disk;
    float a = clamp((captured ? 1.0 : 0.0) + (1.0 - trans)
                    + luma(disk) * 2.0 + luma(st) * 2.0, 0.0, 1.0);
    outColor = vec4(col, a);
}
`;

  var VERT = `#version 300 es
void main() {
  vec2 v = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}`;

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("blackhole shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  function uname(k) {
    return "u" + k.toLowerCase().replace(/(?:^|_)(\w)/g, function (m, c) { return c.toUpperCase(); });
  }
  var U = {};
  var keys = ["uRes", "uCanvas", "uTime"].concat(Object.keys(DEFAULTS).map(uname));
  for (var i = 0; i < keys.length; i++) U[keys[i]] = gl.getUniformLocation(prog, keys[i]);

  // fixed look: upload the chosen preset's disk tunables once
  var params = Object.assign({}, DEFAULTS, PRESETS[PRESET] || {});
  for (var key in params) gl.uniform1f(U[uname(key)], params[key]);

  var MAX_OUTER = DEFAULTS.DISK_OUTER;
  for (var pk in PRESETS) if (PRESETS[pk].DISK_OUTER) MAX_OUTER = Math.max(MAX_OUTER, PRESETS[pk].DISK_OUTER);

  var dprCap = 2, dpr = 1, viewW = 0, viewH = 0;
  function resizeCanvas() {
    var aspect = innerWidth / innerHeight;
    var rh = Math.sqrt(0.0064 * aspect / Math.PI);
    var marg = rh * 1.45;
    var homeX = 1 - Math.max(0.10, marg / aspect) - 0.055;
    var homeY = Math.max(0.12, marg) + 0.045;
    var reach = rh * Math.max((MAX_OUTER + 3.0) / 2.5980762, 3.5 * 2.5);
    var cssW = Math.min(innerWidth, Math.ceil(((1 - homeX + 0.063) * aspect + reach) * innerHeight));
    var cssH = Math.min(innerHeight, Math.ceil((homeY + 0.052 + reach) * innerHeight));
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    var budget = 2.6e6;
    dpr = Math.min(devicePixelRatio || 1, dprCap);
    if (cssW * cssH * dpr * dpr > budget) dpr = Math.sqrt(budget / (cssW * cssH));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    viewW = innerWidth * dpr;
    viewH = innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resizeCanvas();
  addEventListener("resize", resizeCanvas);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  var t0 = performance.now(), lastDraw = 0, slow = 0;
  function draw(now) {
    gl.uniform2f(U.uRes, viewW, viewH);
    gl.uniform2f(U.uCanvas, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, (now - t0) / 1000);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function perf(interval) {
    if (interval < 48 || interval > 250) { slow = Math.max(0, slow - 1); return; }
    if (++slow >= 20 && dpr > 0.75) { dprCap = Math.max(0.75, dpr * 0.8); resizeCanvas(); slow = 0; }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (now - lastDraw < 30) return; // ~30fps
    perf(now - lastDraw);
    lastDraw = now;
    draw(now);
  }
  requestAnimationFrame(frame);
})();
