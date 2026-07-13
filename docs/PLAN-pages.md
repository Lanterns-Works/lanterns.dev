# Plan: site pages + navigation

*Design approved by em 2026-07-13. Inspo: **earendil.com**. Content is placeholder-only
until em provides real copy. This is the build plan; the shader work is separate
(`SPEC-shaders.md`). Approved and paused here — **pages build starts next session.***

## Next session — start here

**Where we are:** the shader scene is shipped and live; the water v3 (2-octave warp,
gated to `mask.r`) + stronger tree wind are committed (`8ee20b1`) and em-approved. The
pages below are **designed and approved but NOT built yet.**

**Do next:** build the pages, following the **Build order** at the bottom of this doc —
start at step 1 (popup shell + `&`/menu + hash routing). It's feature work → run it
through the build loop (brainstorm is done; go to a written implementation plan, then
build). Build against **placeholder content**; em supplies real copy later.

**Contact form is now unblocked** (em chose **EmailJS**, 2026-07-13) — it ships as a real
working form in this build, not a placeholder. EmailJS is client-side, so no server and no
host migration. Implementation details + build sequence live in `PLAN-pages-build.md`; §6
below is superseded on the "placeholder only" point.

**Run it:** no build step. `python3 -m http.server --directory <repo>` then open
`localhost:8000`; edit and hard-reload (Cmd+Shift+R busts the script cache).

**Carry-forward rules:**
- Commit as `em lorien <em@lanterns.dev>` (automatic via the git conditional-include for
  the Lanterns folder). `main` has branch protection — commit locally; PR/admin-bypass to
  push. No `Co-Authored-By` trailers.
- Front-end stays **zero-dependency, no build**. A dependency is allowed *only* when a
  plan needs it — the eventual contact form (server-side email dep) is the one
  anticipated case; the browser bundle stays hand-written.
- **The gate is em's eye** — judge on desktop *and* the portrait-mobile crop, not a
  checklist. Scene chrome (`#160e0e`/`#e7e5de`) is fixed; light/dark affects only popups.
- Cross-refs: shader → `SPEC-shaders.md` / `HANDOFF-shaders.md`; pages → this doc.

## Decisions (locked)

- **Data-driven vanilla.** Page + post content lives in JS/JSON data; a small
  client-side renderer fills the popups. **No build step** for the front-end, **zero
  browser dependencies** — still hand-written HTML/CSS/JS.
- **Not tied to GitHub Pages**, but a host switch is only ever for the *site's* sake —
  **never for the contact form**.
- **Blog: ~30 posts max**, dead simple. Click a title → show the post. **No search, no
  tags.** Add a CMS only if we outgrow this.
- **Contact form: EmailJS** (chosen 2026-07-13, was TBD). Client-side send, no server,
  no host migration. Built as a live form in this cycle — see `PLAN-pages-build.md`.

## Architecture

### 1. Routing — `location.hash`

Everything hangs off the URL hash: `#about`, `#works`, `#news`, `#news/<post-slug>`,
`#join`, `#contact`. One `hashchange` listener, no router dependency. Gets us the
browser **back button**, a trivial News "back" link (`history.back()` / hash change), and
**shareable deep links** for free.

### 2. The `&` + horizontal menu

A single `&` at the **bottom-left** — same left edge as the logo, footer's baseline
family, font-size **between** the logo and the copyright line. Click → the nav expands
horizontally to the right: **About · Works · News · Join · Contact**, with comfortable
spacing. Click an item → its popup opens. `&` / `Esc` / click-outside closes. One popup
at a time; switching items swaps content. Existing chrome (logo, footer) and the retired
`main.js` gust scheduler are untouched.

- **Mobile:** same horizontal expand; 5 items may crowd a narrow screen, so allow a
  graceful wrap or horizontal scroll of the nav strip and tune the exact treatment by eye.

### 3. The popup

A positioned panel: **desktop** — to the left of the main lantern; **mobile** — covers
most of the scene but **not all** (the lantern glow stays peeking). Text-only, generous
readable padding, its own internal scroll (`overflow-y:auto`) so the page body never
scrolls. Exact placement/sizing is em's eye at build, same gate as the scene.

### 4. Light / dark — tri-state icon toggle (popup-only)

A control inside the popup, cycled by click: **AUTO → Light → Dark → AUTO**.

| State | Shows | Behavior |
|-------|-------|----------|
| **AUTO** *(default)* | the text `AUTO` | follows `prefers-color-scheme` |
| **Light** | a **sun** icon | forces the popup light |
| **Dark** | a **quarter-moon** icon | forces the popup dark |

Icons are inline SVG (zero-dep, crisp, themeable). The choice persists in `localStorage`
so it sticks across popups and visits. It drives **only** the popup's background + text
via CSS custom properties under a `data-theme` attribute — the scene chrome
(`#160e0e` / `#e7e5de`) never changes.

### 5. Content model + the two sidebar shapes

- `content/en.js` — an object of **pages** and an array of **posts** (each post: `slug`,
  `title`, `date`, body). A small `render.js` builds the popup DOM from a page/post.
- **i18n-ready:** later locales are `content/fr.js` etc. keyed by the same shape; the
  language switch is roadmap, structure is ready now (no rewrite).

The in-popup **vertical sidebar** has two modes, both derived from the data:
- **News:** sidebar = list of post titles (+ dates). Click → the post renders in the
  body; a **"back"** link returns to the post list.
- **Long page:** sidebar = **section anchors** from the page's headings. Click →
  smooth-scroll to that section *within the popup's scroll container*.
  (Active-section highlighting / scrollspy is a nice-to-have — **deferred**.)

### 6. Contact (placeholder now, form TBD)

The Contact popup ships as placeholder text for now. When we build the form: a simple
in-popup form (name / email / message) + honeypot, POSTing to a small self-owned endpoint
that emails hello@lanterns.dev via a **trusted dependency em will choose after research**
— no third-party form SaaS. The static site stays put; if a function endpoint is needed
it's deployed standalone so the form is never the reason to migrate hosts.

## Files (all front-end, no build)

| File | Purpose | Depends on |
|------|---------|-----------|
| `content/en.js` | pages + posts data (the single source of copy) | — |
| `menu.js` | `&` toggle, horizontal nav, popup open/close/switch, hash routing, light/dark toggle | `content/en.js`, `render.js` |
| `render.js` | given a page/post → build popup DOM (sidebar + body), wire "back" + anchor scroll | `content/en.js` |
| `pages.css` | `&`/menu, popup panel, light/dark custom properties, sidebar | — |

Each unit has one job and a clear interface: `render(target, route)` takes a hash route
and fills the popup; `menu.js` owns interaction + routing; `content/en.js` is pure data.

## Open decisions / deferred

1. **Contact form dependency** — RESOLVED: **EmailJS** (2026-07-13). Built this cycle.
2. **Mobile `&` menu treatment** — horizontal wrap vs. scroll; tune by eye.
3. **Active-section highlight (scrollspy)** — deferred; anchors work without it.
4. **Host** — stays as-is for now; revisit only for the site's own reasons.

## Roadmap (not now)

- **Contact form** + its dependency (after research).
- **Language translation** — add locale content files + a language switch; data shape is
  ready for it.
- **CMS** — only if we outgrow ~30 hand-authored posts.

## Build order (when we build)

1. Popup shell + `&`/menu + hash routing (empty popups that open/close/switch).
2. `content/en.js` shape + `render.js` for a plain page (About).
3. Light/dark tri-state toggle.
4. News: post-list sidebar → open post → "back".
5. Long-page anchor sidebar + smooth-scroll.
6. Contact placeholder. (Form = later, its own cycle after the dep is chosen.)
7. Eye-gate on desktop + mobile crops; then real content from em.
