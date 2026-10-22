/**
 * The demo portfolio. Names, frameworks and repos mirror the owner's real
 * projects so the demo reads like the dashboard it is — everything else
 * (commits, timings, outcomes) is generated from seeds in history.js.
 */

export const DEMO_OWNER = 'charanreddy-27';
export const DEMO_AUTHOR = 'Charan Reddy';
export const DEMO_TEAM_SLUG = 'charanreddy-27s-projects';

const MIN = 60000;
const HOUR = 60 * MIN;

/**
 * cadence.first — how long ago (ms range) the newest deployment happened.
 * cadence.gap   — spacing (ms range) between older deployments.
 * scenario      — 'building': latest production deploy cycles QUEUED → BUILDING → READY.
 *                 'failing':  latest production deploy is ERROR with a TypeScript build failure.
 * canceledAt    — history index forced to CANCELED, so every state shows up somewhere.
 */
export const DEMO_PROJECTS = [
  {
    name: 'dev-deck',
    framework: 'nextjs',
    stack: 'nextjs-js',
    title: 'DevDeck',
    tagline: 'Mission control for everything you ship on Vercel.',
    version: '1.0.0',
    cadence: { first: [25 * MIN, 50 * MIN], gap: [40 * MIN, 20 * HOUR] },
    canceledAt: 6,
    routes: ['/', '/about', '/about-project', 'ƒ /api/github/file', 'ƒ /api/vercel/logs', 'ƒ /api/vercel/projects', '/project/[id]'],
    messages: [
      'Follow the log tail only while the reader is pinned to the bottom',
      'Map Vercel 403 to bad_token so the setup guide actually shows',
      'Keep tabs mounted after first visit',
      'Strip ANSI with an ESC-anchored pattern',
      'Add redeploy confirm step',
      'Scrub tokens out of upstream error messages',
      'Show build counter on the Deployments tab',
      'Memoize the file tree so typing stays smooth',
      'Handle NDJSON build events while a deploy is running',
      'Tighten card layout on narrow screens',
      'Add about-project page with the build story',
      'Pick the shortest alias as the production URL',
    ],
  },
  {
    name: 'forge',
    framework: 'nextjs',
    stack: 'nextjs-ts',
    title: 'Forge',
    tagline: 'Describe a service in one spec file, get a production-ready Next.js API.',
    version: '0.8.3',
    cadence: { first: [3 * HOUR, 5 * HOUR], gap: [30 * MIN, 14 * HOUR] },
    scenario: 'building',
    canceledAt: 3,
    routes: ['/', '/specs', '/specs/[slug]', 'ƒ /api/generate', 'ƒ /api/validate', '/docs'],
    messages: [
      'Stream generator output instead of buffering the whole bundle',
      'Validate spec references before code generation',
      'Add OpenAPI export for generated routes',
      'Cache parsed specs per request',
      'Fix route params for nested resources',
      'Generate zod schemas from spec types',
      'Add spec playground with live preview',
      'Rate-limit /api/generate per session',
    ],
    cycleMessages: [
      'Tune generator worker pool size',
      'Retry template fetch on transient failures',
      'Inline small templates into the bundle',
      'Log generation timings per stage',
      'Bump spec schema to v3',
      'Trim cold-start imports in /api/generate',
    ],
  },
  {
    name: 'synapse-web',
    framework: 'nextjs',
    stack: 'nextjs-ts',
    title: 'Synapse',
    tagline: 'Your notes as a graph — semantic neighbours, not folders.',
    version: '0.9.2',
    cadence: { first: [12 * MIN, 30 * MIN], gap: [1 * HOUR, 18 * HOUR] },
    scenario: 'failing',
    routes: ['/', '/graph', '/graph/[nodeId]', 'ƒ /api/search', 'ƒ /api/embed', '/settings'],
    messages: [
      'Rename embedding field to embeddings for multi-vector notes',
      'Add nearest-neighbour panel to node view',
      'Debounce graph layout on resize',
      'Index notes in batches of 64',
      'Colour edges by similarity score',
      'Add keyboard navigation between neighbours',
      'Cache embeddings by content hash',
      'Fix search ranking for short queries',
    ],
  },
  {
    name: 'charan-portfolio',
    framework: 'nextjs',
    stack: 'nextjs-ts',
    title: 'charanreddy.dev',
    tagline: 'Portfolio — projects, writing, and a few jet engines.',
    version: '3.2.0',
    cadence: { first: [6 * HOUR, 11 * HOUR], gap: [8 * HOUR, 40 * HOUR] },
    routes: ['/', '/projects', '/projects/[slug]', '/writing', '/writing/[slug]', '/resume', 'ƒ /api/og'],
    messages: [
      'Add DevDeck to the project list',
      'Move identity into lib/data.ts',
      'Lazy-load project screenshots',
      'Fix OG card title wrapping',
      'Add writing index with reading times',
      'Update resume link',
      'Tighten hero copy',
      'Add case study: chest X-ray model',
    ],
  },
  {
    name: 'my-second-brain',
    framework: 'nextjs',
    stack: 'nextjs-ts',
    title: 'Second Brain',
    tagline: 'A private, searchable vault of notes, links and half-finished ideas.',
    version: '0.5.1',
    cadence: { first: [1 * HOUR, 3 * HOUR], gap: [3 * HOUR, 30 * HOUR] },
    routes: ['/', '/notes', '/notes/[id]', '/inbox', 'ƒ /api/capture', 'ƒ /api/search'],
    messages: [
      'Add quick-capture endpoint for the share sheet',
      'Backlinks panel on every note',
      'Full-text search with highlighted matches',
      'Daily note template',
      'Fix wiki-link parsing inside code blocks',
      'Inbox zero view',
    ],
  },
  {
    name: 'vantis-website',
    framework: 'nextjs',
    stack: 'nextjs-ts',
    title: 'Vantis',
    tagline: 'Automation that runs your back office while you sleep.',
    version: '2.4.0',
    cadence: { first: [20 * HOUR, 30 * HOUR], gap: [6 * HOUR, 48 * HOUR] },
    canceledAt: 9,
    routes: ['/', '/pricing', '/customers', '/blog', '/blog/[slug]', 'ƒ /api/contact'],
    messages: [
      'New pricing table',
      'Add customer logos strip',
      'Compress hero video',
      'Contact form posts to the CRM webhook',
      'Blog: launch post',
      'Fix nav overlap on tablet widths',
    ],
  },
  {
    name: 'distill',
    framework: 'vite',
    stack: 'vite',
    title: 'Distill',
    tagline: 'Paste a long article, get the essay it was trying to be.',
    version: '0.6.1',
    cadence: { first: [2 * HOUR, 6 * HOUR], gap: [5 * HOUR, 36 * HOUR] },
    messages: [
      'Show compression ratio under the summary',
      'Keep quotes verbatim when distilling',
      'Add copy-as-markdown',
      'Handle paywalled-article paste gracefully',
      'Dark mode follows the system setting',
    ],
  },
  {
    name: 'tracewave',
    framework: 'sveltekit',
    stack: 'sveltekit',
    title: 'Tracewave',
    tagline: 'Distributed traces as a waterfall you can actually read.',
    version: '0.3.0',
    cadence: { first: [9 * HOUR, 16 * HOUR], gap: [6 * HOUR, 30 * HOUR] },
    canceledAt: 4,
    messages: [
      'Collapse spans under 1ms by default',
      'Critical-path highlighting',
      'Parse OTLP JSON exports',
      'Virtualize the span list',
      'Add span search',
    ],
  },
  {
    name: 'gauntlet',
    framework: null,
    stack: 'python',
    title: 'Gauntlet',
    pkg: 'gauntlet',
    tagline: 'Run your checks as a dependency graph — parallel, timed, with JUnit and Markdown reports.',
    version: '0.7.0',
    cadence: { first: [30 * HOUR, 44 * HOUR], gap: [12 * HOUR, 72 * HOUR] },
    messages: [
      'Add JUnit XML reporter',
      'Show per-check timings in the summary',
      'Run independent checks in parallel',
      'Docs: graph output example',
      'Colour output respects NO_COLOR',
      'Site: refresh landing page',
    ],
  },
  {
    name: 'crucible',
    framework: null,
    stack: 'python',
    title: 'Crucible',
    pkg: 'crucible',
    tagline: 'Put your code through adversarial runs and read the results as an HTML report.',
    version: '0.4.2',
    cadence: { first: [50 * HOUR, 70 * HOUR], gap: [18 * HOUR, 96 * HOUR] },
    messages: [
      'Add --demo mode',
      'HTML run report with collapsible failures',
      'Seed runs for reproducibility',
      'Site: add report screenshot',
      'Fix exit code when a run is skipped',
    ],
  },
];

export const PREVIEW_BRANCHES = [
  'feat/insights-strip',
  'feat/keyboard-nav',
  'fix/mobile-layout',
  'fix/race-in-poll',
  'chore/deps',
  'refactor/data-layer',
  'feat/dark-mode',
  'perf/lazy-images',
];

export const DEPENDABOT_MESSAGES = [
  'Bump next from 16.0.1 to 16.0.3',
  'Bump eslint from 9.38.0 to 9.39.1',
  'Bump vite from 7.1.2 to 7.1.4',
  'Bump actions/checkout from 4 to 5',
];
