// lanterns.dev — given a parsed route, fill the popup DOM.
// Pure view layer: menu.js owns interaction + routing and hands us the mount
// points; we only write into them. No hash reads/writes here.

import { pages, posts } from './content/en.js';

// The nav, in order. Exported so menu.js builds the strip from the same list.
export const NAV = [
  ['about', 'About'],
  ['works', 'Works'],
  ['news', 'News'],
  ['join', 'Join'],
  ['contact', 'Contact'],
];

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '#news/on-doing-less' -> { name: 'news', slug: 'on-doing-less' }; '' -> null.
export function parseHash(hash) {
  const clean = (hash || '').replace(/^#/, '');
  if (!clean) return null;
  const [name, slug] = clean.split('/');
  return { name, slug: slug || null };
}

const slugify = (s) => s.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

// mount = { title, side, body } — the three elements we fill.
export function render(route, mount) {
  const { title, side, body } = mount;
  side.innerHTML = '';
  body.innerHTML = '';
  side.hidden = true;

  if (route.name === 'news') return renderNews(route.slug, mount);
  if (route.name === 'contact') return renderContact(mount);

  const page = pages[route.name];
  if (!page) {
    title.textContent = 'Not found';
    body.innerHTML = '<p>Nothing lives at this address.</p>';
    return;
  }
  title.textContent = page.title;
  body.innerHTML = page.html;
  buildAnchors(body, side);
}

// Long pages: turn the body's <h2>s into a section-anchor sidebar that
// smooth-scrolls within the popup's scroll container. Only shown at 2+ sections.
function buildAnchors(body, side) {
  const heads = body.querySelectorAll('h2');
  if (heads.length < 2) return;
  side.hidden = false;
  heads.forEach((h) => {
    if (!h.id) h.id = slugify(h.textContent);
    const a = document.createElement('a');
    a.className = 'side-link';
    a.href = `#${h.id}`;
    a.textContent = h.textContent;
    a.addEventListener('click', (e) => {
      // Anchor scroll only — never let it touch the route hash.
      e.preventDefault();
      h.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    });
    side.appendChild(a);
  });
}

// News: sidebar is the post list (real #news/<slug> links, so the hash router
// handles switching + back button + deep links for free). Body shows the
// selected post; #news with no slug shows the newest.
function renderNews(slug, mount) {
  const { title, side, body } = mount;
  const post = posts.find((p) => p.slug === slug) || posts[0];
  title.textContent = 'News';

  side.hidden = false;
  posts.forEach((p) => {
    const a = document.createElement('a');
    a.className = 'side-link side-post' + (p.slug === post.slug ? ' is-active' : '');
    a.href = `#news/${p.slug}`;
    a.setAttribute('aria-current', p.slug === post.slug ? 'true' : 'false');
    a.innerHTML =
      `<span class="side-post-title">${p.title}</span>` +
      `<span class="side-post-date">${fmtDate(p.date)}</span>`;
    side.appendChild(a);
  });

  body.innerHTML =
    `<a class="back" href="#news">← all entries</a>` +
    `<article class="post">` +
    `<p class="post-date">${fmtDate(post.date)}</p>` +
    `<h3 class="post-title">${post.title}</h3>` +
    post.html +
    `</article>`;
}

// Contact: intro copy + the live form. menu.js wires the behavior (contact.js)
// after this renders — render.js stays a pure view layer.
const CONTACT_FORM = `
  <form id="contact-form" class="contact-form" novalidate>
    <div class="field">
      <label for="cf-name">Name</label>
      <input id="cf-name" name="name" type="text" autocomplete="name" required>
      <p class="field-error" data-for="name" aria-live="polite"></p>
    </div>
    <div class="field">
      <label for="cf-email">Email</label>
      <input id="cf-email" name="email" type="email" autocomplete="email" required>
      <p class="field-error" data-for="email" aria-live="polite"></p>
    </div>
    <div class="field">
      <label for="cf-message">Message</label>
      <textarea id="cf-message" name="message" rows="5" required></textarea>
      <p class="field-error" data-for="message" aria-live="polite"></p>
    </div>
    <div class="hp" aria-hidden="true">
      <label for="cf-subject">Subject</label>
      <input id="cf-subject" name="subject" type="text" tabindex="-1" autocomplete="off">
    </div>
    <div class="form-foot">
      <button type="submit" class="form-submit">Send</button>
      <p class="form-status" role="status" aria-live="polite"></p>
    </div>
  </form>`;

function renderContact(mount) {
  const { title, body } = mount;
  title.textContent = pages.contact.title;
  body.innerHTML = pages.contact.html + CONTACT_FORM;
}
