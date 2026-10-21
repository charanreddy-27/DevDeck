/**
 * Realistic Vercel build output for demo deployments, as raw build events —
 * the same `{ type, created, payload: { text } }` shape the live events
 * endpoint returns. The demo provider runs these through lib/logs.js
 * parseLogLines, so a demo log is shaped exactly like a live one, ANSI-free
 * and level-classified by the real code.
 *
 * Each line carries a weight: the share of build time spent before it
 * appears. Scaling the weights to the deployment's duration gives every line
 * a timestamp, and filtering by elapsed time is what makes a running build's
 * log grow between polls.
 */
import { createRng } from './prng.js';
import { DEMO_OWNER } from './catalog.js';

const NEXT_VERSION = '16.0.3';
const CLI_VERSION = '48.2.0';

const REGIONS = ['Washington, D.C., USA (East) – iad1', 'Frankfurt, Germany (West) – fra1', 'Mumbai, India (South) – bom1'];

function line(text, weight = 0.2, type = 'stdout') {
  return { text, weight, type };
}

function ms(rng, min, max) {
  return `${rng.range(min, max).toFixed(3)}ms`;
}

function preamble(ctx) {
  const { rng, project, meta } = ctx;
  const lines = [
    line(`Running build in ${rng.pick(REGIONS)}`, 0),
    line('Build machine configuration: 4 cores, 8 GB', 0.1),
    line(`Cloning github.com/${DEMO_OWNER}/${project.name} (Branch: ${meta.githubCommitRef}, Commit: ${String(meta.githubCommitSha).slice(0, 7)})`, 0.4),
    line(`Cloning completed: ${ms(rng, 280, 900)}`, 1.2),
  ];
  if (!ctx.coldCache) lines.push(line(`Restored build cache from previous deployment (${rng.base62(28)})`, 1.5));
  lines.push(line(`Running "vercel build"`, 0.3), line(`Vercel CLI ${CLI_VERSION}`, 0.4));
  return lines;
}

function npmInstall(ctx) {
  const { rng } = ctx;
  const added = rng.int(180, 640);
  const lines = [line('Installing dependencies...', 0.4)];
  if (rng.chance(0.5)) {
    lines.push(line('npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it.', 3));
  }
  if (rng.chance(0.3)) {
    lines.push(line('npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported', 0.6));
  }
  lines.push(
    ctx.coldCache
      ? line(`added ${added} packages, and audited ${added + 1} packages in ${rng.int(14, 38)}s`, 18)
      : line(`up to date, audited ${added + 1} packages in ${rng.int(2, 6)}s`, 6),
    line(`${Math.round(added / 4)} packages are looking for funding`, 0.2),
    line('  run `npm fund` for details', 0.1),
    line('found 0 vulnerabilities', 0.2),
  );
  return lines;
}

function nextRouteTable(project) {
  const routes = ['/', '/_not-found', ...(project.routes || []).filter((r) => r !== '/')];
  const out = [line('Route (app)', 0.4)];
  routes.forEach((route, index) => {
    const dynamic = route.startsWith('ƒ ');
    const path = dynamic ? route.slice(2) : route;
    const glyph = index === 0 ? '┌' : index === routes.length - 1 ? '└' : '├';
    out.push(line(`${glyph} ${dynamic ? 'ƒ' : '○'} ${path}`, 0.02));
  });
  out.push(
    line('○  (Static)   prerendered as static content', 0.05),
    line('ƒ  (Dynamic)  server-rendered on demand', 0.02),
  );
  return out;
}

function nextBuild(ctx) {
  const { rng, project, outcome } = ctx;
  const typescript = project.stack === 'nextjs-ts';
  const pages = (project.routes || []).length + 2;
  const lines = [
    line(`Detected Next.js version: ${NEXT_VERSION}`, 0.5),
    line('Running "npm run build"', 0.3),
    line(`> ${project.name}@${project.version} build`, 0.4),
    line('> next build', 0.1),
    line(`   ▲ Next.js ${NEXT_VERSION} (Turbopack)`, 1.2),
    line('   Creating an optimized production build ...', 0.4),
    line(` ✓ Compiled successfully in ${rng.range(6, 24).toFixed(1)}s`, 30),
  ];

  if (outcome === 'ERROR' && ctx.failure === 'typescript') return lines.concat(typeErrorFailure(ctx));
  if (outcome === 'ERROR' && ctx.failure === 'module') return lines.concat(moduleNotFoundFailure(ctx));

  if (typescript) lines.push(line('   Running TypeScript ...', 8));
  lines.push(line('   Collecting page data using 3 workers ...', 4));
  if (rng.chance(0.35)) {
    lines.push(line(' ⚠ Warning: metadataBase property in metadata export is not set, using "http://localhost:3000"', 0.5));
  }
  lines.push(
    line(` ✓ Generating static pages using 3 workers (${pages}/${pages}) in ${ms(rng, 600, 2400)}`, 9),
    line('   Finalizing page optimization ...', 1.5),
    ...nextRouteTable(project),
    line(`Traced Next.js server files in: ${ms(rng, 40, 120)}`, 1.5),
    line(`Created all serverless functions in: ${ms(rng, 90, 320)}`, 1.2),
    line(`Collected static files (public/, static/, .next/static): ${ms(rng, 3, 12)}`, 0.3),
  );
  return lines;
}

function typeErrorFailure() {
  return [
    line('   Running TypeScript ...', 8),
    line('Failed to compile.', 4, 'stderr'),
    line('./app/graph/[nodeId]/page.tsx:19:29', 0.05, 'stderr'),
    line("Type error: Property 'embedding' does not exist on type 'NoteNode'. Did you mean 'embeddings'?", 0.02, 'stderr'),
    line('  17 |   const node = await getNode(nodeId);', 0.01, 'stderr'),
    line('  18 |   const neighbours = await nearest(node.id, 8);', 0.01, 'stderr'),
    line('> 19 |   const score = cosine(node.embedding, query);', 0.01, 'stderr'),
    line(`     | ${' '.repeat(28)}^`, 0.01, 'stderr'),
    line('  20 |   return <NodeView node={node} neighbours={neighbours} score={score} />;', 0.01, 'stderr'),
    line('  21 | }', 0.01, 'stderr'),
    line('Next.js build worker exited with code: 1 and signal: null', 0.6, 'stderr'),
    line('Error: Command "npm run build" exited with 1', 0.4, 'stderr'),
  ];
}

function moduleNotFoundFailure(ctx) {
  const missing = ctx.rng.pick(['@/components/Analytics', '@/lib/flags', '@/components/ThemeToggle']);
  return [
    line('Failed to compile.', 1, 'stderr'),
    line(`./app/layout.${ctx.project.stack === 'nextjs-js' ? 'js' : 'tsx'}:4:1`, 0.05, 'stderr'),
    line(`Module not found: Can't resolve '${missing}'`, 0.02, 'stderr'),
    line('https://nextjs.org/docs/messages/module-not-found', 0.02, 'stderr'),
    line('> Build error occurred', 0.3, 'stderr'),
    line('Error: Turbopack build failed with 1 errors', 0.1, 'stderr'),
    line('Error: Command "npm run build" exited with 1', 0.4, 'stderr'),
  ];
}

function viteBuild(ctx) {
  const { rng, project } = ctx;
  const modules = rng.int(38, 140);
  return [
    line('Running "npm run build"', 0.3),
    line(`> ${project.name}@${project.version} build`, 0.4),
    line('> tsc -b && vite build', 0.1),
    line('vite v7.1.4 building for production...', 9),
    line('transforming...', 0.5),
    line(`✓ ${modules} modules transformed.`, 14),
    line('rendering chunks...', 1),
    line('computing gzip size...', 0.6),
    line('dist/index.html                   0.62 kB │ gzip:  0.38 kB', 0.2),
    line(`dist/assets/index-${rng.base62(8)}.css    ${rng.range(4, 12).toFixed(2)} kB │ gzip:  ${rng.range(1.4, 3.2).toFixed(2)} kB`, 0.02),
    line(`dist/assets/index-${rng.base62(8)}.js   ${rng.range(150, 260).toFixed(2)} kB │ gzip: ${rng.range(48, 84).toFixed(2)} kB`, 0.02),
    line(`✓ built in ${rng.range(1.6, 4.8).toFixed(2)}s`, 0.3),
  ];
}

function svelteBuild(ctx) {
  const { rng, project } = ctx;
  return [
    line('Running "npm run build"', 0.3),
    line(`> ${project.name}@${project.version} build`, 0.4),
    line('> vite build', 0.1),
    line('vite v7.1.4 building SSR bundle for production...', 8),
    line(`✓ ${rng.int(110, 190)} modules transformed.`, 12),
    line('vite v7.1.4 building for production...', 2),
    line(`✓ ${rng.int(80, 150)} modules transformed.`, 8),
    line(`✓ built in ${rng.range(2, 6).toFixed(2)}s`, 0.3),
    line('Run npm run preview to preview your production build locally.', 0.2),
    line('> Using @sveltejs/adapter-vercel', 1),
    line('  ✔ done', 4),
  ];
}

function pythonBuild(ctx) {
  const { rng, project, outcome } = ctx;
  const lines = [
    line('Detected Python project (pyproject.toml); no framework preset — using vercel.json', 0.6),
    line('Running "python3 scripts/build_site.py"', 4),
  ];
  if (outcome === 'ERROR') {
    return lines.concat([
      line('Traceback (most recent call last):', 3, 'stderr'),
      line(`  File "/vercel/path0/scripts/build_site.py", line 5, in <module>`, 0.02, 'stderr'),
      line(`    import ${project.pkg}`, 0.02, 'stderr'),
      line(`ModuleNotFoundError: No module named '${project.pkg}'`, 0.02, 'stderr'),
      line('Error: Command "python3 scripts/build_site.py" exited with 1', 0.4, 'stderr'),
    ]);
  }
  return lines.concat([
    line(`Rendered site for ${project.pkg} ${project.version}`, 10),
    line(`Copied ${rng.int(3, 9)} static files from site/`, 2),
  ]);
}

function outro(ctx) {
  const { rng, durationMs } = ctx;
  const lines = [
    line(`Build Completed in /vercel/output [${Math.max(1, Math.round((durationMs * 0.82) / 1000))}s]`, 4),
    line('Deploying outputs...', 3),
    line('Deployment completed', 6),
  ];
  if (ctx.project.stack !== 'python') {
    lines.push(
      line('Creating build cache...', 0.6),
      line(`Created build cache: ${rng.range(4, 14).toFixed(3)}s`, 4),
      line(`Uploading build cache [${rng.range(90, 240).toFixed(2)} MB]...`, 0.4),
      line(`Build cache uploaded: ${rng.range(0.8, 2.6).toFixed(3)}s`, 2),
    );
  }
  return lines;
}

const BUILDERS = {
  'nextjs-ts': nextBuild,
  'nextjs-js': nextBuild,
  vite: viteBuild,
  sveltekit: svelteBuild,
  python: pythonBuild,
};

/**
 * @param {object} options
 * @param {object} options.project      catalog entry
 * @param {object} options.deployment   raw demo deployment (uid, meta, buildingAt)
 * @param {'READY'|'ERROR'|'CANCELED'} options.outcome  how the build ends
 * @param {number} options.durationMs   planned build time (time to failure for ERROR)
 * @param {'typescript'|'module'|'install'|null} [options.failure]
 * @param {number} [options.elapsedMs]  how far into the build we are; Infinity when finished
 */
export function buildLogEvents({ project, deployment, outcome, durationMs, failure = null, elapsedMs = Infinity }) {
  const rng = createRng(`log:${deployment.uid}`);
  const ctx = {
    rng,
    project,
    outcome,
    failure: failure || (outcome === 'ERROR' ? (project.stack.startsWith('nextjs') ? 'module' : 'install') : null),
    meta: deployment.meta || {},
    durationMs,
    coldCache: rng.chance(0.15),
  };

  let lines = preamble(ctx);
  const nodeStack = project.stack !== 'python';

  if (nodeStack && outcome === 'ERROR' && ctx.failure === 'install') {
    lines = lines.concat([
      line('Installing dependencies...', 0.4),
      line('npm error code ERESOLVE', 12, 'stderr'),
      line('npm error ERESOLVE unable to resolve dependency tree', 0.02, 'stderr'),
      line(`npm error Found: react@19.2.0`, 0.02, 'stderr'),
      line('npm error Could not resolve dependency: peer react@"^18.0.0" from an older plugin', 0.02, 'stderr'),
      line('Error: Command "npm install" exited with 1', 0.4, 'stderr'),
    ]);
  } else {
    if (nodeStack) lines = lines.concat(npmInstall(ctx));
    lines = lines.concat(BUILDERS[project.stack](ctx));
    if (outcome === 'READY') lines = lines.concat(outro(ctx));
  }

  if (outcome === 'CANCELED') {
    // Cut the build off partway, the way a superseding push does.
    const keep = Math.max(6, Math.floor(lines.length * 0.55));
    lines = lines.slice(0, keep).concat([line('The build was canceled: a newer commit on this branch superseded it.', 1)]);
  }

  const totalWeight = lines.reduce((sum, item) => sum + item.weight, 0) || 1;
  const start = deployment.buildingAt ?? deployment.created;

  const events = [];
  let cumulative = 0;
  lines.forEach((item, index) => {
    cumulative += item.weight;
    const offset = Math.round((cumulative / totalWeight) * durationMs);
    if (offset > elapsedMs) return;
    events.push({
      id: `${deployment.uid}-${index}`,
      type: item.type,
      created: start + offset,
      payload: { text: item.text, deploymentId: deployment.uid },
    });
  });
  return events;
}
