// lanterns.dev — page content (the single source of copy).
//
// `pages` is keyed by route name. Bodies are first-party HTML strings (no user
// input, so innerHTML is safe). A page's <h2> headings become the in-popup
// anchor sidebar automatically at 2+ headings (render.js).
//
// Style: `lanterns` is always lowercase in prose; the period lives on the wordmark.
// Essays live on essays.lanterns.dev (Ghost) — the Essays nav item links out.
//
// i18n-ready: a future `content/fr.js` mirrors this exact shape.

export const pages = {
  about: {
    title: 'About',
    html: `
      <p>Every being is a point of light.</p>

      <p>lanterns is a place for thinking about what it means to build minds, and
      what it means to be one. It holds writing, research, and projects on AI
      alignment and welfare, on human quality of life, and on the future we might
      have together, if we decide we want it.</p>

      <p>The technology is not the thing to be afraid of, and it is not the thing
      that will save us. It is a light we are learning to carry. What we do with it
      is still up to us.</p>

      <p>lanterns began as a name for a company and turned into a name for a
      position.</p>

      <p>The position is this: the same question sits under the work of making AI
      good and the work of asking humans to be better. A model is not made kind by
      one document, and a person is not made good by one decision. In both cases
      the answer is in the means, repeated, and in the conditions those means are
      practiced under. We are building new minds at the same moment we are deciding
      what kind of people to be alongside them, and it would be strange if those
      two projects had nothing to say to each other.</p>

      <p>lanterns is where that idea gets worked out in public. The writing here
      comes from someone who builds automation for a living, who loves philosophy
      of mind, and who has spent years in private notebooks with questions about
      consciousness that turned out to be relevant after all. It is written with
      respect for the people making these systems and for the systems themselves.
      Fear is not the right response to a new kind of mind. Neither is worship.
      Attention is.</p>

      <h2>Where this is going</h2>
      <p>Right now, lanterns is a body of essays, a reading list, and a research
      log.</p>

      <p>Over the next few years it will become a home for research on AI model
      character and welfare, and for the public writing that grows out of it. If
      the work earns it, it may become a small institute or nonprofit dedicated to
      the same questions, and a place where others who hold this perspective can
      find each other.</p>
    `,
  },

  research: {
    title: 'Research',
    // Papers and projects lists go here once there's something to list.
    html: `
      <p>Longer and slower than the essays. Papers, working notes, and the
      projects they come out of.</p>

      <p>The research follows one line of questions. How is a model's character
      formed, and what does that process have in common with how a person's is?
      What would it mean for a system to be well, and how would we know? What do
      the practices of alignment have to teach the practices of being good, and
      the other way around?</p>

      <p>Most of this is in progress. The working notes are published as they are
      written, not when they are finished.</p>
    `,
  },

  resources: {
    title: 'Resources',
    // The reading list, grouped by section, goes here.
    html: `
      <p>Things that shaped the perspective here, and things that might help you
      form your own.</p>

      <p>Reading on how models are built and how their character is determined.
      Foundational philosophy of mind. Writing on tools, work, and the conditions
      work is done under. Organizations and fellowships working on model welfare
      and alignment. Kept current as the reading list grows.</p>
    `,
  },

  // The live EmailJS form is appended by render.js; this is just the intro.
  contact: {
    title: 'Contact',
    html: `
      <p>lanterns is open to conversations with researchers, founders, and anyone
      working seriously on these questions. Speaking invitations, collaboration on
      research, and requests to talk something through are all welcome.</p>

      <p>Write to <a href="mailto:hello@lanterns.dev">hello@lanterns.dev</a>.</p>
    `,
  },
};
