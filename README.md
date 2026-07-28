# DevDeck

Mission control for every GitHub project you ship on Vercel. One dark dashboard to watch
deploy status live, read build logs, redeploy, and edit repo files straight into a commit.

Next.js 14 (App Router, JavaScript), no database, no login — a single-user local tool.

## Run it

```bash
npm install
cp .env.example .env.local   # then paste your tokens in
npm run dev
```

Open <http://localhost:3000>.

If a token is missing or rejected, the app shows a setup guide on screen instead of an error —
that is the intended first-run experience.

### Tokens

| Variable | Required | Where to get it |
|---|---|---|
| `VERCEL_TOKEN` | yes | <https://vercel.com/account/tokens> |
| `GITHUB_TOKEN` | yes | <https://github.com/settings/tokens> — classic token with the `repo` scope, or fine-grained with Contents: read & write |
| `VERCEL_TEAM_ID` | no | Only if your projects live under a Vercel team (Team Settings → Team ID). Appended as `?teamId=` to every Vercel call |

## What it does

**Dashboard (`/`)** — every Vercel project as a card with a status-coloured left rail, framework,
linked repo, latest production commit, relative deploy time, and a direct link to the live site.
A summary strip counts ready / building / errored and doubles as a filter. Polls every 30 seconds
(paused while the tab is hidden), plus text search over names, repos and commit messages (`/` to focus).

**Project detail (`/project/[id]`)** — three tabs:

- **Deployments** — last 20 deployments with status, branch, commit, author, duration and relative
  time. Click any row to expand its build log (filterable, errors-only toggle, copy button).
  While a deployment is still building the log **live-tails every 5s** and follows the output —
  unless you scroll up to read something, in which case it stays where you put it. "Redeploy
  production" asks for confirmation, then rebuilds the production branch. While a build is in
  flight the list auto-refreshes every 15s and the tab shows a live build counter.
- **Code** — collapsible file tree of the linked repo. Open a file, edit it in a line-numbered
  editor (Tab indents, Ctrl/Cmd+S commits), write a commit message, and "Commit & Deploy" pushes it
  to the default branch via the GitHub Contents API. Vercel's git integration picks up the push,
  so the commit *is* the deploy. You stay in the editor afterwards — switch to Deployments to watch
  the build land.
- **Commits** — the last 10 commits with author, time and a link to GitHub.

Tabs stay mounted once opened, so an in-progress edit survives a trip to the Deployments tab and
the deployment poll keeps running while you are in the editor.

## Architecture

Every external call goes through a Next.js Route Handler. The browser never sees a token and
never talks to `api.vercel.com` or `api.github.com` directly.

```
app/api/vercel/projects      GET   list projects, or ?id= for one
app/api/vercel/deployments   GET   ?projectId= — last N deployments
app/api/vercel/logs          GET   ?deploymentId= — build log lines
app/api/vercel/redeploy      POST  { projectId } — production rebuild
app/api/github/tree          GET   ?owner=&repo= — file tree + default branch
app/api/github/file          GET   ?owner=&repo=&path=&ref= — decoded contents + sha
                             PUT   { owner, repo, path, branch, message, content, sha }
app/api/github/commits       GET   ?owner=&repo= — recent commits
```

- `lib/vercel.js`, `lib/github.js` — token handling and upstream error mapping
- `lib/errors.js` — one error envelope: `{ error: { code, message, hint, service } }`, with any
  configured secret scrubbed out of messages before they are returned or logged
- `lib/normalize.js` — trims Vercel/GitHub payloads to just what the UI needs
- `lib/logs.js` — parses build events (JSON array *or* NDJSON) and strips ANSI colour codes
- Routes are `force-dynamic`, so nothing is prerendered or cached at build time

`lib/package.json` marks that folder as ESM so the test suite can import those modules directly
with plain `node --test`. It does not affect the rest of the app.

Error codes the UI branches on: `missing_token` and `bad_token` render the full setup guide;
`rate_limited`, `not_found`, `conflict` and the rest render an inline banner with a fix hint.

## Tests

```bash
npm test
```

34 assertions over the logic that is easy to get quietly wrong: status normalization, picking the
canonical production alias, the `latestDeployments` fallback, non-GitHub providers, build-duration
maths, relative times, UTF-8 base64 round-tripping, repo-path encoding, secret scrubbing, and log
parsing (NDJSON vs array, ANSI stripping, error/warning classification). No network, no tokens.

## Notes and limits

- Single-file commits to the default branch only — no branch creation, no multi-file commits
- Files over 1 MB and binary files are listed but not editable
- If the file changed on GitHub since you loaded it, the commit is rejected with a 409 and a
  message telling you to reload — DevDeck never force-overwrites
- Projects linked to GitLab or Bitbucket show status fine, but the Code and Commits tabs are
  GitHub-only

## Deploying DevDeck itself

You can `npx vercel` it, but **anyone with the URL could then manage all your projects**. Keep it
local, or turn on Vercel's Deployment Protection / password protection for it.
