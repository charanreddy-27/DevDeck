# DevDeck — Full Specification

A single-page-app-style Next.js 14 dashboard to monitor and manage all GitHub projects deployed on Vercel.

## Environment variables (`.env.local`)

| Variable | Required | Purpose |
|---|---|---|
| `VERCEL_TOKEN` | yes | Vercel personal access token |
| `GITHUB_TOKEN` | yes | GitHub fine-grained or classic PAT with `repo` scope |
| `VERCEL_TEAM_ID` | no | Only if projects live under a Vercel team; append `?teamId=` to Vercel API calls when set |

## External APIs

### Vercel REST API (base: `https://api.vercel.com`)

Auth header: `Authorization: Bearer ${VERCEL_TOKEN}`

- `GET /v9/projects` — list all projects. Each includes `id`, `name`, `framework`, `link`
  (`link.type === "github"`, `link.org`, `link.repo`, `link.repoId`, `link.productionBranch`),
  `latestDeployments` and `targets.production`.
- `GET /v6/deployments?projectId={id}&limit=20` — deployment history. Each has `uid`, `state`,
  `created`, `meta` (`githubCommitMessage`, `githubCommitAuthorName`, `githubCommitRef`,
  `githubCommitSha`), `url`, `target`.
- `GET /v2/deployments/{uid}/events` — build logs; render `payload.text` lines.
- `POST /v13/deployments` — trigger redeploy:

```json
{
  "name": "<project name>",
  "project": "<project id>",
  "target": "production",
  "gitSource": { "type": "github", "repoId": 123, "ref": "main" }
}
```

### GitHub REST API (base: `https://api.github.com`)

Auth header: `Authorization: Bearer ${GITHUB_TOKEN}`, plus `Accept: application/vnd.github+json`

- `GET /repos/{owner}/{repo}` — repo metadata (default branch)
- `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` — file tree (`type === "blob"`; skip > 1 MB)
- `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` — file content (base64), keep `sha`
- `PUT /repos/{owner}/{repo}/contents/{path}` — commit an update with `{ message, content, sha, branch }`
- `GET /repos/{owner}/{repo}/commits?per_page=10` — recent commits

## Internal API routes

All under `app/api/`. Each reads tokens from `process.env`, proxies to the external API, and
returns trimmed JSON.

- `GET /api/vercel/projects` → `{ id, name, framework, status, lastDeployedAt, productionUrl, repo: { owner, name, repoId, branch } | null }`
  (also accepts `?id=` for a single project)
- `GET /api/vercel/deployments?projectId=` → normalized deployment list
- `GET /api/vercel/logs?deploymentId=` → array of log lines
- `POST /api/vercel/redeploy` → body `{ projectId }`; the server looks up the git link itself
- `GET /api/github/tree?owner=&repo=` → file tree + default branch
- `GET /api/github/file?owner=&repo=&path=&ref=` → `{ content (decoded utf-8), sha }`
- `PUT /api/github/file` → `{ owner, repo, path, branch, message, content, sha }`
- `GET /api/github/commits?owner=&repo=` → recent commits

## Pages

### `/` — Dashboard

Header with title and summary strip (`{n} projects · {n} ready · {n} building · {n} error`).
Responsive card grid; each card has a 4px status-coloured left rail, project name, framework badge,
repo `owner/name`, relative last-deploy time, status pill and an "Open site" link. Clicking a card
opens `/project/[id]`. Polls `/api/vercel/projects` every 30s. Missing or rejected tokens render an
on-screen setup guide.

### `/project/[id]` — Project detail

Tabs: **Deployments** (default) | **Code** | **Commits**.

- **Deployments** — last 20, click to expand the build log. "Redeploy production" with a confirm
  step and loading state; refetches after 5s.
- **Code** — collapsible file tree left, editor right; editing enables a commit bar with a message
  input and "Commit & Deploy". Success shows a toast and refreshes deployment data.
- **Commits** — recent commits with message, author, relative time, short SHA, GitHub link.
- Projects with no linked GitHub repo show a friendly empty state on Code/Commits.

## Design system

- Background `#0E1116`, panel `#151A21`, border `#232B36`, text `#E6EBF2`, muted `#8A94A6`
- Status: ready `#3FB950`, building `#D29922`, error `#F85149`, queued/canceled `#8A94A6`
- Accent `#4C9AFF`
- Google Fonts via `<link>`: Space Grotesk (headings), IBM Plex Mono (data, code, logs), system sans for body
- Plain global CSS (`app/globals.css`) — no Tailwind, no UI library
- Focus-visible outlines on all interactive elements; `prefers-reduced-motion` respected

## Non-goals

- No authentication/login screen (single-user local tool; tokens in env)
- No database or persistence
- No creating/deleting Vercel projects or GitHub repos
- No multi-file commits or branch creation (single-file commit to the default branch only, v1)
