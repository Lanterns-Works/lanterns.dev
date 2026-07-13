// lanterns.dev — the lantern menu: toggle, nav, popup open/close/switch, routing.
// Module entry point; imports the renderer + content. The hash is the single
// source of truth for which page-popup is open (deep links + back button). The
// mobile "menu" (popup open on no page) is a transient UI state, like the
// desktop nav strip being expanded.

import { render, parseHash, NAV } from './render.js';
import { wireContactForm } from './contact.js';

const $ = (s) => document.querySelector(s);
const amp = $('#amp');
const nav = $('#nav');
const popupNav = $('#popup-nav');
const popup = $('#popup');
const lantern = $('.popup-lantern');
const mount = { title: $('#popup-title'), side: $('#popup-side'), body: $('#popup-body') };
const routeNames = new Set(NAV.map(([n]) => n));
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => matchMedia('(max-width: 760px)').matches;
const isOpen = () => document.body.classList.contains('popup-open');

let lastFocus = null;
let hideTimer = null;
let lanternTimer = null;

// --- build the nav into BOTH the desktop strip and the in-popup (mobile) list ---
for (const [name, label] of NAV) {
  for (const host of [nav, popupNav]) {
    const a = document.createElement('a');
    a.className = 'nav-item';
    a.href = `#${name}`;
    a.textContent = label;
    a.dataset.route = name;
    host.appendChild(a);
  }
}
function setActiveNav(name) {
  document.querySelectorAll('.nav-item').forEach((a) =>
    a.classList.toggle('is-active', a.dataset.route === name),
  );
}

// --- nav strip (desktop) ---
function openNav() {
  document.body.classList.add('nav-open');
  amp.setAttribute('aria-expanded', 'true');
}
function closeNav() {
  document.body.classList.remove('nav-open');
  amp.setAttribute('aria-expanded', 'false');
}
const navOpen = () => document.body.classList.contains('nav-open');

// --- popup show / hide, with enter + exit transitions ---
function showPopup() {
  clearTimeout(hideTimer);
  const first = popup.hidden;
  if (first) {
    lastFocus = document.activeElement;
    popup.hidden = false;
    void popup.offsetHeight; // reflow so the enter transition runs from the hidden state
    document.body.classList.add('popup-open');
    updateAmpSurface();
    startLantern();
  }
  return first;
}
function hidePopup() {
  if (popup.hidden) return;
  document.body.classList.remove('popup-open');
  updateAmpSurface();
  stopLantern();
  hideTimer = setTimeout(() => { popup.hidden = true; }, 360); // after the exit transition
  const target = lastFocus && lastFocus.focus ? lastFocus : amp;
  target.focus();
  lastFocus = null;
}

function openPage(route) {
  const first = showPopup();
  render(route, mount);
  if (route.name === 'contact') wireContactForm(document.getElementById('contact-form'));
  mount.body.scrollTop = 0;
  setActiveNav(route.name);
  openNav(); // desktop strip acts as tabs; harmless on mobile
  if (first) mount.body.focus();
}

// mobile: the toggle opens the popup as the menu (nav list, no page yet)
function openMenu() {
  const first = showPopup();
  mount.title.textContent = '';
  mount.side.hidden = true;
  mount.side.innerHTML = '';
  mount.body.innerHTML = '';
  setActiveNav(null);
  if (first) (popupNav.querySelector('.nav-item') || mount.body).focus();
}

// --- routing: hash -> UI ---
function applyHash() {
  const route = parseHash(location.hash);
  if (route && routeNames.has(route.name)) openPage(route);
  else {
    hidePopup();
    closeNav();
  }
}
// drop the fragment cleanly (no lingering '#…') and re-render
function closeHash() {
  if (location.hash && location.hash !== '#') {
    history.pushState('', document.title, location.pathname + location.search);
  }
  applyHash();
}

window.addEventListener('hashchange', applyHash);
window.addEventListener('popstate', applyHash);

// toggle: close if anything's open, else open the menu (mobile) / nav strip (desktop)
amp.addEventListener('click', () => {
  if (isMobile()) {
    if (isOpen()) closeHash();
    else openMenu();
  } else if (isOpen()) {
    closeHash();
  } else if (navOpen()) {
    closeNav();
  } else {
    openNav();
  }
});

$('#popup-close').addEventListener('click', closeHash);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isOpen()) closeHash();
    else if (navOpen()) closeNav();
  } else if (e.key === 'Tab' && isOpen()) {
    trapFocus(e);
  }
});

// click outside the popup / nav / toggle closes
document.addEventListener('click', (e) => {
  if (!isOpen() && !navOpen()) return;
  if (e.target.closest('#popup, #nav, #amp')) return;
  if (isOpen()) closeHash();
  else closeNav();
});

// keep Tab inside the popup while it's an open modal (a11y basic for aria-modal)
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

// --- the roaming amber lantern (signature): random spot + fade, while open ---
function startLantern() {
  if (prefersReduced || !lantern) return;
  const tick = () => {
    const pad = 44;
    const w = Math.max(0, popup.clientWidth - pad * 2);
    const h = Math.max(0, popup.clientHeight - pad * 2);
    lantern.style.left = Math.round(pad + Math.random() * w) + 'px';
    lantern.style.top = Math.round(pad + Math.random() * h) + 'px';
    lantern.classList.add('lit');
    setTimeout(() => lantern.classList.remove('lit'), 1700);
    lanternTimer = setTimeout(tick, 3000 + Math.random() * 4500);
  };
  clearTimeout(lanternTimer);
  lanternTimer = setTimeout(tick, 1400 + Math.random() * 2600);
}
function stopLantern() {
  clearTimeout(lanternTimer);
  if (lantern) lantern.classList.remove('lit');
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
const darkMql = matchMedia('(prefers-color-scheme: dark)');
const readTheme = () => {
  const t = localStorage.getItem(THEME_KEY);
  return THEMES.includes(t) ? t : 'auto';
};
const surfaceIsLight = () => {
  const t = readTheme();
  return t === 'light' || (t === 'auto' && !darkMql.matches);
};
// the toggle sits over the popup on desktop → flip to the black icon on a light surface
function updateAmpSurface() {
  amp.classList.toggle('on-light', isOpen() && surfaceIsLight());
}
function applyTheme(t) {
  if (t === 'auto') popup.removeAttribute('data-theme');
  else popup.setAttribute('data-theme', t);
  themeBtn.innerHTML = THEME_FACE[t];
  themeBtn.setAttribute('aria-label', THEME_LABEL[t]);
  updateAmpSurface();
}
themeBtn.addEventListener('click', (e) => {
  // the icon swap detaches the clicked <svg>; stop the outside-close handler from
  // seeing a now-detached target and closing the popup.
  e.stopPropagation();
  const next = THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length];
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});
darkMql.addEventListener('change', updateAmpSurface);

// --- go: reveal chrome, restore theme, honor any deep link on load ---
amp.hidden = false;
nav.removeAttribute('hidden');
applyTheme(readTheme());
applyHash();
