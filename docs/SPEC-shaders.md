# Spec: shader rework — water + lantern light

*Implementation-side spec, written 2026-07-12 from the research sweep on the six
questions in `HANDOFF-shaders.md` + an adversarial completeness pass. This is the
build plan for the single-author spike. Every number here is a **starting value**
for the spike, not a final tune — the gate is em's eye on the real iPhone, and the
last section lists what only the spike can settle.*

Read `HANDOFF-shaders.md` first for the *why*. This file is the *how*.

## 0. What changed from the handoff after research

Three things the handoff assumed were overturned or sharpened by research — call
them out so they don't get silently carried forward:

1. **Shoreline lanterns are NOT a mask channel.** The handoff floated "mask A
   channel = positions." Research rejects it: a painted dot answers *"is this
   pixel inside a light?"* (an area query), but a glow + reflection streak needs
   *"where is the light above me?"* (a distance query). Positions go in a uniform
   `vec2[]` array instead. The mask stays 3-channel; the A channel is freed.
2. **The cover-crop seam.** The canvas does not draw a plain fullscreen plate — it
   replaces `.bg` inside a `.plate` box *larger than the viewport* with a custom
   horizontal anchor (`style.css:36-43`). The viewport→plate-UV mapping must be
   ported into the shader or every plate-space coordinate lands wrong. Resolved in
   §2.
3. **There is no lantern reflection on the water — drop that channel entirely.**
   Confirmed on the live scene (em, 2026-07-12): the lantern sits *up on the dock*
   at the right (image-x ≈0.73); its glow lands on the dock and the lantern itself,
   and **never reaches the water**. So the handoff's "flame drives the water
   reflection" coherence channel is not faint — it's *absent*, and faking it would
   invent a coupling the scene doesn't have. The flame drives flame + halo +
   dock-cast only. Water couples to *wind*, not to the flame (see §4a).
4. **The coherence principle generalizes from light to atmosphere** (em,
   2026-07-12). The shared driver is not the flame signal — it's the **wind**. One
   wind envelope must move *everything the wind would naturally touch, together*:
   the flame flicker, the water surface, and the shoreline trees (queued rustle,
   §6.5). Design any new environmental element to inherit this coupling rather than
   bolt it on. See §4a for the model.

## 1. Architecture

- **One `<canvas>` mounted inside `.plate`, sized to the viewport** (not the plate
  box — that box is up to 179vh wide on portrait and would blow the fill budget).
  Raw WebGL2, one fullscreen triangle, fragment shader does everything. No
  three.js, no dependencies, GLSL as template strings in a plain `.js` file.
- **Two textures:** the plate JPG (display-matched) and one mask PNG (raw data).
  Optional second mask PNG only if a 4th channel is ever needed.
- **The flicker signal is computed in JS**, per frame, as scalar uniforms (§4).
  Only *spatial* noise (water displacement) runs per-fragment.
- **Fallback = the current CSS scene, untouched.** Canvas mounts only after a
  successful context + first frame. On any failure → static scene. Do not delete
  `.shimmer` / `.glow-field` (§7).
- **Gate behind `?shader`** on the live layout for the spike.

Two code paths total: WebGL2 animated (~95% of visitors) and the static CSS scene
(the tail + reduced-motion + save-data + failure). No WebGPU, no WebGL1.

## 2. The cover-crop transform (the load-bearing seam — do this first)

The canvas is viewport-sized, but the mask/horizon/flame/lamp coordinates all live
in plate-UV `[0,1]` space. JS mirrors the CSS cover math bit-for-bit and passes the
plate rect as uniforms; the shader inverts it per fragment.

**JS — compute the plate rect in drawing-buffer px (mirrors `style.css:36-43`):**

```js
const AR = 3840 / 2143;                 // 1.79188 — plate aspect
function plateRect(vw, vh, dpr) {
  const W = Math.max(vw, vh * AR);      // CSS: max(100vw, 179.19vh)
  const H = Math.max(vh, vw / AR);      // CSS: max(100vh, 55.81vw)
  // transform: translate(clamp(100vw-100%, 50vw-68%, 0), -50%)
  // "100%" = the plate's own width W. CSS clamp(a,b,c) = max(a, min(b,c)).
  const tx = Math.max(vw - W, Math.min(0.5 * vw - 0.68 * W, 0));
  const top = 0.5 * vh - 0.5 * H;       // top:50% + translateY(-50%)
  // return in drawing-buffer px (origin top-left)
  return { ox: tx * dpr, oy: top * dpr, w: W * dpr, h: H * dpr };
}
// uniforms: uPlateOrigin=(ox,oy), uPlateSize=(w,h), uResolution=(vw*dpr, vh*dpr)
```

**Shader — fragment → plate UV.** `gl_FragCoord` origin is bottom-left; the plate
math above is top-left, so flip y:

```glsl
vec2 fragTL = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
vec2 plateUV = (fragTL - uPlateOrigin) / uPlateSize;   // sample photo & mask here
```

This makes the canvas match the cropped static poster pixel-for-pixel → no pop at
swap, and keeps the perf budget on a viewport-sized buffer (§6). **The CSS clamp is
the single source of truth; JS must not drift from it** — if `style.css` changes,
`plateRect()` changes with it.

## 3. The mask

One **opaque RGB PNG, ~256×143** (plate aspect at 256 long edge). Channels are
continuous gain fields, not region ids:

| Ch | Region | Drives |
|----|--------|--------|
| R | water | displacement amplitude + reflection band |
| G | dock light-cast zone | cast-light gain on the planks |
| B | flame / glass | flame core + halo |

Author: `magick assets/lanterns-background-layer.jpg -resize 256x ref.png`, then
paint three white-on-black grayscale layers over `ref.png` in Krita (soft edges
where transitions should feather), export `water.png` / `dock.png` / `flame.png`,
pack:

```sh
magick water.png dock.png flame.png -channel RGB -combine -strip assets/lanterns-mask.png
```

`-strip` removes gAMA/iCCP so no decoder nudges the painted values. The mask is a
brand asset → covered by `assets/LICENSE.md`.

**Upload config (mask = raw data):**

```js
gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, ...RGBA8 not SRGB8_ALPHA8...);
// MIN_FILTER=LINEAR (NOT a mipmap variant), MAG_FILTER=LINEAR, WRAP=CLAMP_TO_EDGE
```

LINEAR is deliberate — the water finding's no-tear boundary handling *requires* a
feathered edge; NEAREST would give 15px stairsteps and reintroduce tears. No
mipmaps (we only ever magnify 256→viewport; a mipmap min-filter with no mips = a
black texture). **Opaque, no alpha data channel** — an alpha channel over large
zero regions is the exact iOS premultiply-corruption case; if a 4th channel is ever
needed, ship a *second* opaque PNG.

**Verify:** after upload, `readPixels` a texel you painted 255/0/0 and confirm it
reads back ~255/0/0. Drift ⇒ something in the color pipeline is still converting.

**Photo texture = the opposite config:** `UNPACK_COLORSPACE_CONVERSION_WEBGL =
BROWSER_DEFAULT_WEBGL`, RGBA8, sampled in **gamma/sRGB space** (not SRGB8 — no
auto-linearize). This matches the fallback `<img>` exactly so the chrome colors
(sampled from the plate as the browser shows it) stay true. Check the JPG has no
odd ICC profile: `magick identify -verbose`; convert to sRGB at build time if it
does.

## 4. Atmosphere: the wind signal and its consumers (JS-side)

### 4a. Coherence model — wind is the shared driver

The shared driver is **wind** `W(t)`, not the flame. Everything the wind would
naturally touch reads from the same envelope, so a gust ripples through the whole
scene at once — *that* coupling is the coherence, and it's what "extend the
atmosphere to everything" means:

```
wind W(t) ─┬─ flame (LIGHT): fast flicker shaped by W → uFlame, uHalo, uCast
           ├─ water surface:  displacement amplitude + ambient glint scale by W → uWind
           └─ shoreline trees: horizontal rustle scales by W → uWind   (queued, §6.5)
```

Two exposed uniform families: the flame **light** echoes (`uFlame/uHalo/uCast`,
§4b) and the raw **wind** envelope (`uWind`, §4c) for non-light motion. The flame
does **not** drive the water or trees — the wind does, and there is *no* flame
reflection on the water (§0.3). Any future environmental element inherits `uWind`.

### 4b. Flame flicker (the light)

One scalar `signal(t)` in JS per frame. Real small-flame brightness: strong sub-2Hz
wander, flat crackle to ~4–6Hz, near-nothing above, **right-skewed** (flares up more
than it dips), σ≈0.12–0.18 behind glass.

```js
// 4-octave value-noise stack, 1/f-ish weights, centered ~1.0
function signal(t) {
  let s = 1.0
    + 0.130 * vnoise(t * 0.25)      // slow wander (dominant)
    + 0.070 * vnoise(t * 1.10 + 11)
    + 0.040 * vnoise(t * 3.70 + 23)
    + 0.018 * vnoise(t * 6.00 + 37);
  s += 0.35 * max(0, vnoise(t * 0.9 + 5)) ** 3;   // fat upper tail (bright flares)
  return s * wind(t);              // wind gusts deepen + gutter the flame (§4c)
}
```

Three light uniforms — the two lagged ones are one-pole low-pass echoes of `signal`,
so they can never drift out of phase:

| Uniform | Value | Drives |
|---------|-------|--------|
| `uFlame` | `signal(t)` | flame core (mask.B) |
| `uHalo` | `lowpass(τ≈30ms)` | glass halo — barely lagged |
| `uCast` | `lowpass(τ≈80ms)` | dock cast light (mask.G) — softened + lagged |

Cast light lags because diffuse bounce off rough planks + glass diffusion is
literally a temporal low-pass — the planks can't carry the flame's crackle. (The
former `uReflect` is gone: no lantern reflection on the water, §0.3.)

### 4c. The wind envelope (water + trees)

`uWind = wind(t)` exposed directly — a faint base breeze + gusts, range ~[0,1]:
gusts every 4–14s, a 0.4–1.0s envelope, fast attack / slow decay, deepening the
gutter. This replaces the `.glow-field.gust` JS scheduler in `main.js` (retires with
the canvas). Water displacement amplitude (§5) and tree rustle (§6.5) scale with
`uWind`, so a gust that guts the flame simultaneously stirs the water and sways the
trees — one wind, felt everywhere. Keep the water/tree coupling to the *slow*
envelope only; they must not inherit the flame's fast 1–8Hz flicker.

**`uLampFlicker[N]`** (shoreline, §6): precompute in JS from the *same* `vnoise`,
one phase-shifted sample per lamp — keeps the one-scalar architecture, no
per-fragment time-noise.

**Reduced-motion:** freeze `uFlame/uHalo/uCast` at 1.0 and `uWind` at 0, stop rAF —
identical to the poster; gusts never fire.

## 5. Water displacement + glint

Vertical-dominant **anisotropic** FBM offset of the baked reflection. A whole-region
offset is the jello tell — the fix is a field that varies fast in Y (breaks rigid
translation) and slow in X (streaks stay streaks). Confirmed against the plate: the
reflections are grazing-angle and vertical-dominant.

**Displacement (texture-space px @ 3840 width, v: 0=top → 1=bottom):**

- `d_y` octave A: λx≈1600, λy≈240, 0.06Hz, 2.2px · octave B: λx≈700, λy≈95, 0.15Hz, 1.0px
- `d_x`: one decorrelated octave ×0.3 — λx≈1200, λy≈300, 0.05Hz, 0.9px
- speeds deliberately sub-0.2Hz (10–20s wander = calm)

**Horizon attenuation — normalized to the WATER BAND, not the frame** (the fix for
the amplitude bug: v=1 is dock, not water):

```glsl
// v_h = horizon ≈ 0.40, v_dock = dock edge ≈ 0.75  (measure both off the plate)
float att = pow(clamp((v - v_h) / (v_dock - v_h), 0.0, 1.0), 2.0);
vec2 disp = field(plateUV, t) * att * maskR_feathered;   // px → /uPlateSize for UV
```

Boundary safety: feathered `maskR` zeroes displacement at pilings/dock; clamp offset
magnitude to the feather width; hard-clamp displaced `v` to stay below `v_h+ε` (never
sample shore into water); bias the vertical offset downward near the horizon
(`[-0.3A, +1.0A]`).

**Glint (additive — a still photo has no highlights to reveal by offset alone).**
This is *ambient dusk-sky* glint on the water, **not** lamplight — there is no
lantern reflection here (§0.3). Scale both terms by `uWind` (gusts stir the surface
→ a touch more sparkle), **never** by the flame. Tint from the sky/water, cool-neutral,
not warm:

```glsl
// 1. gradient specular (primary, coherent) — pseudo-normal from the field gradient
vec3 n = normalize(vec3(-dhdx, -dhdy, e2));           // e2 flattens; bigger = calmer
float spec = pow(max(dot(n, normalize(uLightDir)), 0.0), 14.0);   // exp 8–20
// 2. sparse sparkle (secondary) — anisotropic uv → horizontal dashes, not dots
float glint = smoothstep(0.80, 0.95, fbm(plateUV * vec2(3.0, 16.0) + t * vec2(0.0, 0.4)));
```

`uLightDir` = the direction of the bright **sky/horizon** band (roughly toward the
sunset glow), *not* the lamp — the glint reveals the dusk sky on the water surface.
Keep total added luminance subtle (dusk, not noon).

**`reflMask` = the sky-reflection band, NOT a lamp pool.** There is no lantern
reflection on the water (§0.3), so don't author `reflMask` under the lantern or from
proximity to mask.B. Author it over the water where the sky reflects (center-left,
below the horizon), and let the glint be a subtle cool sky-sparkle stirred by
`uWind`. The whole water read is: displacement + ambient sky-glint — zero flame
coupling.

### Shipped in spike v1 (2026-07-13) — supersedes the glint design above

Live tuning on the real scene changed the water glint's *form* (the rest of §5
holds). Recorded so this doc doesn't mislead:

- **Glint = moving ripple crests, not gradient-specular.** A dedicated fine
  wave-height field (`waveH`, elongated horizontal crests scrolling toward the
  viewer) drives additive **bright crests** + subtractive **shadow troughs**
  (`smoothstep` bands), not a normal-from-gradient specular. This is what finally
  read as "alive" — displacement alone was invisible on-screen (~1px after the
  cover-crop downscale).
- **Glint brightness is decoupled from `uWind`.** Coupling glint *brightness* to the
  gust envelope made the waves pulse in lockstep with the flame gutter — reads as
  wrong. Wind now drives wave **motion** (displacement amplitude via `windAmp`)
  only; glint brightness is steady (`rGate = mask.r * att`). Keep this rule: wind →
  motion, never → synchronized brightness.
- **Attenuation de-gated:** `att = 0.5 + 0.5*band` (linear, floored), not `pow(…,2)`
  — the power curve starved the mid-water where the reflection lives.
- **Amplitudes (spike v1, still procedural-mask):** displacement peak ~9.5px
  (`6.4·nA + 3.1·nB`); crest gain 0.13 / trough 0.06; wind base [0.24,0.38], gusts
  peak ≤1.4 every 2.5–8s; flicker weights ~1.6× the §4b baseline. All em-tuned;
  expect to re-tune against the hand-painted mask.
- Debug harness left in (`?dbg=1` raw / `2` mask / `3` att, `?shadertest` cover
  check) — strip when the spike promotes to the default path.

### Shipped v2 (2026-07-13) — water reworked after "not real enough" (research-driven)

The value-noise displacement + crest/trough glints were replaced wholesale (research
sweep: `exp(sin)` directional waves + domain warp). This is the current water.

- **One shared directional wave field** (`waterField`): 3 non-parallel `wavedx`
  (`exp(sin(x)-1)`, afl_ext/Alekseev) at incommensurate freqs (**lacunarity 1.9**,
  not 2.0 → no repeat beat), bent by a **vec2 domain warp** (independent x/y — the
  real grid-breaker) + derivative drag (`DRAG 0.24`). Fills an analytic `grad`.
- **Displacement from `grad`** (motion concentrates at crests, troughs stay glassy),
  vertical-dominant (`dyPx 7`), perspective freq `5+7·band`, gain 0.55, wave speeds
  slowed ~0.7×.
- **Glints** = narrow squared window `smoothstep(0.72,0.98,h)²` × high-freq breakup
  noise → sparse sharp points (fixes "glints too large"), **gated to a glitter path**:
  `lightGate = smoothstep(0.05,0.28, luma(reflection))` so glints ride the bright
  afterglow, not dark water, × a facet-facing gate `mix(0.55,1,smoothstep(0,0.5,-grad.y))`.
- Cheaper than v1 (~4 vnoise2-equiv vs 5), same 1 water fetch. Full plan +
  parameter ranges: research output `wo6xde8iu` / journal. Watch-items: facing-gate
  sign (`-grad.y` vs `grad.y`), far-water staying glassy, `DRAG>0.28` = oily marble.

## 6. Shoreline lanterns (shipped — spike v1)

Uniform `vec2[]` array, evaluated analytically. `MAX_LAMPS` compile-time bound
(≈20) with a `uLampCount` guard; unroll (don't use a uniform loop bound — mobile
driver safety). WebGL2 gives ≥224 vec4 uniform slots; 20 vec2 + arrays is nothing.

Per lamp `i`: `uLampPos[i]` (plate UV, authored by eye on the treeline),
`uLampIgnite[i]` (seconds, from JS), `uLampFlicker[i]` (§4).

**Reflection streak** — vertical exponential column, offset by the *same* water
field so it wobbles coherently with the main reflection:

```glsl
// gate the whole pass to the treeline→reflection band first (kills ~75% of pixels)
for (int i = 0; i < MAX_LAMPS; i++) {
  if (i >= uLampCount) break;
  float age = t - uLampIgnite[i];
  if (age < 0.0) continue;                         // unlit → skip all work
  vec2 P = uLampPos[i];
  if (abs(plateUV.x - P.x) > 0.06) continue;       // per-lamp X-reject before transcendentals
  float ignite = smoothstep(0.0, 1.2, age);        // warm-up ramp (flames don't step on)
  float depth  = plateUV.y - P.y;                  // below the mirror point
  float dx     = plateUV.x - P.x + waterDispX * att;   // SAME field → coherent wobble
  float streak = exp(-depth / L) * exp(-dx*dx / (W*W)) * glintBreakup;
  col += streak * ignite * uLampFlicker[i] * warmTint;
}
```

Ignition schedule from JS at mount: seed ~35% pre-lit (shore isn't empty on
arrival), stagger the rest over ~180–240s so a 3-min sit sees a few wink on. No
extinguish logic — the brief only asks them to wink *on* (YAGNI). Cost with the two
gates: effectively ~1–3 lamps of real work per in-band fragment — negligible next
to the water FBM.

### Shipped in spike v1 (2026-07-13) — concretions from em's live tuning

- **`MAX_LAMPS = 4`, hand-placed**, not a ~20 scattered field — a sparse deliberate
  set in `LAMP_POS` (plate UV): left shore `(0.12,0.389)`, center treeline
  `(0.52,0.390)`, right tall-trees at water level `(0.93,0.395)`, companion ~120px
  right of center `(0.595,0.392)`. Nudged by eye against the plate.
- **Deterministic ignition**, not random pre-lit: `LAMP_IGNITE = [18,32,11,40]`s
  (right 11 → left 18 → middle 32 → companion 40), a composed sequence. `?lamps`
  forces all lit for position tuning.
- **Tiny distant points.** Glow = a ~0.004 core + a *feathered exp halo*
  (`0.14·exp(-d/0.005)` — a smoothstep disc read as a defined ring), dim (×0.5),
  casts ~no scene light ("just a little dot of light").
- **Streak** = broken glitter path, not a laser: `exp(-depth/0.03)`, widens with
  depth, wavers via `disp.x` + noise, dashed by a glint noise, gated `depth<0.09` +
  `mask.r`, tight `abs(uv.x-P.x)<0.022` reject.
- Per-lamp flicker `0.82+0.18·vnoise1(t·1.4 + i·37.3)` — gentle, decorrelated,
  flattened so distant points don't strobe.

## 6.5 Shoreline trees — wind rustle (shipped — spike v1)

Queued feature (em, 2026-07-12), same "design-it-in not bolt-it-on" stance as the
lanterns: the far-shore treeline should **rustle subtly in sync with the wind** that
guts the flame. When a gust hits, the flame flickers, the water stirs, *and* the
trees sway — one wind, felt across the whole environment (§4a). Without this the
gust reads as a lamp-only event, which is the "flat" tell one level up.

Region control needs a treeline mask. **Not** the mask's alpha channel — §3's
no-alpha-data rule holds (iOS premultiply corruption) — so ship it as a **second
opaque RGB PNG** (`lanterns-mask2.png`, `mask2.R` = treeline), same authoring +
upload config as the primary mask. Cheap (~256px, another brand asset under
`assets/LICENSE.md`). Sketch, to validate at the spike:

- **Region:** paint `mask2.R` over the treeline silhouette + foliage band (the dark
  far shore, roughly v ∈ [0.30, 0.42], not flat — dips center, rises at the edges).
- **Motion:** small **horizontal** screen-space displacement of those pixels (trees
  bend sideways, not up), a slow spatial noise so different stretches sway out of
  phase (anti-jello, same lesson as water), amplitude ~1–2px @ 3840 — distant blurred
  silhouette, so barely-there. `disp.x = treeNoise(uv,t) * uWind_ish * mask2.R`.
- **Coupling:** scale amplitude by the **wind envelope** (a faint base breeze +
  `uWind` gusts), *not* the flame's fast flicker — trees have inertia; they lean on
  gusts, they don't strobe at 8Hz. A one-pole low-pass of `uWind` (τ≈300–500ms) gives
  the lean-and-settle. Optionally add a per-column phase so the sway travels along
  the shore like a real gust front.
- **Cost:** one masked horizontal tap in the treeline band, early-out on `mask2.R`;
  negligible. One extra small texture; no new per-frame uniforms — reuses `uWind`.

Same freeze-on-reduced-motion rule (`uWind`=0 → trees still). Ship after the core
water+flame reads right; this is the atmospheric polish pass, not the spike gate.

### Shipped in spike v1 (2026-07-13)

Built with a **procedural region, no painted mask2** — and it works, so the second
PNG is deferred (paint one only if live viewing shows the rustle catching a non-tree
dark region or bleeding at an edge). Region = treeline band
`smoothstep(0.28,0.31,v)·(1-smoothstep(0.40,0.43,v))` × a **darkness gate** (luma <
~0.22 from one uPhoto tap) × `(1-mask.r)` (exclude water). Horizontal sway
`(vnoise2(uv·(7,3)+t·0.18)-0.5) · (5.0 + 6.0·uTreeWind) / 3840` — a **constant floor
+ wind** (em: "constant subtle movement that increases when wind blows").
`uTreeWind` = JS one-pole low-pass of the wind envelope (τ≈350ms) for lean-and-
settle. Luma tap + noise guarded behind `if (treeBand > 0.0)` so sky/dock/water skip
them (review fix). Couples to wind as MOTION only, never brightness (§4c).

## 7. iOS / perf / lifecycle

- **Context loss → dispose, don't restore.** On `webglcontextlost`: cancel rAF,
  hide canvas, show static scene. No `preventDefault`, no restore handler, no
  resource rebuild — the fallback is pixel-perfect and iOS drops contexts for
  reasons outside our control (backgrounding, whole-OS WebKit regressions). Add
  restore only if a live sit shows losses in *normal* use.
- **Time-based clock, paused accumulator** (never a frame counter):
  ```js
  const now = performance.now();
  animTime += now - lastFrameMs; lastFrameMs = now;   // drive uTime from animTime
  ```
  This makes 30fps Low Power Mode (undetectable — no API), 60fps default, and
  thermal-throttled frames all look correct.
- **Visibility/bfcache:** on `document.hidden` → `cancelAnimationFrame`, stop. On
  resume → set `lastFrameMs = performance.now()` *before* rAF (discards the gap so
  the flame doesn't teleport). On `pageshow` → check `gl.isContextLost()`; if dead,
  reveal static scene (same path as loss).
- **Sizing:** canvas from `innerWidth/innerHeight` (or `100dvh`), re-measure on
  `resize`/`orientationchange`. Never hard-code `vh` (WKWebView toolbar breaks it).
- **Budget @ DPR 2 (cap 2.0, drop to 1.5 if the 3-min sit ramps):** ≤5 texture
  fetches/fragment (base, displaced re-tap, mask, optional reflection tap, optional
  noise tap — one dependent fetch max); ≤3 noise octaves; `precision highp float`
  (iOS clamps to lowp otherwise → banded dusk gradients). Early-out the expensive
  water/streak math on the mask value so sky/dock fragments stay cheap. Target
  ≤10–12ms warm so the throttle step (55–70% peak clock after ~2–3min) doesn't blow
  frame. The 3840px photo (~33MB) needs no downscale (4096 texture floor).
- **Context:** `{ alpha: false }` (opaque photo fully covers) — A/B at spike; the
  iOS finding flagged a possible perf cost, defensible either way.

## 8. Mount / coexistence with the CSS scene

The poster the canvas replaces is the **frozen CSS scene** — `img` + `.glow` @0.9 +
`.shimmer` @0.4 (`style.css:181-186`), not the bare `<img>`.

- On successful first frame: `display:none` **both** `.shimmer` and `.glow-field`,
  show canvas. (If left visible, the CSS screen-blend glow *doubles* the shader
  glow.)
- On context loss / reduced-motion / save-data: reverse — hide canvas, show frozen
  CSS scene.
- Tune the shader's `t=0` frame to approximate the frozen poster so the swap has no
  visible pop.

## 9. Uniforms (the full list)

```
uPlateOrigin  vec2   plate rect origin, drawing-buffer px   (§2)
uPlateSize    vec2   plate rect size, drawing-buffer px      (§2)
uResolution   vec2   drawing-buffer px                       (§2)
uTime         float  animTime seconds (paused accumulator)   (§7)
uFlame,uHalo,uCast  float  flame LIGHT echoes                (§4b)
uWind         float  wind envelope → water + trees motion    (§4c)
uLightDir     vec2   sky/horizon direction for glint spec    (§5)
uLampCount    int                                            (§6)
uLampPos[N]   vec2   plate UV                                 (§6)
uLampIgnite[N] float seconds                                 (§6)
uLampFlicker[N] float per-frame, JS-computed                 (§6)
sampler2D uPhoto, uMask                                       (§3)
sampler2D uMask2       // treeline — queued, §6.5 only
// constants baked into shader: v_h≈0.40, v_dock≈0.75, MAX_LAMPS≈20
```

## 10. Build order + gates

1. Canvas mount + cover-crop transform (§2), photo texture only → **must match the
   static poster exactly** at every viewport aspect. This is the correctness gate;
   nothing else is worth tuning until the crop is pixel-true.
2. Mask upload + verify readback (§3).
3. Flicker uniforms (§4) → flame/halo/cast driven; judge the coherence fix.
4. Water displacement + glint (§5) → judge against the **portrait crop first**
   (that's what gets seen on mobile; desktop shows the wide left-water, secondary).
5. Shoreline lanterns (§6).
6. Lifecycle + context-loss + reduced-motion swap (§7, §8).
7. **The gate:** 60fps sustained through a 3-min sit on a current iPhone, no thermal
   ramp, no pop at swap — and em's eye says the water reads as water and the light
   moves together. Then replace the `.shimmer`/`.glow` path and drop `?shader`.

**LAUNCHED (2026-07-13):** the `?shader` gate was removed — the shader is now the
default at the root domain. The CSS `.shimmer`/`.glow` scene is **retained, not
deleted**: it's the fallback/poster for reduced-motion, save-data, no-WebGL2, and
context-loss (the module bows out and the static scene shows). Debug affordances
(`?dbg`, `?lamps`, `?shadertest`) kept in — zero-cost when off, useful for tuning;
strip in a follow-up if a pristine public build is wanted.

## 11. What only the spike can settle (calibrate on the real iPhone)

- Exact `v_h` and `v_dock` measured off the plate; the treeline dips center / rises
  at the edges, so a single flat `v_h` is an approximation — check streak origins at
  the frame edges.
- `reflMask` placement over the sky-reflection band (center-left water) and the
  cool sky-glint intensity — **settled that there's no lantern reflection** (§0.3),
  so this is band placement + eye, not a "does a spill exist" question.
- Tree rustle (§6.5): treeline `mask2` region, sway amplitude (~1–2px), the `uWind`
  low-pass τ, and whether a per-column phase (traveling gust front) is worth it —
  post-gate atmospheric polish, judged by whether a gust visibly moves flame + water
  + trees as one.
- All displacement amplitudes / wavelengths against the **mobile-visible** water
  strip, not the full plate. Verified crop: a portrait iPhone (e.g. 393×852) sees
  plate-UV.x ≈ **[0.55, 0.81]** — a strip just left of the lantern; the wide
  left-water (UV.x < 0.55) is cropped off. Landscape/desktop show the full width.
  Wavelengths/crest-counts calibrate to the water *height* visible in that strip.
- DPR 2.0 vs 1.5; `alpha:false` vs true.
- Glint exponents / `e2` flatten factor / sparkle density — pure eye.
- Gust depth + cadence vs the retired CSS scheduler's feel.
