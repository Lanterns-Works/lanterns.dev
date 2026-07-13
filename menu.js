// lanterns.dev — the & menu: nav expand, popup open/close/switch, hash routing.
// Module entry point; imports the renderer + content. The hash is the single
// source of truth for what popup is open (shareable deep links + back button).

import { render, parseHash, NAV } from './render.js';
import { wireContactForm } from './contact.js';

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
  if (route.name === 'contact') wireContactForm(document.getElementById('contact-form'));
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

// --- light / dark: tri-state AUTO -> sun -> moon, popup-only, persisted ---
const THEME_KEY = 'lanterns-theme';
const THEMES = ['auto', 'light', 'dark'];
const SUN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="4.2"/>' +
  '<path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/></svg>';
const MOON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"/></svg>';
const THEME_FACE = { auto: 'AUTO', light: SUN, dark: MOON };
const THEME_LABEL = {
  auto: 'Theme: auto — follows your system. Activate to force light.',
  light: 'Theme: light. Activate to force dark.',
  dark: 'Theme: dark. Activate to return to auto.',
};

const themeBtn = $('#theme-toggle');
const readTheme = () => {
  const t = localStorage.getItem(THEME_KEY);
  return THEMES.includes(t) ? t : 'auto';
};
function applyTheme(t) {
  if (t === 'auto') popup.removeAttribute('data-theme');
  else popup.setAttribute('data-theme', t);
  themeBtn.innerHTML = THEME_FACE[t];
  themeBtn.setAttribute('aria-label', THEME_LABEL[t]);
}
themeBtn.addEventListener('click', () => {
  const next = THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length];
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// --- go: reveal chrome, restore theme, honor any deep link on load ---
amp.hidden = false;
nav.removeAttribute('hidden');
applyTheme(readTheme());
applyHash();
