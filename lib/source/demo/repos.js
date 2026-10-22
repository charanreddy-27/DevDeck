/**
 * Plausible repositories for the demo projects. The files you are likely to
 * open (README, package.json / pyproject.toml, a page, a component, a config)
 * have real-looking contents; the rest get short generated bodies. Binary and
 * oversized entries exist on purpose so the editor's limits are visible.
 *
 * synapse-web carries a real bug: lib/types.ts renamed `embedding` to
 * `embeddings`, but app/graph/[nodeId]/page.tsx still reads `node.embedding`.
 * That is the TypeScript error in its failing build log — and fixing it in
 * the editor turns the next demo deployment green.
 */
import { createHash } from 'node:crypto';
import { DEMO_OWNER } from './catalog.js';

const NEXT_VERSION = '16.0.3';

/** The sha GitHub would report for this blob, so shas behave like the real thing. */
export function blobSha(content) {
  const body = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
}

function binary(path, size) {
  return { path, binary: true, size };
}

function text(path, content) {
  return { path, content };
}

// ---------------------------------------------------------------- shared bits

function gitignore(stack) {
  if (stack === 'python') {
    return ['__pycache__/', '*.py[cod]', '.venv/', 'dist/', 'build/', '*.egg-info/', '.pytest_cache/', '.coverage', ''].join('\n');
  }
  return ['node_modules/', '.next/', 'dist/', '.svelte-kit/', '.vercel', '.env*.local', '*.log', '.DS_Store', ''].join('\n');
}

function nodeCi() {
  return `name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm test --if-present
      - run: npm run build
`;
}

function pythonCi(pkg) {
  return `name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ['3.11', '3.12', '3.13']
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-python@v5
        with:
          python-version: \${{ matrix.python }}
      - run: pip install -e '.[dev]'
      - run: ruff check src tests
      - run: pytest -q --cov=${pkg}
`;
}

function lockfile(name, version, deps) {
  const packages = Object.entries(deps)
    .map(
      ([dep, range]) => `    "node_modules/${dep}": {
      "version": "${String(range).replace(/^[\^~]/, '')}",
      "resolved": "https://registry.npmjs.org/${dep}/-/${dep.split('/').pop()}-${String(range).replace(/^[\^~]/, '')}.tgz",
      "license": "MIT"
    }`,
    )
    .join(',\n');
  return `{
  "name": "${name}",
  "version": "${version}",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "${name}",
      "version": "${version}"
    },
${packages}
  }
}
`;
}

function packageJson(name, version, scripts, deps, devDeps) {
  return `${JSON.stringify(
    { name, version, private: true, type: 'module', scripts, dependencies: deps, devDependencies: devDeps },
    null,
    2,
  )}\n`;
}

function readme(project, extra) {
  const url = `https://${project.name}.vercel.app`;
  return `# ${project.title}

${project.tagline}

**Live:** ${url}

${extra.trim()}

## License

MIT © 2026 Charan Reddy
`;
}

// ---------------------------------------------------------------- Next.js (TypeScript)

const NEXT_DEPS = { next: `^${NEXT_VERSION}`, react: '^19.2.0', 'react-dom': '^19.2.0' };
const NEXT_DEV = { typescript: '^5.9.3', '@types/react': '^19.2.2', '@types/node': '^22.18.0', eslint: '^9.39.1', 'eslint-config-next': `^${NEXT_VERSION}` };

const EXTRA_DEPS = {
  forge: { zod: '^4.1.12', yaml: '^2.8.1' },
  'synapse-web': { 'd3-force': '^3.0.0', zod: '^4.1.12' },
  'charan-portfolio': { 'next-mdx-remote': '^5.0.0' },
  'my-second-brain': { 'gray-matter': '^4.0.3', minisearch: '^7.2.0' },
  'vantis-website': { 'framer-motion': '^12.23.24' },
};

function nextTsFiles(project) {
  const { name, title, tagline, version } = project;
  const deps = { ...NEXT_DEPS, ...(EXTRA_DEPS[name] || {}) };
  const scripts = { dev: 'next dev', build: 'next build', start: 'next start', lint: 'eslint .', typecheck: 'tsc --noEmit' };

  const files = [
    text('.gitignore', gitignore('nextjs')),
    text('README.md', readme(project, `## Stack

- Next.js ${NEXT_VERSION} (App Router, Turbopack)
- TypeScript, strict mode
- Deployed on Vercel — every push to \`main\` is a production deploy

## Develop

\`\`\`bash
npm install
npm run dev
\`\`\`

Open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| \`npm run dev\` | Dev server with Turbopack |
| \`npm run build\` | Production build |
| \`npm run typecheck\` | \`tsc --noEmit\` |
| \`npm run lint\` | ESLint (flat config) |`)),
    text('package.json', packageJson(name, version, scripts, deps, NEXT_DEV)),
    text('package-lock.json', lockfile(name, version, deps)),
    text(
      'next.config.ts',
      `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'avatars.githubusercontent.com' }],
  },
};

export default nextConfig;
`,
    ),
    text(
      'tsconfig.json',
      `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
    ),
    text(
      'eslint.config.mjs',
      `import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([...nextVitals, ...nextTs, globalIgnores(['.next/**', 'next-env.d.ts'])]);
`,
    ),
    text(
      'app/layout.tsx',
      `import type { Metadata } from 'next';
import Header from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '${title}', template: '%s · ${title}' },
  description: '${tagline.replace(/'/g, "\\'")}',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
`,
    ),
    text(
      'app/globals.css',
      `:root {
  --bg: #0b0d12;
  --fg: #e8ecf3;
  --muted: #8b95a7;
  --accent: #5b9dff;
  --radius: 12px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 15px/1.6 ui-sans-serif, system-ui, sans-serif;
}

.container { max-width: 1080px; margin: 0 auto; padding: 32px 20px 80px; }

a { color: var(--accent); }
`,
    ),
    text(
      'app/not-found.tsx',
      `import Link from 'next/link';

export default function NotFound() {
  return (
    <section>
      <h1>Not found</h1>
      <p>That page does not exist.</p>
      <Link href="/">Back home</Link>
    </section>
  );
}
`,
    ),
    text(
      'components/Header.tsx',
      `import Link from 'next/link';

export default function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="brand">${title}</Link>
      <nav>
        <a href="https://github.com/${DEMO_OWNER}/${name}" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </header>
  );
}
`,
    ),
    text('.github/workflows/ci.yml', nodeCi()),
    binary('public/favicon.ico', 15086),
    binary('public/og.png', 48213),
  ];

  return files.concat(NEXT_EXTRAS[name] ? NEXT_EXTRAS[name](project) : defaultNextPage(project));
}

function defaultNextPage(project) {
  return [
    text(
      'app/page.tsx',
      `export default function Home() {
  return (
    <section className="hero">
      <h1>${project.title}</h1>
      <p className="lede">${project.tagline}</p>
    </section>
  );
}
`,
    ),
  ];
}

const NEXT_EXTRAS = {
  'synapse-web': () => [
    text(
      'lib/types.ts',
      `/** A note in the graph. One note can carry several vectors (title, body, tags). */
export interface NoteNode {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  updatedAt: string;
  /** Renamed from \`embedding\` when notes moved to one vector per field. */
  embeddings: number[][];
}

export interface Neighbour {
  node: NoteNode;
  score: number;
}
`,
    ),
    text(
      'lib/graph.ts',
      `import type { Neighbour, NoteNode } from './types';

/** Cosine similarity between two vectors of equal length. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Mean of a note's vectors — the single point used for ranking. */
export function centroid(node: NoteNode): number[] {
  const [first, ...rest] = node.embeddings;
  const sum = first.slice();
  for (const vector of rest) vector.forEach((v, i) => (sum[i] += v));
  return sum.map((v) => v / node.embeddings.length);
}

export async function getNode(id: string): Promise<NoteNode> {
  const res = await fetch(\`\${process.env.SYNAPSE_API}/nodes/\${id}\`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(\`Node \${id} not found\`);
  return res.json();
}

export async function nearest(id: string, k = 8): Promise<Neighbour[]> {
  const res = await fetch(\`\${process.env.SYNAPSE_API}/nodes/\${id}/nearest?k=\${k}\`);
  return res.ok ? res.json() : [];
}
`,
    ),
    text(
      'app/graph/[nodeId]/page.tsx',
      `import { notFound } from 'next/navigation';
import NodeView from '@/components/NodeView';
import { cosine, getNode, nearest } from '@/lib/graph';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  const node = await getNode(nodeId).catch(() => null);
  return { title: node?.title ?? 'Note' };
}

export default async function NodePage({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  const query = await queryVector();
  if (!nodeId) notFound();
  const node = await getNode(nodeId);
  const neighbours = await nearest(node.id, 8);
  const score = cosine(node.embedding, query);
  return <NodeView node={node} neighbours={neighbours} score={score} />;
}

async function queryVector(): Promise<number[]> {
  return new Array(384).fill(0);
}
`,
    ),
    text(
      'app/page.tsx',
      `import Link from 'next/link';

export default function Home() {
  return (
    <section className="hero">
      <h1>Synapse</h1>
      <p className="lede">Your notes as a graph — semantic neighbours, not folders.</p>
      <Link className="button" href="/graph">Open the graph</Link>
    </section>
  );
}
`,
    ),
    text(
      'components/NodeView.tsx',
      `import Link from 'next/link';
import type { Neighbour, NoteNode } from '@/lib/types';

export default function NodeView({ node, neighbours, score }: { node: NoteNode; neighbours: Neighbour[]; score: number }) {
  return (
    <article className="node">
      <h1>{node.title}</h1>
      <p className="muted">relevance {score.toFixed(3)} · {node.tags.join(', ')}</p>
      <p>{node.excerpt}</p>
      <h2>Nearest notes</h2>
      <ul>
        {neighbours.map(({ node: n, score: s }) => (
          <li key={n.id}>
            <Link href={\`/graph/\${n.id}\`}>{n.title}</Link> <span className="muted">{s.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
`,
    ),
    text(
      'app/api/search/route.ts',
      `import { z } from 'zod';

const Query = z.object({ q: z.string().min(1).max(200), k: z.coerce.number().int().min(1).max(50).default(10) });

export async function GET(request: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: 'Bad query' }, { status: 400 });
  const res = await fetch(\`\${process.env.SYNAPSE_API}/search\`, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  return Response.json(await res.json());
}
`,
    ),
  ],

  forge: () => [
    text(
      'app/page.tsx',
      `import Link from 'next/link';
import SpecEditor from '@/components/SpecEditor';

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Forge</h1>
        <p className="lede">Describe a service in one spec file, get a production-ready Next.js API.</p>
        <Link className="button" href="/specs">Browse example specs</Link>
      </section>
      <SpecEditor initial={'service: billing\\nresources:\\n  - invoice\\n'} />
    </>
  );
}
`,
    ),
    text(
      'components/SpecEditor.tsx',
      `'use client';

import { useState, useTransition } from 'react';

export default function SpecEditor({ initial }: { initial: string }) {
  const [spec, setSpec] = useState(initial);
  const [output, setOutput] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const res = await fetch('/api/generate', { method: 'POST', body: spec });
      setOutput(await res.text());
    });
  }

  return (
    <div className="spec-editor">
      <textarea value={spec} onChange={(e) => setSpec(e.target.value)} spellCheck={false} rows={12} />
      <button onClick={generate} disabled={pending}>{pending ? 'Generating…' : 'Generate'}</button>
      {output ? <pre>{output}</pre> : null}
    </div>
  );
}
`,
    ),
    text(
      'lib/generator.ts',
      `import { parse } from 'yaml';
import { z } from 'zod';

export const Spec = z.object({
  service: z.string().regex(/^[a-z][a-z0-9-]*$/),
  resources: z.array(z.string()).min(1),
  auth: z.enum(['none', 'token', 'session']).default('token'),
});

export type Spec = z.infer<typeof Spec>;

export function parseSpec(source: string): Spec {
  return Spec.parse(parse(source));
}

/** One route file per resource, streamed as soon as each is rendered. */
export async function* generate(spec: Spec): AsyncGenerator<{ path: string; contents: string }> {
  for (const resource of spec.resources) {
    yield {
      path: \`app/api/\${resource}/route.ts\`,
      contents: \`export async function GET() {\\n  return Response.json({ \${resource}: [] });\\n}\\n\`,
    };
  }
}
`,
    ),
    text(
      'app/api/generate/route.ts',
      `import { generate, parseSpec } from '@/lib/generator';

export async function POST(request: Request) {
  const spec = parseSpec(await request.text());
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const file of generate(spec)) {
        controller.enqueue(encoder.encode(\`// \${file.path}\\n\${file.contents}\\n\`));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
`,
    ),
    text(
      'specs/billing.forge.yaml',
      `service: billing
auth: token
resources:
  - invoice
  - customer
  - payment
`,
    ),
  ],

  'charan-portfolio': () => [
    text(
      'lib/data.ts',
      `/** Single source for identity and links — the OG card, metadata and pages all read from here. */
export const profile = {
  name: 'Charan Reddy Chanda',
  role: 'AI & Automation Engineer',
  location: 'Bangalore, India',
  url: 'https://www.charanreddy.dev',
  github: 'https://github.com/${DEMO_OWNER}',
};

export const projects = [
  { slug: 'dev-deck', title: 'DevDeck', blurb: 'Mission control for everything you ship on Vercel.' },
  { slug: 'gauntlet', title: 'Gauntlet', blurb: 'Checks as a dependency graph, with real reports.' },
  { slug: 'synapse', title: 'Synapse', blurb: 'Notes as a semantic graph.' },
  { slug: 'distill', title: 'Distill', blurb: 'The essay a long article was trying to be.' },
];
`,
    ),
    text(
      'app/page.tsx',
      `import Link from 'next/link';
import { profile, projects } from '@/lib/data';

export default function Home() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">{profile.role} · {profile.location}</p>
        <h1>I build intelligent systems.</h1>
      </section>
      <section className="grid">
        {projects.map((p) => (
          <Link key={p.slug} href={\`/projects/\${p.slug}\`} className="card">
            <h2>{p.title}</h2>
            <p>{p.blurb}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
`,
    ),
    text('content/writing/what-jet-engines-taught-me.mdx', `---\ntitle: What jet engines taught me about latency\ndate: 2026-05-02\n---\n\nA millisecond of lag isn't a bug — it's a flameout.\n`),
    binary('public/resume.pdf', 212480),
  ],

  'my-second-brain': () => [
    text(
      'lib/notes.ts',
      `import matter from 'gray-matter';
import MiniSearch from 'minisearch';

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

export function parseNote(id: string, source: string): Note {
  const { data, content } = matter(source);
  return { id, title: data.title ?? id, body: content, tags: data.tags ?? [] };
}

export function buildIndex(notes: Note[]) {
  const index = new MiniSearch<Note>({ fields: ['title', 'body', 'tags'], storeFields: ['title'] });
  index.addAll(notes);
  return index;
}
`,
    ),
    text(
      'app/api/capture/route.ts',
      `export async function POST(request: Request) {
  const { text, url } = await request.json();
  if (!text && !url) return Response.json({ error: 'Nothing to capture' }, { status: 400 });
  // Captures land in the inbox; triage happens later, not at capture time.
  return Response.json({ ok: true, id: crypto.randomUUID() }, { status: 201 });
}
`,
    ),
    text('content/notes/inbox.md', `---\ntitle: Inbox\ntags: [triage]\n---\n\n- [ ] Read the Turbopack caching notes\n- [ ] Draft the DevDeck launch post\n`),
  ],

  'vantis-website': () => [
    text(
      'app/pricing/page.tsx',
      `import PricingTable from '@/components/PricingTable';

export const metadata = { title: 'Pricing' };

export default function PricingPage() {
  return (
    <section>
      <h1>Simple, usage-based pricing</h1>
      <PricingTable />
    </section>
  );
}
`,
    ),
    text(
      'components/PricingTable.tsx',
      `const PLANS = [
  { name: 'Starter', price: '$0', features: ['3 automations', 'Email support'] },
  { name: 'Growth', price: '$49', features: ['Unlimited automations', 'Slack alerts', 'Audit log'] },
  { name: 'Scale', price: 'Talk to us', features: ['SSO', 'Dedicated runner', 'SLA'] },
];

export default function PricingTable() {
  return (
    <div className="plans">
      {PLANS.map((plan) => (
        <div key={plan.name} className="plan">
          <h2>{plan.name}</h2>
          <p className="price">{plan.price}</p>
          <ul>{plan.features.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}
`,
    ),
    ...defaultNextPage({ title: 'Vantis', tagline: 'Automation that runs your back office while you sleep.' }),
    // Over the 1 MB editing limit on purpose: listed, but not openable.
    binary('public/hero.mp4', 3482112),
  ],
};

// ---------------------------------------------------------------- Next.js (JavaScript) — DevDeck itself

function devDeckFiles(project) {
  const { name, version } = project;
  const deps = { next: `^${NEXT_VERSION}`, react: '^19.2.0', 'react-dom': '^19.2.0' };
  return [
    text('.gitignore', gitignore('nextjs')),
    text('README.md', readme(project, `Live deploy status, streaming build logs, one-click redeploy, and edit-a-file-into-a-commit —
for every project in your account, on one screen.

\`\`\`bash
npm install
cp .env.example .env.local   # VERCEL_TOKEN, GITHUB_TOKEN
npm run dev
\`\`\`

No database: everything is live from the Vercel and GitHub APIs.`)),
    text('package.json', packageJson(name, version, { dev: 'next dev', build: 'next build', start: 'next start', lint: 'eslint .', test: 'node --test "tests/*.test.mjs"' }, deps, { eslint: '^9.39.1', 'eslint-config-next': `^${NEXT_VERSION}` })),
    text('package-lock.json', lockfile(name, version, deps)),
    text('next.config.js', `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  reactStrictMode: true,\n  poweredByHeader: false,\n};\n\nmodule.exports = nextConfig;\n`),
    text('jsconfig.json', `{\n  "compilerOptions": {\n    "baseUrl": ".",\n    "paths": { "@/*": ["./*"] }\n  }\n}\n`),
    text('.env.example', `VERCEL_TOKEN=\nGITHUB_TOKEN=\nVERCEL_TEAM_ID=\n`),
    text(
      'app/page.js',
      `import Dashboard from '@/components/Dashboard';

export default function HomePage() {
  return <Dashboard />;
}
`,
    ),
    text('app/layout.js', `import './globals.css';\n\nexport const metadata = { title: 'DevDeck' };\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n`),
    text('app/globals.css', `:root {\n  --bg: #0e1116;\n  --panel: #151a21;\n  --ready: #3fb950;\n  --building: #d29922;\n  --error: #f85149;\n}\n\nbody {\n  background: var(--bg);\n}\n`),
    text(
      'components/Dashboard.js',
      `'use client';

import { useEffect, useState } from 'react';
import ProjectCard from './ProjectCard';

const POLL_MS = 30000;

export default function Dashboard() {
  const [projects, setProjects] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch('/api/vercel/projects');
      const data = await res.json();
      if (!cancelled) setProjects(data.projects || []);
    }
    load();
    // Skip the poll while the tab is hidden — no point burning rate limit.
    const id = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return <div className="grid">{(projects || []).map((p) => <ProjectCard key={p.id} project={p} />)}</div>;
}
`,
    ),
    text('components/ProjectCard.js', `export default function ProjectCard({ project }) {\n  return <article className="card">{project.name}</article>;\n}\n`),
    text(
      'lib/logs.js',
      `// ANSI colour codes look like: ESC [ <numbers> <letter>. Anchoring on ESC is
// what keeps "branch [main]" intact.
const ESC = String.fromCharCode(27);
const ANSI = new RegExp(ESC + '\\\\[[0-9;]*[A-Za-z]', 'g');

export function stripAnsi(text) {
  return String(text).replace(ANSI, '');
}
`,
    ),
    text('tests/logs.test.mjs', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { stripAnsi } from '../lib/logs.js';\n\ntest('keeps literal brackets', () => {\n  assert.equal(stripAnsi('branch [main] is up to date'), 'branch [main] is up to date');\n});\n`),
    text('eslint.config.mjs', `import { defineConfig } from 'eslint/config';\nimport nextVitals from 'eslint-config-next/core-web-vitals';\n\nexport default defineConfig([...nextVitals]);\n`),
    text('.github/workflows/ci.yml', nodeCi()),
    binary('app/icon.png', 4211),
  ];
}

// ---------------------------------------------------------------- Vite (React)

function viteFiles(project) {
  const { name, version, title } = project;
  const deps = { react: '^19.2.0', 'react-dom': '^19.2.0' };
  const dev = { vite: '^7.1.4', '@vitejs/plugin-react': '^5.0.4', typescript: '^5.9.3', vitest: '^3.2.4' };
  return [
    text('.gitignore', gitignore('vite')),
    text('README.md', readme(project, `Paste an article; Distill keeps the argument, the evidence and the best quotes, and drops the rest.

\`\`\`bash
npm install
npm run dev     # http://localhost:5173
npm test        # vitest
\`\`\``)),
    text('package.json', packageJson(name, version, { dev: 'vite', build: 'tsc -b && vite build', preview: 'vite preview', test: 'vitest run' }, deps, dev)),
    text('package-lock.json', lockfile(name, version, deps)),
    text('index.html', `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${title}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`),
    text('vite.config.ts', `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  build: { sourcemap: true },\n});\n`),
    text('tsconfig.json', `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "ESNext",\n    "moduleResolution": "bundler",\n    "jsx": "react-jsx",\n    "strict": true,\n    "noEmit": true\n  },\n  "include": ["src"]\n}\n`),
    text('src/main.tsx', `import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './styles.css';\n\ncreateRoot(document.getElementById('root')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n);\n`),
    text(
      'src/App.tsx',
      `import { useMemo, useState } from 'react';
import SummaryCard from './components/SummaryCard';
import { distill } from './lib/distill';

export default function App() {
  const [source, setSource] = useState('');
  const result = useMemo(() => (source.trim() ? distill(source) : null), [source]);

  return (
    <main className="app">
      <h1>Distill</h1>
      <p className="muted">Paste a long article. Get the essay it was trying to be.</p>
      <textarea value={source} onChange={(e) => setSource(e.target.value)} placeholder="Paste here…" rows={14} />
      {result ? <SummaryCard result={result} /> : null}
    </main>
  );
}
`,
    ),
    text(
      'src/lib/distill.ts',
      `export interface Distilled {
  summary: string[];
  quotes: string[];
  ratio: number;
}

const QUOTE = /[“"]([^”"]{24,240})[”"]/g;

/** Keeps the sentences that carry claims; quotes are kept verbatim, never paraphrased. */
export function distill(source: string, keep = 6): Distilled {
  const sentences = source.split(/(?<=[.!?])\\s+/).filter((s) => s.length > 40);
  const scored = sentences.map((s, i) => ({ s, score: weight(s) - i * 0.01 }));
  const summary = scored.sort((a, b) => b.score - a.score).slice(0, keep).map((x) => x.s);
  const quotes = [...source.matchAll(QUOTE)].map((m) => m[1]).slice(0, 3);
  return { summary, quotes, ratio: summary.join(' ').length / Math.max(source.length, 1) };
}

function weight(sentence: string): number {
  const signals = ['because', 'therefore', 'shows', 'found', 'means', 'percent', '%'];
  return signals.reduce((total, word) => total + (sentence.toLowerCase().includes(word) ? 1 : 0), 0);
}
`,
    ),
    text('src/components/SummaryCard.tsx', `import type { Distilled } from '../lib/distill';\n\nexport default function SummaryCard({ result }: { result: Distilled }) {\n  return (\n    <section className="card">\n      <ol>{result.summary.map((s) => <li key={s}>{s}</li>)}</ol>\n      <p className="muted">{Math.round(result.ratio * 100)}% of the original</p>\n    </section>\n  );\n}\n`),
    text('src/styles.css', `:root { color-scheme: dark light; font-family: ui-sans-serif, system-ui; }\n.app { max-width: 760px; margin: 40px auto; padding: 0 16px; }\ntextarea { width: 100%; font: inherit; }\n.muted { opacity: 0.7; }\n`),
    text('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#5b9dff"/><path d="M9 10h14M11 16h10M13 22h6" stroke="#0b0d12" stroke-width="3" stroke-linecap="round"/></svg>\n`),
  ];
}

// ---------------------------------------------------------------- SvelteKit

function svelteFiles(project) {
  const { name, version } = project;
  const deps = {};
  const dev = { '@sveltejs/kit': '^2.43.0', '@sveltejs/adapter-vercel': '^5.10.2', svelte: '^5.39.0', vite: '^7.1.4', typescript: '^5.9.3' };
  return [
    text('.gitignore', gitignore('sveltekit')),
    text('README.md', readme(project, `Drop an OTLP JSON export on the page and read the trace as a waterfall, with the critical path highlighted.

\`\`\`bash
npm install
npm run dev
\`\`\``)),
    text('package.json', packageJson(name, version, { dev: 'vite dev', build: 'vite build', preview: 'vite preview', check: 'svelte-kit sync && svelte-check' }, deps, dev)),
    text('package-lock.json', lockfile(name, version, dev)),
    text('svelte.config.js', `import adapter from '@sveltejs/adapter-vercel';\nimport { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\n\n/** @type {import('@sveltejs/kit').Config} */\nconst config = {\n  preprocess: vitePreprocess(),\n  kit: { adapter: adapter({ runtime: 'nodejs22.x' }) },\n};\n\nexport default config;\n`),
    text('vite.config.ts', `import { sveltekit } from '@sveltejs/kit/vite';\nimport { defineConfig } from 'vite';\n\nexport default defineConfig({ plugins: [sveltekit()] });\n`),
    text('tsconfig.json', `{\n  "extends": "./.svelte-kit/tsconfig.json",\n  "compilerOptions": { "strict": true, "moduleResolution": "bundler" }\n}\n`),
    text('src/app.html', `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    %sveltekit.head%\n  </head>\n  <body data-sveltekit-preload-data="hover">\n    <div style="display: contents">%sveltekit.body%</div>\n  </body>\n</html>\n`),
    text('src/app.css', `:root { --bg: #0b0d12; --fg: #e8ecf3; --span: #5b9dff; --critical: #f0883e; }\nbody { margin: 0; background: var(--bg); color: var(--fg); font-family: ui-sans-serif, system-ui; }\n`),
    text('src/routes/+layout.svelte', `<script lang="ts">\n  import '../app.css';\n  let { children } = $props();\n</script>\n\n<header><a href="/">Tracewave</a></header>\n<main>{@render children()}</main>\n`),
    text(
      'src/routes/+page.svelte',
      `<script lang="ts">
  import Waterfall from '$lib/Waterfall.svelte';
  import { parseOtlp, criticalPath, type Span } from '$lib/trace';

  let spans = $state<Span[]>([]);
  let critical = $derived(new Set(criticalPath(spans).map((s) => s.id)));

  async function onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) spans = parseOtlp(JSON.parse(await file.text()));
  }
</script>

<section role="region" aria-label="Drop a trace" ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
  {#if spans.length}
    <Waterfall {spans} {critical} />
  {:else}
    <p>Drop an OTLP JSON export here.</p>
  {/if}
</section>
`,
    ),
    text('src/routes/+page.ts', `export const prerender = true;\n`),
    text(
      'src/lib/trace.ts',
      `export interface Span {
  id: string;
  parentId: string | null;
  name: string;
  start: number;
  end: number;
}

export function parseOtlp(doc: any): Span[] {
  const spans = doc?.resourceSpans?.flatMap((r: any) => r.scopeSpans.flatMap((s: any) => s.spans)) ?? [];
  return spans.map((s: any) => ({
    id: s.spanId,
    parentId: s.parentSpanId || null,
    name: s.name,
    start: Number(s.startTimeUnixNano) / 1e6,
    end: Number(s.endTimeUnixNano) / 1e6,
  }));
}

/** The chain of spans that determined the trace's end time. */
export function criticalPath(spans: Span[]): Span[] {
  if (!spans.length) return [];
  const byParent = new Map<string | null, Span[]>();
  for (const span of spans) byParent.set(span.parentId, [...(byParent.get(span.parentId) ?? []), span]);
  const path: Span[] = [];
  let level = byParent.get(null) ?? [];
  while (level.length) {
    const last = level.reduce((a, b) => (b.end > a.end ? b : a));
    path.push(last);
    level = byParent.get(last.id) ?? [];
  }
  return path;
}
`,
    ),
    text('src/lib/Waterfall.svelte', `<script lang="ts">\n  import type { Span } from './trace';\n  let { spans, critical }: { spans: Span[]; critical: Set<string> } = $props();\n  const t0 = $derived(Math.min(...spans.map((s) => s.start)));\n</script>\n\n{#each spans as span (span.id)}\n  <div class="row" class:critical={critical.has(span.id)} style:margin-left="{(span.start - t0) / 4}px">\n    {span.name} · {(span.end - span.start).toFixed(1)}ms\n  </div>\n{/each}\n`),
    binary('static/favicon.png', 1571),
  ];
}

// ---------------------------------------------------------------- Python package with a static site

const PYTHON_CORE = {
  gauntlet: {
    module: 'graph',
    body: `"""The check graph: dependencies decide order, independence decides parallelism."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field


@dataclass
class Check:
    name: str
    command: list[str]
    needs: list[str] = field(default_factory=list)


@dataclass
class Result:
    name: str
    ok: bool
    seconds: float
    output: str = ""


def topo_layers(checks: dict[str, Check]) -> list[list[Check]]:
    """Group checks into layers; everything in a layer can run at once."""
    remaining = dict(checks)
    done: set[str] = set()
    layers: list[list[Check]] = []
    while remaining:
        ready = [c for c in remaining.values() if set(c.needs) <= done]
        if not ready:
            raise ValueError(f"cycle between: {', '.join(sorted(remaining))}")
        layers.append(ready)
        for check in ready:
            done.add(check.name)
            del remaining[check.name]
    return layers


def run(checks: dict[str, Check], runner, workers: int = 4) -> list[Result]:
    results: list[Result] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for layer in topo_layers(checks):
            started = time.perf_counter()
            for check, (ok, output) in zip(layer, pool.map(runner, layer)):
                results.append(Result(check.name, ok, time.perf_counter() - started, output))
    return results
`,
    test: `from gauntlet.graph import Check, topo_layers


def test_independent_checks_share_a_layer():
    checks = {
        "lint": Check("lint", ["ruff", "check"]),
        "types": Check("types", ["mypy", "src"]),
        "test": Check("test", ["pytest"], needs=["lint", "types"]),
    }
    layers = topo_layers(checks)
    assert [sorted(c.name for c in layer) for layer in layers] == [["lint", "types"], ["test"]]
`,
  },
  crucible: {
    module: 'runner',
    body: `"""Adversarial runs: the same target, many seeded inputs, every failure kept."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Callable


@dataclass
class Run:
    seed: int
    ok: bool
    detail: str = ""


def stress(target: Callable[[random.Random], None], runs: int = 200, seed: int = 0) -> list[Run]:
    """Call target with a seeded RNG per run, so any failure is reproducible from its seed."""
    results: list[Run] = []
    for offset in range(runs):
        rng = random.Random(seed + offset)
        try:
            target(rng)
            results.append(Run(seed + offset, True))
        except Exception as exc:  # noqa: BLE001 — every failure is data here
            results.append(Run(seed + offset, False, f"{type(exc).__name__}: {exc}"))
    return results
`,
    test: `from crucible.runner import stress


def test_failures_keep_their_seed():
    def target(rng):
        if rng.random() < 0.1:
            raise ValueError("unlucky")

    runs = stress(target, runs=50, seed=7)
    assert len(runs) == 50
    assert all(run.seed >= 7 for run in runs)
    assert any(not run.ok for run in runs)
`,
  },
};

function pythonFiles(project) {
  const pkg = project.pkg;
  const core = PYTHON_CORE[pkg];
  return [
    text('.gitignore', gitignore('python')),
    text('README.md', readme(project, `\`\`\`bash
pip install ${pkg}
${pkg} --help
\`\`\`

The landing page in \`site/\` is what Vercel deploys; \`scripts/build_site.py\` renders it from the
package docstrings so the docs never drift from the code.

## Develop

\`\`\`bash
python -m venv .venv && . .venv/bin/activate
pip install -e '.[dev]'
pytest
\`\`\``)),
    text(
      'pyproject.toml',
      `[build-system]
requires = ["hatchling>=1.25"]
build-backend = "hatchling.build"

[project]
name = "${pkg}"
version = "${project.version}"
description = "${project.tagline}"
readme = "README.md"
requires-python = ">=3.11"
license = "MIT"
authors = [{ name = "Charan Reddy" }]
dependencies = ["rich>=13.7"]

[project.optional-dependencies]
dev = ["pytest>=8", "pytest-cov>=5", "ruff>=0.6", "jinja2>=3.1"]

[project.scripts]
${pkg} = "${pkg}.cli:main"

[project.urls]
Homepage = "https://${project.name}.vercel.app"
Source = "https://github.com/${DEMO_OWNER}/${project.name}"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.pytest.ini_options]
testpaths = ["tests"]
`,
    ),
    text('LICENSE', `MIT License\n\nCopyright (c) 2026 Charan Reddy\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software\nand associated documentation files, to deal in the Software without restriction.\n`),
    text(`src/${pkg}/__init__.py`, `"""${project.title} — ${project.tagline}"""\n\n__version__ = "${project.version}"\n`),
    text(`src/${pkg}/__main__.py`, `from .cli import main\n\nraise SystemExit(main())\n`),
    text(
      `src/${pkg}/cli.py`,
      `"""Command line entry point."""

from __future__ import annotations

import argparse

from . import __version__


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="${pkg}", description="${project.tagline}")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("config", nargs="?", default="${pkg}.toml", help="config file to run")
    parser.add_argument("--report", choices=["text", "junit", "markdown", "html"], default="text")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    print(f"${pkg} {__version__}: running {args.config} ({args.report} report)")
    return 0
`,
    ),
    text(`src/${pkg}/${core.module}.py`, core.body),
    text(`src/${pkg}/report.py`, `"""Report writers. Each takes results and returns a string; the CLI decides where it goes."""\n\nfrom __future__ import annotations\n\n\ndef markdown(results) -> str:\n    rows = [f"| {r.name if hasattr(r, 'name') else r.seed} | {'pass' if r.ok else 'fail'} |" for r in results]\n    return "\\n".join(["| check | result |", "|---|---|", *rows])\n`),
    text(`tests/test_${core.module}.py`, core.test),
    text('scripts/build_site.py', `"""Renders site/index.html from the package docstrings."""\n\nfrom pathlib import Path\n\nimport ${pkg}\n\nSITE = Path(__file__).resolve().parent.parent / "site"\n\nif __name__ == "__main__":\n    html = (SITE / "index.html").read_text()\n    (SITE / "index.html").write_text(html.replace("{{version}}", ${pkg}.__version__))\n    print(f"Rendered site for ${pkg} {${pkg}.__version__}")\n`),
    text(
      'site/index.html',
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${project.title} — ${project.tagline}</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <h1>${project.title}</h1>
      <p class="lede">${project.tagline}</p>
      <pre><code>pip install ${pkg}</code></pre>
      <p><a href="https://github.com/${DEMO_OWNER}/${project.name}">Source on GitHub</a> · v{{version}}</p>
    </main>
  </body>
</html>
`,
    ),
    text('site/styles.css', `body { margin: 0; background: #0b0d12; color: #e8ecf3; font: 16px/1.6 ui-sans-serif, system-ui; }\nmain { max-width: 720px; margin: 12vh auto; padding: 0 20px; }\n.lede { color: #8b95a7; font-size: 1.2rem; }\npre { background: #151a21; padding: 14px 16px; border-radius: 10px; }\n`),
    text('vercel.json', `{\n  "buildCommand": "python3 scripts/build_site.py",\n  "outputDirectory": "site",\n  "cleanUrls": true\n}\n`),
    text('.github/workflows/ci.yml', pythonCi(pkg)),
    binary('docs/report.png', 96233),
  ];
}

// ---------------------------------------------------------------- entry

const STACKS = {
  'nextjs-ts': nextTsFiles,
  'nextjs-js': devDeckFiles,
  vite: viteFiles,
  sveltekit: svelteFiles,
  python: pythonFiles,
};

const cache = new Map();

/**
 * Seed files for a project, with GitHub-shaped sha and size. Binary entries
 * carry a size but no content.
 */
export function seedFiles(project) {
  if (cache.has(project.name)) return cache.get(project.name);

  const files = new Map();
  for (const file of STACKS[project.stack](project)) {
    if (file.binary) {
      files.set(file.path, {
        path: file.path,
        binary: true,
        size: file.size,
        sha: blobSha(`binary:${project.name}:${file.path}:${file.size}`),
      });
    } else {
      files.set(file.path, {
        path: file.path,
        binary: false,
        content: file.content,
        size: Buffer.byteLength(file.content, 'utf8'),
        sha: blobSha(file.content),
      });
    }
  }

  cache.set(project.name, files);
  return files;
}
