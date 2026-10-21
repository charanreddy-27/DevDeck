import Link from 'next/link';
import { profile, project } from '@/lib/profile';

export const metadata = {
  title: 'The build',
  description: `How ${project.name} was built — the problem, the timeline, the decisions, and the part that broke everything.`,
  alternates: { canonical: '/about-project' },
};

const TIMELINE = [
  {
    when: 'February 2026',
    what: 'The tab problem',
    tone: 'is-done',
    body: 'I went to check whether one of my projects was still live and ended up with eleven browser tabs open, three of them the same Vercel page. The question "which of my projects are healthy right now?" had no single place to answer it. That is the entire origin story.',
  },
  {
    when: 'March 2026',
    what: 'Reading somebody else’s API for a fortnight',
    tone: 'is-done',
    body: 'Scoping, mostly. The Vercel API returns a project’s current state in at least two shapes — targets.production on some payloads, latestDeployments on others — and they disagree about field names. Most of this month was writing down what the API actually does, as opposed to what it says it does.',
  },
  {
    when: 'April 2026',
    what: 'First version that was genuinely useful',
    tone: 'is-done',
    body: 'A grid of cards, a status colour, a relative timestamp, and a 30-second poll. Ugly, but it answered the original question in one glance — which was enough to make me keep going.',
  },
  {
    when: 'May 2026',
    what: 'The week the build logs won',
    tone: 'is-hard',
    body: 'This is where it got hard. The events endpoint returns a JSON array or newline-delimited JSON depending on whether the deployment is still building. The text is full of ANSI colour codes. My strip regex was missing its escape anchor, so any log line containing a literal bracket got quietly chewed — "branch [main] is up to date" rendered as "branch ain] is up to date". Finding that took an embarrassing afternoon. It is now a named test.',
  },
  {
    when: 'June 2026',
    what: 'Edit, commit, deploy',
    tone: 'is-done',
    body: 'The file tree and editor. The insight that made it simple: Vercel already redeploys on push, so I did not need a deploy button at all. Committing through the GitHub Contents API is the deploy. One API call does the work of a whole pipeline.',
  },
  {
    when: 'July 2026',
    what: 'Making it presentable',
    tone: 'is-done',
    body: 'Tests around the parsing and normalising, a real error contract, accessibility and mobile passes, live log tailing that does not yank the page while you are reading, and the documentation. The unglamorous month that decides whether anyone else can run the thing.',
  },
  {
    when: 'October 2026',
    what: 'Version 2',
    tone: 'is-now',
    body: 'Next.js 16 and React 19, and the things version 1 kept telling me it was missing. A demo mode, so anyone can try every feature without an account. An optional password gate, so a public URL is no longer a remote control for my Vercel account. Insights across every project, a command palette, light and dark themes, and a diff before every commit. The framework upgrade was mostly renames — middleware became proxy, route params became a Promise. The React Compiler’s lint rules were not: every data loader got rewritten so that no effect sets state synchronously.',
  },
];

const FEATURES = [
  {
    title: 'Every project, one glance',
    body: 'Status-railed cards with framework, linked repo, latest production commit and relative deploy time. Polls every 30 seconds and pauses when the tab is hidden.',
  },
  {
    title: 'Build logs that live-tail',
    body: 'Expand any deployment for its log. While it is still building the log refreshes every 5 seconds and follows the output — unless you have scrolled up, in which case it stays put.',
  },
  {
    title: 'Edit a file into a deploy',
    body: 'Browse the linked repo, edit a file in a line-numbered editor, write a commit message, and push. Vercel picks up the commit and builds it. The commit is the deploy.',
  },
  {
    title: 'Review before you commit',
    body: 'The Code tab shows the exact diff a commit will make, with a live +/− count in the commit bar. Reset puts the file back the way it was loaded.',
  },
  {
    title: 'Redeploy with a confirm step',
    body: 'Rebuilds the production branch from the latest commit. Two-step, because a one-click production deploy next to a scroll wheel is a bad idea.',
  },
  {
    title: 'Insights across every project',
    body: 'Deploys per day, success rate, median build time and what is building right now, from one API call. Each card shows its last deploys as a strip of ticks, so a project that keeps failing stands out before you read a word.',
  },
  {
    title: 'Errors that tell you the fix',
    body: 'Every failure carries a code, a message and a hint. A missing or rejected token renders the full setup guide instead of a stack trace.',
  },
  {
    title: 'A demo you can actually use',
    body: 'No account needed. A seeded, in-memory Vercel and GitHub where builds progress, redeploys queue and commits trigger deploys. It never touches the network, so it is safe on a public URL.',
  },
  {
    title: 'Keyboard first',
    body: '⌘K or Ctrl+K from anywhere jumps to a project, opens its live site or runs an action. ? lists every shortcut, and t switches between light and dark.',
  },
  {
    title: 'A password when you want one',
    body: 'Set one environment variable and every page and API route sits behind a signed, HTTP-only session cookie. Leave it unset and nothing changes.',
  },
  {
    title: 'No database',
    body: 'Everything is fetched live. There is no cache to go stale, no schema to migrate, and no second source of truth to debug at midnight.',
  },
];

const DECISIONS = [
  {
    title: 'Tokens never reach the browser',
    body: 'Every Vercel and GitHub call goes through a Next.js route handler. The browser talks only to this app. That kills CORS as a category of problem, keeps credentials out of the client bundle, and means the API surface I have to reason about is one I wrote. The build output confirms it: no token string appears in any client chunk.',
  },
  {
    title: 'One error contract for two very different APIs',
    body: 'Vercel and GitHub disagree about almost everything, including how to say no. Both get mapped into { code, message, hint, service }. The UI branches on code alone — missing_token and bad_token render the setup guide, everything else renders an inline banner. Adding a third API later means writing one mapper, not touching the UI.',
  },
  {
    title: 'Vercel says 403 when it means "bad token"',
    body: 'The most common first-run failure is a token that is invalid or scoped to the wrong account, and Vercel reports that as 403, not 401. I had the setup guide wired to 401. It would have stayed hidden from exactly the people who needed it. Found by pointing a deliberately invalid token at the live API and reading what came back.',
  },
  {
    title: 'Tabs stay mounted once opened',
    body: 'Committing a file used to throw you back to the deployments list and destroy your place in the file tree. Now each tab mounts on first visit and stays mounted, so an in-progress edit survives, and the deployment poll keeps running in the background — which is what powers the live build counter on the tab itself.',
  },
  {
    title: 'The demo is a second provider, not a mocked fetch',
    body: 'Every route handler asks lib/source for its data and gets the live provider or the demo, chosen per request. The demo has no fetch in it at all — a test makes fetch throw and runs every method — so DEVDECK_DEMO=1 cannot reach a real account. It builds raw Vercel and GitHub payloads and runs them through the real normalisers and log parser, so it cannot drift from live. And when real tokens are configured, the demo cookie is ignored: fake data never shows over a real account.',
  },
  {
    title: 'A signed cookie, not a session store',
    body: 'There is one user, so a session only has to say "knew the password, valid until this time". The cookie is exactly that, signed with HMAC-SHA256 through Web Crypto, so the same code runs in proxy.js and in the tests. No database to add, nothing to look up per request. The cost is that logout cannot revoke a copied cookie before it expires. Changing the password can, because by default the signing key is derived from it.',
  },
];

const STACK = [
  {
    name: 'Next.js 16 (App Router, Turbopack)',
    why: 'Route handlers put a server between the browser and the tokens without standing up a second service to deploy and monitor. When a password is set, proxy.js — the Next 16 name for middleware — checks the session before anything renders.',
  },
  {
    name: 'React 19',
    why: 'useSyncExternalStore keeps the theme toggle and the demo banner in step with state that lives outside React. useDeferredValue keeps the diff count from ever holding up a keystroke.',
  },
  {
    name: 'JavaScript, not TypeScript',
    why: 'The whole app is a thin, well-tested layer over two REST APIs whose payloads are validated at the boundary anyway. Types would have been ceremony.',
  },
  {
    name: 'Plain CSS, no framework',
    why: 'One stylesheet of custom properties, and one token set that drives both themes. The design is small enough that a utility framework would have been more configuration than styling.',
  },
  {
    name: 'ESLint 9 + the React Compiler rules',
    why: 'A flat config on eslint-config-next. The compiler’s hook rules run at full strength with no disables, which is what pushed every data loader into a shape where effects never set state synchronously.',
  },
  {
    name: 'Web Crypto, no auth library',
    why: 'The password gate is a signed expiry in a cookie, a constant-time compare and a login throttle — three small files in lib/auth. A library would have been bigger than the problem.',
  },
  {
    name: 'No database',
    why: 'The APIs are the source of truth. A cache would only be a second, wronger copy of it.',
  },
  {
    name: 'node:test',
    why: 'Zero test dependencies. The logic worth testing is pure functions, and the runtime already ships a test runner.',
  },
  {
    name: 'Vercel + GitHub REST APIs',
    why: 'Vercel already rebuilds on push, so committing through the GitHub Contents API is the entire deployment mechanism. No webhooks, no deploy pipeline to maintain.',
  },
];

export default function AboutProjectPage() {
  return (
    <div className="content-wide">
      <header className="page-hero">
        <div className="eyebrow">The build</div>
        <h1 className="display-title">{project.name}</h1>
        <p className="lede">
          A dashboard that answers one question fast: which of my projects are healthy right now — and if one
          isn&apos;t, why?
        </p>
        <div className="detail-links" style={{ marginTop: 18 }}>
          <a className="link-chip" href={project.repo} target="_blank" rel="noreferrer">
            Source on GitHub &#8599;
          </a>
          {project.liveUrl ? (
            <a className="link-chip" href={project.liveUrl} target="_blank" rel="noreferrer">
              Live site &#8599;
            </a>
          ) : (
            <span className="link-chip" title="Not deployed yet">
              Live site — not deployed yet
            </span>
          )}
          {project.linkedinPost ? (
            <a className="link-chip" href={project.linkedinPost} target="_blank" rel="noreferrer">
              LinkedIn post &#8599;
            </a>
          ) : null}
        </div>
      </header>

      <section className="section prose content">
        <h2 className="section-title">Why this exists</h2>
        <div className="section-kicker">the itch</div>
        <p>
          I ship a lot of small things. Every one of them lands on Vercel, connected to a GitHub repo, and then quietly
          gets on with its life. The trouble starts a few months later, when someone asks for a link and I genuinely do
          not know whether it still works.
        </p>
        <p>
          Vercel&apos;s own dashboard is good at showing you <em>one</em> project. It is not built for the question
          &quot;how are all of them?&quot; — and the answer to that question lived, for me, in about a dozen browser
          tabs and a certain amount of hope.
        </p>
        <p>
          So DevDeck is deliberately narrow. It does not manage infrastructure, create projects, or replace anything.
          It shows every project with a status colour, lets me read the build log when one goes red, redeploy when
          that is the fix, and edit a file straight into a commit when the fix is one line. <strong>That is the
          entire product.</strong>
        </p>
      </section>

      <section className="section content">
        <h2 className="section-title">How it got built</h2>
        <div className="section-kicker">february → october 2026</div>
        <ol className="timeline">
          {TIMELINE.map((item) => (
            <li key={item.when} className={item.tone}>
              <div className="tl-when">{item.when}</div>
              <div className="tl-what">{item.what}</div>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section">
        <h2 className="section-title">What it does</h2>
        <div className="section-kicker">features</div>
        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <div className="feature" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section content">
        <h2 className="section-title">Decisions worth defending</h2>
        <div className="section-kicker">and the problems behind them</div>
        <ol className="learnings">
          {DECISIONS.map((decision) => (
            <li key={decision.title}>
              <h3>{decision.title}</h3>
              <p>{decision.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section content">
        <h2 className="section-title">Stack, and why</h2>
        <div className="section-kicker">every choice has a reason or it gets cut</div>
        <div className="stack-list">
          {STACK.map((item) => (
            <div className="stack-row" key={item.name}>
              <div className="stack-name">{item.name}</div>
              <div className="stack-why">{item.why}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="callout content">
        <span className="callout-rail" aria-hidden="true" />
        <p>
          Want to build something — or break something interesting?{' '}
          <Link href="/about#contact">Let&apos;s talk</Link>. More of my work lives at{' '}
          <a href={profile.url} target="_blank" rel="noreferrer">
            charanreddy.dev
          </a>
          .
        </p>
      </div>
    </div>
  );
}
