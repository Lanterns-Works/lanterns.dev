// lanterns.dev — WebGL2 lantern scene (spike, behind ?shader)
//
// Implements docs/SPEC-shaders.md: cover-crop transform (§2), wind→flame/water
// coherence (§4), water displacement + ambient sky-glint (§5), disposable-canvas
// lifecycle (§7), mount/coexistence swap (§8), shoreline lanterns (§6), and tree
// rustle (§6.5). Wind couples to water + tree MOTION (never glint brightness).
//
// The region mask is PROCEDURAL (procMask in the shader) — a placeholder for em's
// hand-painted PNG (§3). Swapping to the real texture is a one-line change: sample
// uMask instead of procMask(uv). No effect is flame-coupled on the water: there is
// no lantern reflection (§0.3); water couples to wind only.

(() => {
  'use strict';

  // Gate: only behind ?shader, never over reduced-motion / save-data (keep poster).
  if (!/[?&]shader(?:&|=|$)/.test(location.search)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (navigator.connection && navigator.connection.saveData) return;

  const AR = 3840 / 2143;          // plate aspect (1.79188)
  const DPR_CAP = 2.0;             // §7 fill/thermal cap
  const PHOTO = '/assets/lanterns-background-layer.jpg';
  const MASK = '/assets/lanterns-mask.png';
  const FLAME = [0.73, 0.63];      // --flame-x / --flame-y (style.css)
  const HORIZON = 0.40, DOCK = 0.75;
  const DEBUG = (location.search.match(/[?&]dbg=(\d)/) || [])[1] | 0; // 0 off,1 raw,2 mask,3 att
  const ALL_LAMPS = /[?&]lamps(?:&|=|$)/.test(location.search); // force every lantern lit (tuning)

  const MAX_LAMPS = 4;             // must match FRAG #define
  // Shoreline lantern positions in plate UV, on the treeline/shore (§6). Tiny distant points.
  const LAMP_POS = [
    [0.12, 0.389],   // left shore (up a teeny bit)
    [0.52, 0.390],   // middle, up out of the water onto the treeline
    [0.93, 0.395],   // right edge, down a bit to water level in the trees
    [0.595, 0.392],  // companion, ~120px right of the middle lamp (not eyes)
  ];
  // seconds into the session each lamp winks on (order: left, middle, right, companion).
  // Illumination sequence: right 11s → left 18s → middle 32s → companion 40s.
  const LAMP_IGNITE = [18, 32, 11, 40];

  const scene = document.querySelector('.scene');
  const shimmer = document.querySelector('.shimmer');
  const glowField = document.querySelector('.glow-field');
  if (!scene) return;

  // ---- cover-crop math: mirror style.css:36-43 bit-for-bit (§2) ----
  // Returns the plate rect in drawing-buffer px (origin top-left).
  function plateRect(vw, vh, dpr) {
    const W = Math.max(vw, vh * AR);                 // max(100vw, 179.19vh)
    const H = Math.max(vh, vw / AR);                 // max(100vh, 55.81vw)
    const tx = Math.max(vw - W, Math.min(0.5 * vw - 0.68 * W, 0)); // clamp(...)
    const top = 0.5 * vh - 0.5 * H;                  // top:50% + translateY(-50%)
    return { ox: tx * dpr, oy: top * dpr, w: W * dpr, h: H * dpr };
  }

  // Self-check (§2 invariant): the plate must always cover the viewport, and on
  // portrait it must anchor image-x 0.68 at viewport center. Runs under ?shadertest.
  if (/[?&]shadertest(?:&|=|$)/.test(location.search)) {
    let ok = true;
    for (const [vw, vh] of [[1920, 1080], [1440, 900], [393, 852], [852, 393], [820, 1180]]) {
      const r = plateRect(vw, vh, 1);
      const coversH = r.ox <= 1e-6 && r.ox + r.w >= vw - 1e-6;
      const coversV = r.oy <= 1e-6 && r.oy + r.h >= vh - 1e-6;
      if (!coversH || !coversV) { ok = false; console.warn('[shader] cover FAIL', vw, vh, r); }
    }
    console.log('[shader] cover-crop self-check:', ok ? 'PASS' : 'FAIL');
  }

  // ---- GL setup ----
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    display: 'block', visibility: 'hidden'   // shown on first frame (§8)
  });
  scene.appendChild(canvas);

  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: 'default', preserveDrawingBuffer: false
  });
  if (!gl) return;                 // no WebGL2 → static poster stays (§WebGL2 tail)

  const VERT = `#version 300 es
  void main() {                    // fullscreen triangle, no attributes
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const FRAG = `#version 300 es
  precision highp float;           // §7: iOS clamps to lowp → banded dusk gradients
  precision highp sampler2D;
  #define MAX_LAMPS 4              // must match JS MAX_LAMPS
  uniform vec2  uResolution;       // drawing-buffer px
  uniform vec2  uPlateOrigin;      // §2
  uniform vec2  uPlateSize;
  uniform float uTime;
  uniform float uFlame, uHalo, uCast;   // flame LIGHT echoes (§4b)
  uniform float uWind;                  // wind envelope → water motion (§4c)
  uniform float uTreeWind;              // low-passed wind → tree rustle (§6.5)
  uniform vec2  uFlamePos;
  uniform float uHorizon, uDock;
  uniform int   uDebug;
  uniform int   uLampCount;                    // shoreline lanterns (§6)
  uniform vec2  uLampPos[MAX_LAMPS];
  uniform float uLampIgnite[MAX_LAMPS];
  uniform float uLampFlicker[MAX_LAMPS];
  uniform sampler2D uPhoto;
  uniform sampler2D uMask;
  out vec4 outColor;

  const vec3 WARM = vec3(1.00, 0.62, 0.28);   // sampled-ish from the lamplight
  const vec3 COOL = vec3(0.55, 0.62, 0.72);   // dusk sky, for water glint

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise2(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i), b = hash21(i + vec2(1, 0));
    float c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Sharp directional micro-wave (afl_ext/Alekseev, ShaderToy MdXyzX): exp(sin(x)-1)
  // sits near 0 most of the period, spikes narrowly to 1 at the crest — mostly-flat
  // water with an occasional catching ridge. .x = height ~[0,1]; .y = along-dir slope.
  vec2 wavedx(vec2 pos, vec2 dir, float freq, float phase) {
    float x = dot(dir, pos) * freq + phase;
    float w = exp(sin(x) - 1.0);
    return vec2(w, w * cos(x));
  }

  // One shared calm-water field (§5). Three non-parallel waves at incommensurate
  // freqs (lacunarity 1.9, not 2.0 → no repeat beat), bent by one cheap vnoise warp
  // + derivative drag. band: 0 far(glassy)..1 near(finer). Fills grad (analytic slope,
  // drives displacement); returns crest height ~[0,1] for the glints.
  float waterField(vec2 uv, float t, float band, out vec2 grad) {
    vec2 p = vec2(uv.x, uv.y * 3.0);                 // stretch y → crests run horizontal
    // proper vec2 domain warp (independent x/y offsets) — breaks the directional grid → random
    vec2 warp = vec2(vnoise2(p * 1.6 + vec2(0.0, t * 0.02)),
                     vnoise2(p * 1.6 + vec2(5.2, t * 0.025))) - 0.5;
    p += warp * 0.55;
    float freq = 5.0 + 7.0 * band;                   // perspective: far glassy, near finer
    float amp = 1.0;
    const vec2 D0 = vec2(0.15, 0.99), D1 = vec2(0.55, 0.84), D2 = vec2(-0.40, 0.92);
    const float DRAG = 0.24;                          // derivative warp; >0.28 = oily marble
    float sum = 0.0, wsum = 0.0; grad = vec2(0.0); vec2 r;
    r = wavedx(p, D0, freq,  t * 0.62); p += D0 * r.y * DRAG; sum += r.x*amp; grad += D0*r.y*amp; wsum += amp; amp *= 0.55; freq *= 1.9;
    r = wavedx(p, D1, freq, -t * 0.78); p += D1 * r.y * DRAG; sum += r.x*amp; grad += D1*r.y*amp; wsum += amp; amp *= 0.55; freq *= 1.9;
    r = wavedx(p, D2, freq,  t * 1.00);                       sum += r.x*amp; grad += D2*r.y*amp; wsum += amp;
    return sum / wsum;
  }

  void main() {
    // §2: fragment → plate UV (gl_FragCoord is bottom-left; plate math is top-left)
    vec2 fragTL = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
    vec2 uv = (fragTL - uPlateOrigin) / uPlateSize;
    vec3 mask = texture(uMask, uv).rgb;   // hand-painted region mask (§3): R water, G dock, B flame

    // --- water: one shared directional wave field → displacement + glints (§5) ---
    float band = clamp((uv.y - uHorizon) / (uDock - uHorizon), 0.0, 1.0);
    float att = 0.5 + 0.5 * band;                // floor so mid/far water still moves
    float windAmp = 0.9 + 0.8 * uWind;           // wind = MOTION only, never glint brightness
    vec2 grad;
    float h = waterField(uv, uTime, band, grad); // exp(sin) waves: sharp thin crests, non-uniform
    // vertical-dominant displacement from the field's own slope (motion concentrates at crests)
    vec2 disp = vec2(2.0 * grad.x / 3840.0, 7.0 * grad.y / 2143.0) * att * mask.r * windAmp;

    // --- tree rustle: horizontal sway of the dark treeline, wind-driven MOTION (§6.5) ---
    // Procedural region (painted mask2.R later): treeline band × darkness gate, water excluded.
    float treeBand = smoothstep(0.28, 0.31, uv.y) * (1.0 - smoothstep(0.40, 0.43, uv.y));
    float treeDx = 0.0;
    if (treeBand > 0.0) {                                // gate the tap + noise: skip sky/dock/water (§7)
      float luma = dot(texture(uPhoto, uv).rgb, vec3(0.299, 0.587, 0.114));
      float treeMask = treeBand * (1.0 - smoothstep(0.06, 0.22, luma)) * (1.0 - mask.r); // dark trees, not water
      treeDx = (vnoise2(vec2(uv.x * 7.0, uv.y * 3.0) + vec2(uTime * 0.18, 0.0)) - 0.5)
             * (5.0 + 6.0 * uTreeWind) * treeMask / 3840.0;  // constant floor + wind; out-of-phase clumps
    }

    vec2 suv = uv + disp;
    suv.x += treeDx;
    if (uv.y > uHorizon) suv.y = max(suv.y, uHorizon + 0.002); // water only: never sample shore up
    vec3 col = texture(uPhoto, clamp(suv, 0.0, 1.0)).rgb;

    // --- ripple glints from the SAME field: narrow squared window + noise breakup =
    //     sparse sharp sparkle, not soft blobs (§5) ---
    float crest = smoothstep(0.72, 0.98, h);
    crest *= crest;                              // sharpen: thin sparkle, not a wide ellipse
    crest *= smoothstep(0.45, 0.85, vnoise2(uv * vec2(55.0, 85.0) + uTime * 0.28)); // fragment ridge → points
    // glitter path: glints ride the REFLECTED LIGHT (bright afterglow band), not the dark water;
    // and favor crests tilting toward the sky — a directional glitter, not an even scatter.
    float lightGate = smoothstep(0.05, 0.28, dot(col, vec3(0.299, 0.587, 0.114)));
    float facing = mix(0.55, 1.0, smoothstep(0.0, 0.5, -grad.y));
    crest *= lightGate * facing;
    float trough = smoothstep(0.30, 0.05, h);
    float rGate  = mask.r * att;                 // steady: gusts drive MOTION, never glint brightness
    vec3 ripTint = mix(COOL, WARM, 0.45);        // pale dusk afterglow, cool-warm
    col += ripTint * crest * 0.13 * rGate;       // gain up a touch — the gates cut some intensity
    col -= COOL   * trough * 0.05 * rGate;

    // --- flame light: breathe the already-baked glow, coherently (§4b) ---
    col *= mix(1.0, uFlame, mask.b * 0.9);       // flame core tracks the signal
    float castFall = smoothstep(0.55, 0.0, abs(uv.x - uFlamePos.x)); // strongest near lantern
    col += WARM * (mask.b * uHalo * 0.10 + mask.g * uCast * castFall * 0.08);

    // --- shoreline lanterns: analytic point glows + reflection streaks (§6) ---
    for (int i = 0; i < MAX_LAMPS; i++) {
      if (i >= uLampCount) break;
      vec2 P = uLampPos[i];
      if (abs(uv.x - P.x) > 0.022) continue;                    // per-lamp x-reject (cheap gate)
      float age = uTime - uLampIgnite[i];
      if (age < 0.0) continue;                                  // hasn't lit yet this session
      float lamp = smoothstep(0.0, 1.6, age) * uLampFlicker[i]; // warm-up ramp × per-lamp flicker
      float d = length((uv - P) * vec2(1.0, 1.0 / 1.79188));    // aspect-correct distance
      // a distant point light: a tiny dot + a soft feathered halo (exp falloff, no defined edge)
      float glow = smoothstep(0.004, 0.0, d) + 0.14 * exp(-d / 0.005);
      col += WARM * glow * lamp * 0.5;
      float depth = uv.y - P.y;                                 // small reflection streak into the water
      if (depth > 0.0 && depth < 0.09) {
        float waver = disp.x * 2.0
                    + (vnoise2(vec2(P.x * 40.0 + 5.0, uv.y * 30.0 - uTime * 0.6)) - 0.5) * 0.006;
        float dxr = (uv.x - P.x) + waver;
        float width = 0.0013 + depth * 0.02;                    // narrow, slight widen
        float body = exp(-depth / 0.030) * exp(-(dxr * dxr) / (width * width));
        float g = vnoise2(vec2(P.x * 12.0, uv.y * 110.0 - uTime * 1.6 + float(i)));
        float glint = mix(0.3, 1.0, smoothstep(0.35, 0.75, g));
        col += WARM * body * glint * lamp * mask.r * 0.3;       // subtle
      }
    }

    outColor = vec4(col, 1.0);
    if (uDebug == 1) outColor = vec4(texture(uPhoto, clamp(uv,0.0,1.0)).rgb, 1.0);   // raw photo
    else if (uDebug == 2) outColor = vec4(mask, 1.0);                                 // mask R/G/B
    else if (uDebug == 3) outColor = vec4(vec3(att), 1.0);                            // attenuation
  }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[shader]', gl.getShaderInfoLog(s)); return null;
    }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[shader]', gl.getProgramInfoLog(prog)); return;
  }
  gl.useProgram(prog);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const U = {};
  for (const n of ['uResolution', 'uPlateOrigin', 'uPlateSize', 'uTime',
    'uFlame', 'uHalo', 'uCast', 'uWind', 'uTreeWind', 'uFlamePos', 'uHorizon', 'uDock', 'uDebug',
    'uLampCount', 'uLampPos', 'uLampIgnite', 'uLampFlicker', 'uPhoto', 'uMask']) {
    U[n] = gl.getUniformLocation(prog, n);
  }
  gl.uniform2f(U.uFlamePos, FLAME[0], FLAME[1]);
  gl.uniform1f(U.uHorizon, HORIZON);
  gl.uniform1f(U.uDock, DOCK);
  gl.uniform1i(U.uDebug, DEBUG);

  // ---- shoreline lantern static uniforms (§6): positions + per-session ignition ----
  const lampPos = new Float32Array(MAX_LAMPS * 2);
  const lampIgnite = new Float32Array(MAX_LAMPS);
  const lampFlickerArr = new Float32Array(MAX_LAMPS);
  for (let i = 0; i < MAX_LAMPS; i++) {
    lampPos[i * 2] = LAMP_POS[i][0];
    lampPos[i * 2 + 1] = LAMP_POS[i][1];
    lampIgnite[i] = ALL_LAMPS ? -5 : LAMP_IGNITE[i]; // deterministic wink-on times (?lamps forces all lit)
  }
  gl.uniform1i(U.uLampCount, MAX_LAMPS);
  gl.uniform2fv(U.uLampPos, lampPos);
  gl.uniform1fv(U.uLampIgnite, lampIgnite);

  // ---- textures: photo (unit 0, display-matched) + mask (unit 1, raw data) (§3) ----
  function makeTex(unit) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }
  const tex = makeTex(0), maskTex = makeTex(1);
  let photoLoaded = false, maskLoaded = false;

  function loadTex(url, unit, tObj, colorspace, done) {
    const im = new Image();
    im.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tObj);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, colorspace);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, im);
      done();
    };
    im.onerror = () => { /* keep static poster */ };
    im.src = url;
  }
  // photo = browser-managed (matches the fallback img); mask = NONE so painted values survive (§3)
  loadTex(PHOTO, 0, tex, gl.BROWSER_DEFAULT_WEBGL,
    () => { gl.uniform1i(U.uPhoto, 0); photoLoaded = true; resize(); start(); });
  loadTex(MASK, 1, maskTex, gl.NONE,
    () => { gl.uniform1i(U.uMask, 1); maskLoaded = true; start(); });
  gl.activeTexture(gl.TEXTURE0);

  // ---- sizing (§7: from innerWidth/innerHeight, never vh) ----
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
    const vw = innerWidth, vh = innerHeight;
    const bw = Math.round(vw * dpr), bh = Math.round(vh * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw; canvas.height = bh;
    }
    gl.viewport(0, 0, bw, bh);
    gl.uniform2f(U.uResolution, bw, bh);
    const r = plateRect(vw, vh, dpr);
    gl.uniform2f(U.uPlateOrigin, r.ox, r.oy);
    gl.uniform2f(U.uPlateSize, r.w, r.h);
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', resize);

  // ---- wind + flame signal (§4, JS-side scalar → uniforms) ----
  const rand = (a, b) => a + Math.random() * (b - a);
  function vnoise1(t) {                      // 1D value noise, ~[-1,1]
    const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
    const h = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
    return (h(i) * (1 - u) + h(i + 1) * u) * 2 - 1;
  }
  // gust scheduler → wind envelope [0,1] (replaces main.js scheduler for the canvas)
  let gustStart = -1, gustDur = 0, gustPeak = 0, nextGust = 2500;
  function windEnv(ms) {
    const t = ms / 1000;
    let base = 0.24 + 0.14 * (vnoise1(t * 0.06) * 0.5 + 0.5);   // stronger base breeze [0.24,0.38]
    if (gustStart < 0 && ms >= nextGust) { gustStart = ms; gustDur = rand(500, 1300); gustPeak = rand(0.85, 1.4); }
    let gust = 0;
    if (gustStart >= 0) {
      const a = (ms - gustStart) / gustDur;
      if (a >= 1) { gustStart = -1; nextGust = ms + rand(2500, 8000); }  // gusts more often
      else { const g = a < 0.2 ? a / 0.2 : 1 - (a - 0.2) / 0.8; gust = gustPeak * g * g * (3 - 2 * g); }
    }
    return Math.min(1.25, base + gust);          // headroom for stronger gusts
  }
  function flameSignal(t, wind) {            // ~1-centered, right-skewed (§4b)
    let s = 1
      + 0.210 * vnoise1(t * 0.25)
      + 0.115 * vnoise1(t * 1.10 + 11)
      + 0.065 * vnoise1(t * 3.70 + 23)
      + 0.030 * vnoise1(t * 6.00 + 37);
    s += 0.45 * Math.max(0, vnoise1(t * 0.9 + 5)) ** 3;         // fat upper tail (flares)
    const gutter = wind * (0.22 + 0.15 * Math.max(0, -vnoise1(t * 6 + 3))); // gusts gut it deeper
    return s * (1 - gutter);
  }
  // one-pole low-pass state for halo/cast echoes + tree-wind inertia
  let halo = 1, cast = 1, treeWind = 0.3;

  // ---- render loop with paused-accumulator clock (§7) ----
  let animTime = 0, lastMs = 0, raf = 0, running = false, firstFrame = true;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(now - lastMs, 100) / 1000; // clamp gaps
    lastMs = now;
    animTime += dt;

    const wind = windEnv(now);
    const flame = flameSignal(animTime, wind);
    halo += (flame - halo) * Math.min(1, dt / 0.030);   // τ≈30ms
    cast += (flame - cast) * Math.min(1, dt / 0.080);   // τ≈80ms
    treeWind += (wind - treeWind) * Math.min(1, dt / 0.35); // τ≈350ms: trees lean & settle
    for (let i = 0; i < MAX_LAMPS; i++)                 // per-lamp flicker, decorrelated phase
      lampFlickerArr[i] = 0.82 + 0.18 * (0.5 + 0.5 * vnoise1(animTime * 1.4 + i * 37.3));

    gl.uniform1f(U.uTime, animTime);
    gl.uniform1f(U.uFlame, flame);
    gl.uniform1f(U.uHalo, halo);
    gl.uniform1f(U.uCast, cast);
    gl.uniform1f(U.uWind, wind);
    gl.uniform1f(U.uTreeWind, treeWind);
    gl.uniform1fv(U.uLampFlicker, lampFlickerArr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (firstFrame) {                 // §8: swap poster → canvas after first good frame
      firstFrame = false;
      canvas.style.visibility = 'visible';
      if (shimmer) shimmer.style.display = 'none';
      if (glowField) glowField.style.display = 'none';
    }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running || !photoLoaded || !maskLoaded) return;
    running = true; lastMs = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // reveal the frozen CSS poster again (context loss / backgrounded death)
  function revertToPoster() {
    stop();
    canvas.style.visibility = 'hidden';
    if (shimmer) shimmer.style.display = '';
    if (glowField) glowField.style.display = '';
  }

  // ---- lifecycle (§7) ----
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (!gl.isContextLost()) { lastMs = performance.now(); start(); } // discard the gap
  });
  addEventListener('pageshow', (e) => {
    if (e.persisted && gl.isContextLost()) revertToPoster();               // bfcache killed it
  });
  // Disposable canvas: on loss, show the poster and stop. No preventDefault, no restore.
  canvas.addEventListener('webglcontextlost', revertToPoster);
})();
