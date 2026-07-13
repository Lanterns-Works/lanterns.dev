# Handoff: lanterns.dev shader scene

*Updated 2026-07-13 — the shader shipped. This supersedes the original pre-build
brief (that version is in git history). Design/planning docs live in the private
plans repo (`plans/lanterns/site.md`); this is the implementation-side handoff.*

## Status: SHIPPED ✅

The animated WebGL2 scene is **live and the default at https://lanterns.dev** (the
`?shader` gate was removed 2026-07-13; verified running on the production URL). What's
in it: displaced water reflection with light-gated glitter glints, a noise-driven
flame flicker that also drives the dock light-cast, four hand-placed shoreline
lanterns that wink on over the first ~40s, and a wind-rustled treeline — all coupled
to **one shared wind envelope** (wind drives MOTION, never glint brightness).

The static CSS scene is **retained as the fallback/poster** for reduced-motion,
save-data, no-WebGL2, and context-loss — the module bows out and the still scene
shows. Nothing was deleted; nobody gets a broken page.

## Where things live

- **`scene-shader.js`** — the entire renderer. Raw WebGL2, GLSL as template strings,
  one fullscreen pass. No build step, no dependencies (and it must stay that way).
- **`assets/lanterns-mask.png`** — hand-painted region mask: **R = water, G = dock
  light-cast, B = flame/glass**. A brand asset (see `assets/LICENSE.md`).
- **`mask-src/`** — the painted source layers (`water_R/dock_G/flame_B.png`) so the
  mask can be re-edited. `mask-ref.png` is regenerable and gitignored
  (`sips -Z 1024 assets/lanterns-background-layer.jpg --out mask-ref.png`).
- **`docs/SPEC-shaders.md`** — the living spec and the source of truth for detail.
  Read the "Shipped v1/v2/v3" notes: §5 v3 (current water — 2-octave warp, gated to
  `mask.r`), §6 (lanterns), §6.5 (tree rustle), and the LAUNCHED note at the end of
  §10. Every tuned number is there.
- **`docs/how-the-scene-works.md`** — non-technical explainer for stakeholders.

## Open / possible next work

1. **Real-iPhone perf gate (do this).** The scene is verified in desktop Chrome and
   on the live URL, but the SPEC's formal gate — *60fps sustained through a 3-minute
   sit on a current iPhone, no thermal ramp, no pop at swap* — has **not** been run
   on a physical device. Cap is DPR 2.0; if it ramps, drop the GL buffer to 1.5×.
   *Matters a touch more since v3:* the water field gained 2 `vnoise2` taps, though
   it's now gated to the water region (`mask.r`) so non-water pays nothing. If it
   ramps, the single knob is `w2`'s `0.22` amplitude (SPEC §5 v3).
2. **Debug harness stays** (em, 2026-07-13) — *not* stripped. It's disabled by
   default (nothing renders without the query param) and zero-cost when off, so it
   just lives in the code until we need it again: `?dbg=1` raw / `2` mask / `3` att,
   `?lamps` (all lit), `?shadertest` (cover-crop self-check → console).
3. **Facing-gate sign** (§5 v2 watch-item). The glint facet-facing gate uses
   `-grad.y`; if on close inspection glints sparkle on the "wrong" side of ripples,
   flip to `grad.y` (one character).
4. **Water uniformity — SHIPPED (v3, 2026-07-13).** The second domain-warp octave (IQ
   recursive warp) is in and em-approved; the field is also now gated to `mask.r`. See
   SPEC §5 v3. Further levers if ever wanted: a 3rd warp octave, or `w2` amp for calm.
5. **Tree mask.** Rustle uses a *procedural* treeline region (band × darkness gate)
   and it works. Only paint a `mask2.R` PNG if live viewing shows it catching a
   non-tree dark region or bleeding at an edge.

## Rules that carry forward (unchanged)

- **Identity:** commit as `em lorien <em@lanterns.dev>` (automatic via the
  conditional-include git config for the Lanterns folder). Push **only** with the
  em-lorien credential, never the work account — GitHub attributes commits and push
  events to the authenticated user.
- **`main` has branch protection** (changes-via-PR required); direct pushes go
  through as an **admin bypass**. Route through a PR if that's ever preferred.
- **No build step / no dependencies is the current state, not a rule** (em,
  2026-07-13). We don't need either for anything planned, so don't add them
  speculatively — but if a plan genuinely calls for a build or a dependency (e.g. the
  pages work in `PLAN-pages.md`), that's allowed. Reach for it only when a plan takes
  us there.
- **Two-color chrome** (`#160e0e`/`#e7e5de`); wordmark is the image, never type. New
  mask PNGs are brand assets under `assets/LICENSE.md`. (The "only copy is footer +
  404" line no longer holds — the pages work adds real content; see `PLAN-pages.md`.)

## How to work here (house convention)

Research the genuine unknowns (fan out) → single-author the change (don't split one
coherent file) → adversarial review → judge on em's eye. The real gate is the eye,
not a checklist. `?dbg=2` shows the mask; `?lamps` previews all shoreline lights.
