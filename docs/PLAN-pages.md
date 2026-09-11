# Plan: site pages + navigation

*Design approved by em 2026-07-13, built and shipped 2026-07-14 (PR #1). **Revised
2026-09-10** for the September direction: Lanterns is a think tank on AI alignment /
welfare and human quality of life; essays moved to a Ghost site. The architecture below
is the July design as built — the September deltas are listed first.*

## Next session — start here

**Where we are (2026-09-12):** the September page set is **live — PR #2 merged to `main`.**
Five nav items — About · **Essays** (external, new tab, `https://essays.lanterns.dev/`, which
Ghost now serves) · Research · Resources · Contact — with em's September copy in `content/en.js`,
Georgia site-wide (Nimbus Mono and its files gone), a slightly wider desktop popup with a 30px
scrollbar gutter, a static footer link and RSS `alternate` to the essays site. Home stays empty
(About opens with "A self-actualized person is like a lantern in the dark"). Works / Join / News and the
placeholder posts are gone. The contact form (EmailJS) stays and carries the "Speaking and
collaboration" copy. PR review is the Claude GitHub app (`.github/workflows/`), proven on PR #2.
Since then: actions float on their major tag (PR #7); em's revised About / Research / Contact
copy, the brand rule (Lanterns capitalized in prose — `CLAUDE.md`), a GitHub link in the footer
(the same glyph as the essays-site footer), and the workflow patch (PR #8). **The two
workflows are this repo's own:** Driver's PR-review rail was retired for Macroscope in August, so
there is no final template to import — patch them in place. They now keep the transcript in the
job log only (it masks secrets; an artifact on a public repo does not), the review marker treats
a skipped run as unreviewed, and the `@claude` rail asks for an adversarial pre-review before it
opens a PR.

**Do next:**
1. Essays theme: `../ghost-edition-lanterns` is on the org (`Lanterns-Works/Ghost-Edition-Lanterns`);
   its state of play is that repo's `docs/HANDOFF.md`.
2. **Attribution:** About is written without a name. em wants the site attributed to
   **em lorien** with a short pseudonymous bio — needs em's words, then a paragraph in
   `content/en.js` `about`.
3. **Research** needs its papers + projects lists; **Resources** its reading list, grouped
   by section (2+ `<h2>`s auto-build the anchor sidebar). Both wait on em's content.
4. **Essays site** (Ghost, custom theme) — plan and open items in
   `../plans/lanterns/essays-site.md`. The Essays page copy from September (intro +
   subscribe + list) belongs to that site's index, not here.
5. Desktop reading width is still an eye-gate item: `.popup` is `min(774px, 56vw)`,
   body measure `38em` at 15–17px Georgia (~75 characters). Tune by eye.

**Run it:** `README.md`, Preview.

**Carry-forward rules:**
- Commit as `em lorien <em@lanterns.dev>` (automatic via the git conditional-include for
  the Lanterns folder). `main` has branch protection — commit locally; PR/admin-bypass to
  push. No `Co-Authored-By` trailers.
- Front-end stays **no-build, hand-written** (native ES modules, no toolchain). The one
  dependency is EmailJS's SDK, vendored in `assets/vendor/` and lazy-loaded by the contact
  form. Don't add others speculatively.
- **The gate is em's eye** — judge on desktop *and* the portrait-mobile crop, not a
  checklist. Scene chrome (`#160e0e`/`#e7e5de`) is fixed; light/dark affects only popups.
- **Style:** casing and type rules live in `CLAUDE.md`; keep em's words.
- Cross-refs: shader → `SPEC-shaders.md` / `HANDOFF-shaders.md`; pages → this doc;
  mission + essays site → the plans repo.

## September 2026 deltas (vs. the July design below)

- **Nav:** `NAV` entries in `render.js` take an optional third element, an external href;
  `menu.js` builds those as plain new-tab links (`target=_blank`, `rel=noopener`) with no `data-route`, so routing,
  active state, and the route allowlist ignore them.
- **Routes:** `parseHash` returns `{ name }` only — no slug routes remain. News, posts,
  `renderNews`, and the Works/Join pages are deleted.
- **Type:** Georgia system stack in `style.css`; no `@font-face`, no font files. Measures
  moved from `ch` to `em`.
- **Ghost, not a CMS:** the "blog ~30 posts, dead simple" decision is superseded — essays
  are on Ghost at essays.lanterns.dev with its own theme. Nothing is fetched from it.
- **Contact:** built (EmailJS), kept; §6 below describes the pre-build state.

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

- **Ambient lake sounds** (em, 2026-07-14) — optional nighttime-at-the-lake audio the user
  can play. **Muted/paused on load — never autoplay**; a small play/pause control (fits the
  popup or the scene chrome), respects reduced-motion/quiet preferences. em is sourcing the
  audio files. A long-term nice-to-have, not urgent.
- **Language translation** — add locale content files (`content/fr.js` …) + a language
  switch; the data shape is already ready for it.
- **CMS** — only if we outgrow ~30 hand-authored posts.

## Build order (when we build)

1. Popup shell + `&`/menu + hash routing (empty popups that open/close/switch).
2. `content/en.js` shape + `render.js` for a plain page (About).
3. Light/dark tri-state toggle.
4. News: post-list sidebar → open post → "back".
5. Long-page anchor sidebar + smooth-scroll.
6. Contact placeholder. (Form = later, its own cycle after the dep is chosen.)
7. Eye-gate on desktop + mobile crops; then real content from em.
