// lanterns.dev — the essays list. Reading lives on essays.lanterns.dev (Ghost);
// this fetches each essay's metadata from Ghost's Content API and renders it here
// as text — title, date, excerpt, link — the same fields the essays site's own
// feed shows. No Ghost HTML or images are ever rendered on this site, so there is
// nothing to sanitise and no card CSS to carry.
//
// The key is a Content API key: public by design (read-only, public data), not a
// secret. The API is called on the ghost.io host because the custom domain answers
// API calls with a bare 302 — no CORS header — which the browser rejects before
// it can follow.

const API = 'https://lanterns.ghost.io/ghost/api/content/posts/';
const KEY = 'eca152e005d3f3d3b7e0517cb9';
const FIELDS = 'title,url,published_at,excerpt'; // `excerpt` is the custom excerpt when set
const ESSAYS_HOME = 'https://essays.lanterns.dev/';
const WORDS = 40; // the essays site's feed cuts at 40 too (Ghost counts escaped text, so its
                  // cut can run a few words short of this one — close enough, not mirrored)

let pending = null; // one fetch per visit; a failure or an empty answer resets it so the next open retries

function fetchPosts() {
  // no custom headers: a "simple" request, so no CORS preflight round-trip. The
  // timeout turns a stalled connection into a failure, so the fallback renders and
  // the next open retries instead of waiting on one hung request all visit.
  const url = `${API}?key=${KEY}&fields=${FIELDS}&order=published_at%20desc&limit=100`;
  return fetch(url, { signal: AbortSignal.timeout(8000) })
    .then((res) => {
      if (!res.ok) throw new Error(`Content API ${res.status}`);
      return res.json();
    })
    .then((data) => data.posts);
}

// Fill `list` (the empty element render.js leaves in the Essays page).
export async function fillEssays(list) {
  list.setAttribute('aria-busy', 'true');
  let posts = null;
  try {
    pending ||= fetchPosts();
    posts = await pending;
  } catch {
    pending = null;
  }
  if (!posts || !posts.length) pending = null; // nothing usable: don't cache it, the next open retries
  if (!list.isConnected) return; // the page was closed or swapped while we waited
  list.removeAttribute('aria-busy');
  list.replaceChildren(...(posts && posts.length ? posts.map(entry) : [fallback()]));
}

const el = (tag, cls) => Object.assign(document.createElement(tag), cls ? { className: cls } : {});

// link-out mark, drawn in currentColor (pages.css)
function linkOut() {
  const s = el('span', 'link-out');
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', '(opens in a new tab)');
  return s;
}
function outLink(href, text) {
  const a = el('a');
  a.href = /^https:\/\//.test(href) ? href : ESSAYS_HOME; // API data: https only, never javascript: or //
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = text;
  a.appendChild(linkOut());
  return a;
}

function entry(post) {
  const art = el('article', 'feed');
  const h = el('h3', 'feed-title');
  h.appendChild(outLink(post.url, post.title));
  art.appendChild(h);
  if (post.published_at) {
    // Ghost sends the site's local time with its offset; the first ten characters
    // are the calendar date the essays site prints. Formatting the instant instead
    // would shift it by a day for readers far from that timezone.
    const day = post.published_at.slice(0, 10);
    const t = el('time', 'feed-date');
    t.dateTime = day;
    t.textContent = new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    art.appendChild(t);
  }
  if (post.excerpt) {
    const p = el('p', 'feed-excerpt');
    p.textContent = post.excerpt.split(/\s+/).slice(0, WORDS).join(' ');
    art.appendChild(p);
  }
  return art;
}

// the list could not be fetched (or is empty): point at the essays site instead
function fallback() {
  const p = el('p', 'feed-fallback');
  p.append('The essays live at ', outLink(ESSAYS_HOME, 'essays.lanterns.dev'), '.');
  return p;
}
