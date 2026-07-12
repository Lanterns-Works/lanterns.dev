// lanterns.dev — WebGL2 lantern scene (spike, behind ?shader)
//
// Implements docs/SPEC-shaders.md: cover-crop transform (§2), wind→flame/water
// coherence (§4), water displacement + ambient sky-glint (§5), disposable-canvas
// lifecycle (§7), mount/coexistence swap (§8). Shoreline lanterns (§6) and tree
// rustle (§6.5) are NOT built here — queued polish.
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
  const FLAME = [0.73, 0.63];      // --flame-x / --flame-y (style.css)
  const HORIZON = 0.40, DOCK = 0.75;
  const DEBUG = (location.search.match(/[?&]dbg=(\d)/) || [])[1] | 0; // 0 off,1 raw,2 mask,3 att

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
  uniform vec2  uResolution;       // drawing-buffer px
  uniform vec2  uPlateOrigin;      // §2
  uniform vec2  uPlateSize;
  uniform float uTime;
  uniform float uFlame, uHalo, uCast;   // flame LIGHT echoes (§4b)
  uniform float uWind;                  // wind envelope → water motion (§4c)
  uniform vec2  uFlamePos;
  uniform float uHorizon, uDock;
  uniform int   uDebug;
  uniform sampler2D uPhoto;
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

  // Placeholder region mask (§3). Replace with texture(uMask, uv).rgb once painted.
  // R = water, G = dock cast zone, B = flame/glass.
  vec3 procMask(vec2 uv) {
    float v = uv.y;
    float water = smoothstep(uHorizon, uHorizon + 0.10, v) * (1.0 - smoothstep(uDock - 0.05, uDock + 0.05, v));
    water *= 1.0 - smoothstep(0.62, 0.72, uv.x) * smoothstep(0.55, 0.70, v); // carve lantern column
    float dock = smoothstep(uDock + 0.01, uDock + 0.09, v);
    float d = length((uv - uFlamePos) * vec2(1.0, 1.0 / 1.79188)); // aspect-correct
    float flame = smoothstep(0.11, 0.02, d);
    return vec3(clamp(water, 0.0, 1.0), clamp(dock, 0.0, 1.0), clamp(flame, 0.0, 1.0));
  }

  // Vertical-dominant anisotropic displacement, in UV (§5). Amplitudes px @ 3840.
  vec2 waterDisp(vec2 uv, float t) {
    float nA = vnoise2(vec2(uv.x * 2.4, uv.y * 8.9)  + vec2(0.0, t * 0.09)) - 0.5; // swell λ1600/240
    float nB = vnoise2(vec2(uv.x * 5.5, uv.y * 22.6) + vec2(0.0, t * 0.20)) - 0.5; // chop  λ700/95
    float nH = vnoise2(vec2(uv.x * 3.2, uv.y * 7.1)  + vec2(t * 0.07, 0.0)) - 0.5; // horiz λ1200/300
    float dyPx = 6.4 * nA + 3.1 * nB;            // peak ~9.5px (livelier twilight ripple)
    float dxPx = 2.4 * nH;
    return vec2(dxPx / 3840.0, dyPx / 2143.0);
  }

  // Fine wave-height field for the ripple GLINTS — the "alive" signal. Horizontally
  // elongated crests (low x-freq, high y-freq) scrolling toward the viewer. ~[0,1].
  float waveH(vec2 uv, float t) {
    float a = vnoise2(vec2(uv.x * 4.0, uv.y * 20.0) + vec2( t * 0.05, t * 0.28));
    float b = vnoise2(vec2(uv.x * 8.0, uv.y * 40.0) + vec2(-t * 0.04, t * 0.46));
    return a * 0.6 + b * 0.4;
  }

  void main() {
    // §2: fragment → plate UV (gl_FragCoord is bottom-left; plate math is top-left)
    vec2 fragTL = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
    vec2 uv = (fragTL - uPlateOrigin) / uPlateSize;
    vec3 mask = procMask(uv);

    // --- water: displacement of the baked reflection (§5) ---
    float band = clamp((uv.y - uHorizon) / (uDock - uHorizon), 0.0, 1.0);
    float att = 0.5 + 0.5 * band;                // floor so mid/far water still moves (was pow→~0 mid)
    float windAmp = 0.9 + 0.8 * uWind;           // never fully still; gusts intensify
    vec2 disp = waterDisp(uv, uTime) * att * mask.r * windAmp;
    vec2 suv = uv + disp;
    if (uv.y > uHorizon) suv.y = max(suv.y, uHorizon + 0.002); // water only: never sample shore up
    vec3 col = texture(uPhoto, clamp(suv, 0.0, 1.0)).rgb;

    // --- ripple glints: moving light crests + shadow troughs — the "alive" signal (§5) ---
    float w = waveH(uv, uTime);
    float crest  = smoothstep(0.56, 0.82, w);    // bright thin crests catch the afterglow
    float trough = smoothstep(0.42, 0.16, w);    // troughs fall into shadow
    float rGate  = mask.r * att;                 // steady: gusts must NOT pulse glint brightness
                                                 // (reads as synced to the flame). Wind drives wave
                                                 // MOTION via displacement, not glint brightness.
    vec3 ripTint = mix(COOL, WARM, 0.45);        // pale dusk afterglow, cool-warm
    col += ripTint * crest * 0.13 * rGate;
    col -= COOL   * trough * 0.06 * rGate;

    // --- flame light: breathe the already-baked glow, coherently (§4b) ---
    col *= mix(1.0, uFlame, mask.b * 0.9);       // flame core tracks the signal
    float castFall = smoothstep(0.55, 0.0, abs(uv.x - uFlamePos.x)); // strongest near lantern
    col += WARM * (mask.b * uHalo * 0.10 + mask.g * uCast * castFall * 0.08);

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
    'uFlame', 'uHalo', 'uCast', 'uWind', 'uFlamePos', 'uHorizon', 'uDock', 'uDebug', 'uPhoto']) {
    U[n] = gl.getUniformLocation(prog, n);
  }
  gl.uniform2f(U.uFlamePos, FLAME[0], FLAME[1]);
  gl.uniform1f(U.uHorizon, HORIZON);
  gl.uniform1f(U.uDock, DOCK);
  gl.uniform1i(U.uDebug, DEBUG);

  // ---- photo texture: display-matched (§3) ----
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let photoLoaded = false;
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.uniform1i(U.uPhoto, 0);
    photoLoaded = true;
    resize();
    start();
  };
  img.onerror = () => { /* keep static poster */ };
  img.src = PHOTO;

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
  // one-pole low-pass state for halo/cast echoes
  let halo = 1, cast = 1;

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

    gl.uniform1f(U.uTime, animTime);
    gl.uniform1f(U.uFlame, flame);
    gl.uniform1f(U.uHalo, halo);
    gl.uniform1f(U.uCast, cast);
    gl.uniform1f(U.uWind, wind);
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
    if (running || !photoLoaded) return;
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
