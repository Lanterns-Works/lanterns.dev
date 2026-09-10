# lanterns.dev

The lanterns front door: one WebGL scene, hash-routed popup pages over it, a contact form.
Static files, no build step, native ES modules, GitHub Pages. Essays live on
**essays.lanterns.dev** (Ghost) — this site only links there.

- **Read first:** `docs/PLAN-pages.md` (state of play + handoff at the top). The wider
  plan lives in the plans repo (`../plans/lanterns/`: `soul.md` mission, `site.md` scene
  spec, `essays-site.md` the Ghost site).
- **Run:** `python3 -m http.server --directory <repo>` → `localhost:8000`; hard-reload
  (Cmd+Shift+R) after edits.
- **Style:** `lanterns` lowercase in prose; the wordmark image carries the period.
  **Georgia** (system stack, nothing vendored) is the one face across this site, the
  essays site, and the newsletter. Two colours, `#160e0e` / `#e7e5de`; light/dark
  affects popups only, never the scene chrome.
- **Copy:** `content/en.js` is the single source. Keep em's words; add structure, don't
  invent. Writing is attributed to **em lorien**.
- **Identity:** commit as `em lorien <em@lanterns.dev>` (git conditional include for
  this folder). Switch `gh` to `em-lorien` before PR work. `main` is protected — branch,
  PR, admin merge. No `Co-Authored-By` trailers.
- **The gate is em's eye** — desktop *and* portrait mobile. Test widths with a
  same-origin iframe, not `resize_window`.
- **Shader:** `docs/SPEC-shaders.md`, `docs/HANDOFF-shaders.md`, `docs/how-the-scene-works.md`.
