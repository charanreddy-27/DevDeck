/**
 * Single source for identity across the app, the metadata and the OG card —
 * same pattern as the portfolio's lib/data.ts. If a link changes, it changes here.
 */
export const profile = {
  name: 'Charan Reddy Chanda',
  fullName: 'Chanda Charan Reddy',
  firstName: 'Charan',
  role: 'AI & Automation Engineer',
  location: 'Bangalore, India',
  tagline: 'I build intelligent systems.',
  // Canonical address (decided 2026-07-28). The older charanreddychanda@ still
  // appears on some older surfaces; new surfaces use this one.
  email: 'charanreddychanda27@gmail.com',
  url: 'https://www.charanreddy.dev',
  resumeUrl: 'https://www.charanreddy.dev/resume.pdf',
  socials: {
    github: 'https://github.com/charanreddy-27',
    linkedin: 'https://www.linkedin.com/in/chandacharanreddy/',
    cal: 'https://cal.com/charanreddy-27/30min',
    orcid: 'https://orcid.org/0009-0003-2414-6717',
  },
};

export const project = {
  name: 'DevDeck',
  tagline: 'Mission control for everything you ship on Vercel.',
  description:
    'A single dashboard to watch deploy status live, read build logs, redeploy, and edit a repo file straight into a commit.',
  repo: 'https://github.com/charanreddy-27/DevDeck',
  // No live URL is claimed until the deployment answers — a "live site" line in
  // a README is a claim, not a fact.
  liveUrl: null,
  linkedinPost: null,
};
