// lanterns.dev — the & menu: nav expand, popup open/close/switch, hash routing.
// Module entry point; imports the renderer + content. The hash is the single
// source of truth for what popup is open (shareable deep links + back button).

import { render, parseHash, NAV } from './render.js';

const $ = (s) => document.querySelector(s);
const amp = $('#amp');
const nav = $('#nav');
const popup = $('#popup');
const mount = { title: $('#popup-title'), side: $('#popup-side'), body: $('#popup-body') };
const routeNames = new Set(NAV.map(([n]) => n));

let lastFocus = null; // where focus was before the popup opened

// --- build the nav strip from the same list render.js uses ---
for (const [name, label] of NAV) {
  const a = document.createElement('a');
  a.className = 'nav-item';
  a.href = `#${name}`;
  a.textContent = label;
  a.dataset.route = name;
  nav.appendChild(a);
}

// --- nav (the & strip) ---
function openNav() {
  document.body.classList.add('nav-open');
  amp.setAttribute('aria-expanded', 'true');
}
function closeNav() {
  document.body.classList.remove('nav-open');
  amp.setAttribute('aria-expanded', 'false');
}
const navOpen = () => document.body.classList.contains('nav-open');

// --- popup ---
function openPopup(route) {
  const wasHidden = popup.hidden;
  render(route, mount);
  mount.body.scrollTop = 0;
  nav.querySelectorAll('.nav-item').forEach((a) =>
    a.classList.toggle('is-active', a.dataset.route === route.name),
  );
  openNav(); // nav stays up as tabs while a popup is open
  if (wasHidden) {
    lastFocus = document.activeElement;
    popup.hidden = false;
    document.body.classList.add('popup-open');
    mount.body.focus(); // move focus in on first open only, not on tab-switch
  }
}
function closePopup() {
  if (!popup.hidden) {
    popup.hidden = true;
    document.body.classList.remove('popup-open');
  }
  closeNav();
  const target = lastFocus && lastFocus.focus ? lastFocus : amp;
  target.focus();
  lastFocus = null;
}

// --- routing: hash -> UI ---
function applyHash() {
  const route = parseHash(location.hash);
  if (route && routeNames.has(route.name)) openPopup(route);
  else closePopup();
}

// Drop the fragment cleanly (no lingering '#…') and re-render.
function closeHash() {
  if (location.hash && location.hash !== '#') {
    history.pushState('', document.title, location.pathname + location.search);
  }
  applyHash();
}

window.addEventListener('hashchange', applyHash);
window.addEventListener('popstate', applyHash);

// & click: close everything if a popup's open, else toggle the nav strip.
amp.addEventListener('click', () => {
  if (!popup.hidden) closeHash();
  else if (navOpen()) closeNav();
  else openNav();
});

$('#popup-close').addEventListener('click', closeHash);

// Esc: close popup, else collapse the nav.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!popup.hidden) closeHash();
    else if (navOpen()) closeNav();
  } else if (e.key === 'Tab' && !popup.hidden) {
    trapFocus(e);
  }
});

// Click outside the popup / nav / & closes.
document.addEventListener('click', (e) => {
  if (popup.hidden && !navOpen()) return;
  if (e.target.closest('#popup, #nav, #amp')) return;
  if (!popup.hidden) closeHash();
  else closeNav();
});

// Keep Tab inside the popup while it's an open modal (a11y basic for aria-modal).
function trapFocus(e) {
  const focusable = popup.querySelectorAll(
    'a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])',
  );
  const items = [...focusable].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// --- go: reveal chrome, honor any deep link on load ---
amp.hidden = false;
nav.removeAttribute('hidden');
applyHash();
