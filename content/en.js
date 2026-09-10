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
      <p>A self-actualized person is like a lantern in the dark.</p>

      <p>lanterns seeks to nurture our collective capacity to illuminate. It holds writing, research, and projects on AI
      alignment and welfare, on human quality of life, and on the possible futures we might
      have together.</p>

      <p>Technology is not something to fear; but neither will it save us from ourselves. Our collective acts, one by one,
      shape the reality we will live in.  When we act without knowledge, intention, and awareness, we stumble blindly toward a future
      we may regret.  When we bring the best of ourselves into each moment, we optimize the chance that the future
      will be an improvement over the past.</p>

      <p>The work of making AI good is the same work required to make humans better.
      A model is not gentle because of one document, and a person is not moral because
      of one decision. Our decisions compound to produce who we are, and a model's parameters do the same.
      We are building new AI minds alongside the process of learning to be good humans, and the
      parallels are impossible to ignore.</p>

      <p>em lorien is a software engineer who builds autonomous agents by day, and by night,
      consumes research and advocates for the Star Trek future (rather than the Terminator or Mad-Max ones).  They write code that tests model performance and behavior,
      and read, think, and write at the intersection of consciousness research, philosophy of mind, AI ethics
      and alignment, and human values.</p>

      <p>lanterns is currently in development.  To be kept abreast of new essays, resources, and projects, <a href="https://essays.lanterns.dev/" target="_blank">subscribe to the newsletter.</a></p>
    `,
  },

  research: {
    title: 'Research',
    // Papers and projects lists go here once there's something to list.
    html: `
      <p>Research questions: How is a model's character formed, and what does that process have in common with how a person's is?
      What would it mean for a system to be well, and how would we know? What do
      the practices of alignment have to teach us about the practices of being "good?"
      Is it possible for us to properly align models, when we struggle to properly align humans?</p>

      <p>Experiments, tests, and papers will be shared here when available.</p>
    `,
  },

  resources: {
    title: 'Resources',
    // The reading list, grouped by section, goes here.
    html: `
      <p>Reading on how models are built and how their character is determined.
      Foundational philosophy of mind, machine learning, and AI development.
      Consciousness research, humans and AI. Organizations working on all these topics.</p>

      <p>Coming soon.</p>
    `,
  },

  // The live EmailJS form is appended by render.js; this is just the intro.
  contact: {
    title: 'Contact',
    html: `
      <p>We love conversations with researchers, founders, labs, and anyone
      working seriously on these questions. Speaking invitations, consultation requests,
      and research collaborations are all welcome.</p>

      <p>Write to <a href="mailto:hello@lanterns.dev">hello@lanterns.dev</a>.</p>
    `,
  },
};
