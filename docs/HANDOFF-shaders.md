# Handoff: shader rework — water + lantern light

*Written 2026-07-12, after the first live sit with the CSS scene. This is the brief for the next working session in this repo. Design/planning docs live in the private plans repo (`plans/lanterns/site.md`); this file is the implementation-side handoff.*

## The verdict that triggered this

The CSS approximations in the first public cut were judged on the real scene and failed:

- **Water shimmer** (repeating-gradient streaks, `style.css` `.shimmer`): reads as *lines on the screen*, not water. The technique caps out below believability on this photo.
- **Lantern flicker** (radial-gradient breathing + JS gusts): the flame itself now dances, but **the light it casts doesn't** — the glow on the dock planks and the water reflection stay constant while the flame moves. Decoupled light reads unnatural and flat.

Decision (em, 2026-07-12): go shaders for both. This is deliberately the one complex thing on the site — it has to be right. Everything else stays boring.

## The design goal, in two sentences

1. **One flame signal drives all the light.** A single time-varying flicker signal (noise-based) must modulate the flame core, the glass halo, the cast light on the dock planks, and the lantern's water reflection together — coherence is the fix for "flat."
2. **Water that behaves like water.** Barely-there displacement of the plate's water region — calm dusk lake, reflections wobbling slowly — not a ripple effect painted on top.

## Recommended architecture (validate in research before building)

- **One `<canvas>` replacing the `.bg` img** inside the existing `.plate` cover-math box. All DOM chrome (wordmark, footer, 404) untouched.
- **Raw WebGL2 + GLSL fragment shader on a fullscreen triangle**, the plate JPG as a texture. No three.js — it's one quad; the no-dependency rule holds. GLSL lives as template strings in a plain JS file (no build step).
- **Region control via one hand-authored mask texture** (~256px PNG, tiny): R = water, G = dock light-cast zone, B = flame/glass. Painted once against the plate — for an authored photo this beats procedural masks. (Possible channel A: shoreline-lantern positions, see below.)
- **Flicker:** fbm/value-noise `signal(t)` as a uniform → flame brightness, halo, dock-cast gain (slightly lagged/softened), reflection modulation. Wind gusts become an envelope on the same signal (the JS gust scheduler can likely retire).
- **Water:** screen-space UV displacement in the masked region — 2–3 slow noise/sine octaves, amplitude a few px scaling toward the near water, zero at the horizon; plus specular wobble on the reflection band.
- **Fallback is the current scene:** the static plate + frozen CSS glow remain the poster for `prefers-reduced-motion`, WebGL-context failure, and save-data. Mount the canvas only after a successful context + first frame. **Do not delete the CSS scene layers.**
- **Perf gate:** 60fps sustained on the gate device (a current iPhone) through a 3-minute sit, no thermal ramp; cap devicePixelRatio ≈ 1.5–2; pause rAF on `document.hidden`.

## Constraints that carry forward unchanged

Two-color chrome (`#160e0e`/`#e7e5de`); warm values sampled from the plate's own lamplight; wordmark is the image, never type; only copy = footer + 404 line; no build step, no dependencies; brand-asset license carve-out (any new mask PNG is a brand asset → covered by `assets/LICENSE.md`).

## Open research questions (fan out at session start)

1. **Photo-space water displacement** that avoids the "wobbling jello" tell on stills — precedents and parameter ranges (GLSL image-water effects, flag/water displacement shaders).
2. **Flame flicker signal shape** — fbm frequency mix that reads as kerosene flame (slow wander + 1–8Hz micro-flicker), plus gust envelope design.
3. **Mask authoring workflow** — fastest way to paint a 3–4 channel region mask against the plate at ~256px.
4. **WebGL2 vs WebGPU** — WebGL2-everywhere is the presumed boring-right answer for a company page (the Auras engine's WebGPU/TSL ambitions are a different project with different needs); confirm no reason to deviate.
5. **iOS Safari specifics** — context-loss handling, Low Power Mode's 30fps rAF throttle (accept or adapt), in-app webviews (IG/TikTok).
6. **Shoreline lanterns** (queued feature, decided 2026-07-12): points of light in the far-shore dark, each igniting at a random moment in the session, same flicker grammar. Almost certainly folds into this shader as a mask channel + per-point ignition times — design it in rather than bolting on later.

## Suggested loop (house convention)

Research fan-out on the six questions → tight spec in `plans/lanterns/` → single-author spike: shader behind a `?shader` query flag on the live layout, judged on the real iPhone → replace `.shimmer` + `.glow` path → adversarial review → ship. The spike gate is em's eye, not a checklist.

## Repo state when this was written

`main` = the first public cut (CSS shimmer + retuned flicker — the version this handoff deprecates). Site live at https://lanterns.dev (Pages, custom domain, HTTPS enforced). Identity rule for this repo: commits as `em lorien <em@lanterns.dev>` (automatic via conditional-include git config for the Lanterns folder), pushes only with the em-lorien credential — never the work account (see plans-repo memory: GitHub attributes server-side commits and push events to the authenticated user).
