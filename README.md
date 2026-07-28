<div align="center">

# DevDeck

**Mission control for everything you ship on Vercel.**

Live deploy status, streaming build logs, one-click redeploy, and edit-a-file-into-a-commit —
for every project in your account, on one screen.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-18-149eca)](https://react.dev)
[![Tests](https://img.shields.io/badge/tests-34%20passing-3fb950)](#tests)
[![License](https://img.shields.io/badge/license-MIT-8a94a6)](LICENSE)

<!-- Live demo: not deployed yet. See DEPLOYMENT.md — and read the security note there
     before putting this on a public URL. -->

</div>

---

## The problem

I ship a lot of small things. Every one lands on Vercel, wired to a GitHub repo, and then quietly
gets on with its life. The trouble starts months later, when someone asks for a link and I don't
actually know whether it still works.

Vercel's dashboard is good at showing you *one* project. It isn't built for **"how are all of
them?"** — and for me the answer to that lived in about a dozen browser tabs and a certain amount
of hope.

DevDeck answers it in one glance, and gives you the three things you actually reach for when the
answer is bad: the build log, a redeploy button, and a way to fix a one-line mistake without
leaving the page.

## Screenshots

> **TODO — drop captures into `docs/screenshots/`, then uncomment the block below.**
> Highest-value asset: a short GIF of the edit → commit → build flow.
>
> `dashboard.png` · `logs.png` · `editor.png`

<!--
| Dashboard | Build log | Edit → commit |
|---|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Build log](docs/screenshots/logs.png) | ![Editor](docs/screenshots/editor.png) |
-->

## Features

- **Every project, one glance** — status-railed cards with framework, linked repo, latest
  production commit and relative deploy time. Polls every 30s, pauses when the tab is hidden.
- **Build logs that live-tail** — expand any deployment for its log. While it's still building the
  log refreshes every 5s and follows the output *unless you've scrolled up to read something*.
  Filterable, errors-only toggle, one-click copy.
- **Edit a file into a deploy** — browse the linked repo, edit in a line-numbered editor
  (Tab indents, Ctrl/Cmd+S commits), write a message, push. Vercel builds the commit. The commit
  *is* the deploy.
- **Redeploy production** — rebuilds the production branch, with a confirm step, because a
  one-click production deploy next to a scroll wheel is a bad idea.
- **Errors that tell you the fix** — every failure carries a code, a message and a hint. A missing
  or rejected token renders the full setup guide instead of a stack trace.
- **No database** — everything is live from the APIs. No cache to go stale, no schema to migrate.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14, App Router | Route handlers put a server between the browser and the tokens without deploying a second service |
| Language | JavaScript | A thin, well-tested layer over two REST APIs, validated at the boundary. Types would have been ceremony |
| Styling | Plain CSS custom properties | One stylesheet. A utility framework would have been more config than styling |
| Data | Vercel REST + GitHub REST | Vercel rebuilds on push, so a GitHub Contents API commit *is* the deploy pipeline |
| Tests | `node:test` | Zero test dependencies; the logic worth testing is pure functions |
| Persistence | None | The APIs are the source of truth. A cache is just a wronger copy of it |

## Run it locally

```bash
git clone https://github.com/charanreddy-27/DevDeck.git
cd DevDeck
npm install
cp .env.example .env.local   # paste your two tokens
npm run dev
```

Open <http://localhost:3000>. If a token is missing or rejected, the app renders a setup guide
on screen instead of an error — that's the intended first-run experience.

### Tokens

| Variable | Required | Where |
|---|---|---|
| `VERCEL_TOKEN` | yes | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `GITHUB_TOKEN` | yes | [github.com/settings/tokens](https://github.com/settings/tokens) — classic with `repo`, or fine-grained with Contents: read & write |
| `VERCEL_TEAM_ID` | no | Only if your projects live under a team. Appended as `?teamId=` to every Vercel call |

Tokens are read server-side only and are scrubbed out of any error message before it's returned
or logged. No token string appears in the client bundle — there's a check for that.

## Tests

```bash
npm test
```

34 assertions over the logic that's easy to get quietly wrong: status normalisation, picking the
canonical production alias, the `latestDeployments` fallback, non-GitHub providers, build-duration
maths, relative times, UTF-8 base64 round-tripping, repo-path encoding, secret scrubbing, and log
parsing (NDJSON vs array, ANSI stripping, error classification). No network, no tokens required.

## Documentation

| Doc | What's in it |
|---|---|
| [PROJECT_DEEP_DIVE.md](PROJECT_DEEP_DIVE.md) | Architecture, data flow, folder structure, tradeoffs, how the hard parts work |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Shipping to Vercel, env vars, custom domain — plus the security note that matters |
| [INTERVIEW_PREP.md](INTERVIEW_PREP.md) | Walkthrough, STAR stories, likely Q&A |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Conventions if you're extending it |

## Limits (on purpose)

- Single-file commits to the default branch — no branch creation, no multi-file commits
- Files over 1 MB and binary files are listed but not editable
- If the file changed on GitHub since you loaded it, the commit is rejected with a 409 and a
  message telling you to reload. DevDeck never force-overwrites
- GitLab/Bitbucket projects show status fine, but Code and Commits are GitHub-only
- No auth — it's a single-user local tool. **Read the security note in DEPLOYMENT.md before
  putting it on a public URL**

---

## About the developer

**Chanda Charan Reddy** — AI & Automation Engineer, Bangalore.

I build intelligent systems — mostly the unglamorous half, where something that looks like magic
in a notebook has to survive real traffic and real people. A Springer-published model that reads
chest X-rays well enough for a radiologist to take seriously; document pipelines that run
themselves. Before that I wrote real-time control code for jet engines at DRDO, where a
millisecond of lag isn't a bug — it's a flameout.

DevDeck is one project. There are twenty more — and a few jet engines — over at
**[charanreddy.dev](https://www.charanreddy.dev)**.

[Portfolio](https://www.charanreddy.dev) ·
[LinkedIn](https://www.linkedin.com/in/chandacharanreddy/) ·
[GitHub](https://github.com/charanreddy-27) ·
[Book a call](https://cal.com/charanreddy-27/30min) ·
[Résumé](https://www.charanreddy.dev/resume.pdf)

*Want to build something — or break something interesting? Let's talk.*

---

<sub>MIT licensed. Crafted with intent.</sub>
