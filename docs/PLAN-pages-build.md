# Implementation plan: pages + navigation build

*The step-by-step "how" for the pages work. The approved design (the "what") is
`PLAN-pages.md` — read that first; this doc only adds implementation decisions and a
build sequence. Branch: `pages-build` → PR to `main` when the build concludes.*

## What changed since the design

**The Contact form is unblocked.** `PLAN-pages.md` deferred it pending an email dependency;
em has chosen **EmailJS** (client-side, account + service ID ready). Because EmailJS runs
entirely in the browser, there is **no server endpoint and no host migration** — the site
stays a static, no-build front-end. So Contact ships as a **real working form** in this
build, not a placeholder (design §6 is superseded on that point).

## Implementation decisions (new — not in the design doc)

1. **ES modules for the new page code.** Native, zero-build, no global-namespace soup.
   `index.html` gets **one** module entry (`<script type="module" src="/menu.js">`);
   `menu.js` imports `render.js`, `content/en.js`, `contact.js`. The existing classic
   `defer` scripts (`main.js`, `scene-shader.js`) are untouched and coexist fine.
2. **EmailJS SDK is lazy-loaded on first Contact open.** Most visitors never open Contact;
   they shouldn't pay for the SDK. On first open we inject the SDK `<script>`, await load,
   `emailjs.init({ publicKey })`, then wire submit. Homepage payload is unchanged.
3. **Vendor the EmailJS SDK** into `assets/vendor/emailjs.min.js` (self-host, like the
   fonts) — no third-party CDN as a runtime single-point-of-failure. `emailjs.sendForm`
   still calls `api.emailjs.com` at submit time (that's the service itself, unavoidable and
   intended). *ponytail: vendoring adds one file but removes a CDN dependency; if em would
   rather not commit a minified blob, the one-line CDN `<script>` is the trivial fallback.*
4. **Config block, not secrets.** EmailJS keys are client-exposed by design. `contact.js`
   holds one clearly-marked `EMAILJS = { serviceId, templateId, publicKey }` const. The
   real abuse-lock is the **domain allowlist in the EmailJS dashboard** (em's task) + a
   honeypot field. No `.env`, nothing to hide — these values are meant to ship in the bundle.

## Files (all front-end, no build)

| File | Job |
|------|-----|
| `content/en.js` | pure data: `export const pages`, `export const posts` (single source of copy) |
| `render.js` | given a route → build popup DOM (sidebar + body); wire News "back" + anchor scroll |
| `menu.js` | **module entry**: `&` toggle, horizontal nav, popup open/close/switch, hash routing, theme toggle |
| `contact.js` | the one file with the dependency: lazy-load EmailJS SDK, init, validate + `sendForm`, states |
| `pages.css` | `&`/menu, popup panel, `[data-theme]` custom props, sidebar, form |
| `assets/vendor/emailjs.min.js` | vendored SDK (curl'd once at build) |

`index.html` gains: `<link rel="stylesheet" href="/pages.css">`, the `&` trigger button
(so the affordance paints instantly), and the one module `<script>`. `menu.js` builds the
nav + popup DOM on load.

## Build order (each step ends green + committed)

1. **Shell + routing.** `&` button (real `<button>`, `aria-label`, `aria-expanded`) →
   horizontal nav (About · Works · News · Join · Contact) → empty popup that
   opens/closes/switches. `hashchange` listener drives everything; `Esc` / click-outside /
   `&` close. Focus moves into popup on open, returns to `&` on close (modal basics).
   Back button works via hash.
2. **Content model + a plain page.** `content/en.js` shape; `render.js` renders **About**
   (a couple of paragraphs + section headings, to exercise step 5's anchor sidebar).
3. **Theme toggle.** Tri-state AUTO → sun → moon, cycled by click, persisted in
   `localStorage` (`lanterns-theme`). Drives `[data-theme]` on the popup only via CSS custom
   props; scene chrome (`#160e0e` / `#e7e5de`) never changes. Inline SVG icons.
4. **News.** Sidebar = post-title list (+ dates) from `posts`; click → post renders in body;
   **back** link → post list. Deep link `#news/<slug>` opens a post directly.
5. **Long-page anchors.** About/long pages: sidebar = section anchors from headings;
   click → smooth-scroll within the popup's scroll container. (Scrollspy stays deferred.)
6. **Contact — live EmailJS form.** Fields `name` / `email` / `message` + hidden honeypot.
   Local validation → lazy-load + init SDK → `emailjs.sendForm(serviceId, templateId, form,
   { publicKey })` → submitting / success / error states, reset on success. Needs em's creds
   (below) to actually send; built code-complete with the config block so it goes live the
   moment the values land.
7. **Eye-gate + PR.** Judge on desktop **and** the portrait-mobile crop (em's eye, not a
   checklist), tune placement/sizing, then open the PR to `main`.

Steps 1–5 have **no external dependency** and get built straight through. Step 6's code is
built in parallel but only goes *live* once em provides the EmailJS values.

## What I need from em (blocks only step 6 going live)

The **EmailJS template ID** and **public key** (Account page) — em mentioned the service ID
but hasn't pasted it, so send all three. And **create/confirm an EmailJS email template**
whose variables match the form field names. With `sendForm`, template variables = input
`name` attributes, so the template should reference: `{{name}}`, `{{email}}`, `{{message}}`
(reply-to set to `{{email}}`). I'll build with placeholder constants and slot the real
values in — nothing else in the build waits on this.

## Testing / verification

- **Run:** `python3 -m http.server --directory <repo>` → `localhost:8000`, hard-reload to
  bust cache. Verify each step by driving it (open/close/switch, back button, deep links,
  theme persistence across reload, form states) — behavior observed, not just "looks done".
- **A11y basics (not skipped):** labelled inputs, `role="dialog"`/focus handling on the
  popup, honeypot hidden from a11y tree, reduced-motion honored on any transitions.
- **Contact self-check:** one runnable check on the validation logic (rejects empty
  required fields / bad email, passes a valid payload) before wiring the real send.

## Deferred (unchanged from design)

Scrollspy; i18n (`content/fr.js` — shape is ready); CMS (only past ~30 posts);
mobile `&`-menu wrap-vs-scroll (tune by eye at step 7).
