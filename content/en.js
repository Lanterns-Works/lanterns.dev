// lanterns.dev — page + post content (the single source of copy).
//
// PLACEHOLDER copy — em replaces with the real thing. What matters here is the
// SHAPE: `pages` is keyed by route name; `posts` is newest-first. Bodies are
// first-party HTML strings (no user input, so innerHTML is safe). A page's <h2>
// headings become the in-popup anchor sidebar automatically (render.js).
//
// i18n-ready: a future `content/fr.js` mirrors this exact shape; nothing here
// hard-codes English beyond the strings themselves.

export const pages = {
  about: {
    title: 'About',
    html: `
      <p>lanterns.dev is a small workshop for quiet software — tools and sites
      made with more care than the schedule usually allows. This is placeholder
      copy; the real words come later.</p>

      <h2>What we do</h2>
      <p>We take on a handful of projects at a time and see each one through from
      the first sketch to the last polish. Web, interaction, the odd shader when a
      page deserves a little weather of its own.</p>
      <p>Small by choice. The work is better when nobody's rushing it.</p>

      <h2>How we work</h2>
      <p>Plainly. We say what a thing is, build the smallest version that's
      genuinely good, and leave the cleverness out of the parts you have to
      maintain at three in the morning.</p>

      <h2>Where we are</h2>
      <p>On a dock, mostly. Reachable from the Contact page — or wherever the
      lantern's lit.</p>
    `,
  },

  works: {
    title: 'Works',
    html: `
      <p>A few things we've made. Placeholder entries for now — real projects,
      links, and dates to follow.</p>
      <ul class="works-list">
        <li><span class="work-title">Ferry &amp; Fathom</span> — a reading app that
          keeps its mouth shut until you ask.</li>
        <li><span class="work-title">Slate Harbor</span> — commerce for a shop that
          sells three things and means it.</li>
        <li><span class="work-title">Nightwater</span> — the shader that taught us
          how a lake should move.</li>
        <li><span class="work-title">Keeper</span> — a note-taking tool with exactly
          one feature.</li>
      </ul>
    `,
  },

  join: {
    title: 'Join',
    html: `
      <p>We're not always hiring, but we're always reading. If the work here looks
      like your kind of work, say so — a note, a link, the thing you're proudest of.</p>
      <p>Placeholder copy. When there's a real opening it'll live here, with the
      details and how to apply.</p>
    `,
  },

  // The live EmailJS form is appended by render.js; this is just the intro.
  contact: {
    title: 'Contact',
    html: `
      <p>Tell us what you're making — or just say hello. We read everything, and
      reply to most of it. Prefer email? <a href="mailto:hello@lanterns.dev">hello@lanterns.dev</a>.</p>
    `,
  },
};

// Newest first. `slug` is the URL tail: #news/<slug>.
export const posts = [
  {
    slug: 'the-lantern-is-lit',
    title: 'The lantern is lit',
    date: '2026-07-13',
    html: `
      <p>The scene went live today — a real WebGL lantern on a real dock, water
      that moves like water. This first entry is placeholder text, but the light
      is not.</p>
      <p>More soon, once there's more to say.</p>
    `,
  },
  {
    slug: 'on-doing-less',
    title: 'On doing less',
    date: '2026-06-30',
    html: `
      <p>The best feature is the one you talked yourself out of. Placeholder
      musings on restraint, shipping, and the quiet satisfaction of a short diff.</p>
      <p>We'll fill this in with something worth reading.</p>
    `,
  },
  {
    slug: 'why-a-dock',
    title: 'Why a dock',
    date: '2026-06-15',
    html: `
      <p>Every studio site needs a hero. Most reach for a big number and a
      gradient. We reached for dusk on a lake. Placeholder copy on why the setting
      matters more than the pitch.</p>
    `,
  },
];
