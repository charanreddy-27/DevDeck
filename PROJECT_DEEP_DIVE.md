# DevDeck — deep dive

How it's built, why it's built that way, and where the genuinely hard parts are.

---

## 1. The shape of the thing

DevDeck is a Next.js 14 App Router application with three client pages and seven route handlers.
There is no database, no auth layer, no background worker, and no cache. Every screen is a live
read of two external APIs, proxied through this app.

```
Browser  ──►  Next.js route handlers  ──►  api.vercel.com
                    (server only)     └─►  api.github.com
```

The browser never talks to Vercel or GitHub directly and never holds a credential. That is the
single most important structural decision in the codebase, and everything else follows from it.

## 2. Why the server sits in the middle

Three problems disappear at once:

1. **CORS.** Neither API is designed to be called from a browser on an arbitrary origin. Proxying
   makes it a non-issue instead of a fight.
2. **Credential exposure.** A token in client-side code is a token in the bundle, in the network
   tab, and in anybody's devtools. Server-side, it's an env var the client cannot reach.
3. **Payload size and shape.** `GET /v9/projects` returns a large, inconsistent object per project.
   The route handler trims it to the ~12 fields the UI actually renders, so the client stays small
   and the component code stays readable.

The cost is one hop of latency and seven small files. Worth it.

## 3. Folder structure

```
app/
  layout.js                    shell: metadata, fonts, nav, footer, toast provider
  page.js                      dashboard (server) → components/Dashboard.js (client)
  about/page.js                about me + contact card
  about-project/page.js        the build story
  error.js                     render-crash boundary
  not-found.js                 404
  icon.svg                     favicon
  opengraph-image.js           social card, generated with next/og (edge runtime)
  api/
    vercel/projects/route.js     list, or ?id= for one
    vercel/deployments/route.js  ?projectId= → last N deployments
    vercel/logs/route.js         ?deploymentId= → parsed log lines
    vercel/redeploy/route.js     POST { projectId } → production rebuild
    github/tree/route.js         ?owner=&repo= → file tree + default branch
    github/file/route.js         GET file contents · PUT commit
    github/commits/route.js      ?owner=&repo= → recent commits

lib/                           (ESM-scoped via lib/package.json so node:test can import it)
  vercel.js                    Vercel client: auth, teamId, error mapping
  github.js                    GitHub client: auth, path encoding, base64
  errors.js                    ApiError + the single error envelope + secret scrubbing
  normalize.js                 Vercel/GitHub payloads → the shapes the UI renders
  logs.js                      build-event parsing (array vs NDJSON) + ANSI stripping
  format.js                    relative time, durations, bytes, sha, host
  client.js                    fetch wrapper that turns the error envelope into an Error
  profile.js                   identity/links used by metadata, OG card and pages

components/                    all client components
tests/                         node:test suites (*.test.mjs)
```

## 4. Data flow, end to end

### Dashboard

1. `Dashboard.js` mounts, calls `/api/vercel/projects`.
2. The route handler calls `GET /v9/projects?limit=100` with the bearer token, appending
   `teamId` when `VERCEL_TEAM_ID` is set.
3. Each project goes through `normalizeProject()`, which resolves the "what's live in production"
   question (see §6.1) and returns a flat object.
4. The client sorts, filters, renders, and re-polls every 30s — skipping the poll when
   `document.visibilityState !== 'visible'`, so a background tab isn't burning rate limit.

### Edit → commit → deploy

This is the flow worth understanding, because it replaces a CI pipeline with one API call.

1. `GET /api/github/tree` → repo metadata for the default branch, then
   `git/trees/{branch}?recursive=1`. Blobs only; anything over 1 MB is listed but flagged
   `tooLarge` and not selectable.
2. `GET /api/github/file` → `contents/{path}`, base64-decoded server-side. A NUL byte anywhere in
   the decoded text marks it binary and the content is withheld rather than mangled.
3. The user edits. The client tracks `draft !== file.content` as the dirty flag and keeps the
   blob `sha` from step 2.
4. `PUT /api/github/file` → the route base64-encodes the text and calls the Contents API with
   `{ message, content, sha, branch }`.
5. GitHub creates the commit. **Vercel's git integration sees the push and starts a build.**
   Nothing in DevDeck triggers that — it just happens, which is exactly why the design works.
6. The deployments list refetches and the new build appears.

The `sha` is what makes this safe. If the file changed on GitHub since step 2, GitHub rejects the
write with a 409, which is mapped to a `conflict` error telling the user to reload. DevDeck never
force-overwrites somebody else's commit.

## 5. The error contract

Two APIs that disagree about everything, including how to say no, are normalised into one shape:

```json
{ "error": { "code": "bad_token", "message": "…", "hint": "…", "service": "vercel" } }
```

The UI branches on `code` alone, never on message text:

| Code | UI response |
|---|---|
| `missing_token`, `bad_token` | Full-page setup guide with token instructions |
| `rate_limited` | Inline banner, "wait a minute" hint |
| `not_found`, `forbidden`, `conflict`, `bad_request` | Inline banner with the fix hint |
| `network_error`, `upstream_error` | Inline banner with a Retry button |

Adding a third provider means writing one mapper. No UI changes.

### Secret scrubbing

`scrub()` in `lib/errors.js` strips any configured token out of a string before it can reach an
HTTP response or a log line. Upstream APIs occasionally echo request context back, and a token in
a log file is still a leaked token. Values shorter than 7 characters are ignored so it can't
mangle ordinary text.

## 6. The hard parts

### 6.1 "What is actually live in production?"

Vercel gives you at least two answers depending on the endpoint and the project's history:

- `project.targets.production` — present on most projects, uses `readyState` and `createdAt`
- `project.latestDeployments[]` — an array, uses `state` and `created`, ordering not guaranteed
  to be what you want
- older projects can have neither

`normalizeProject()` resolves them in that order, then normalises `READY | ERROR | BUILDING |
QUEUED | CANCELED | NONE` from whichever field exists — folding `INITIALIZING`, `DEPLOYING` and
`UPLOADING` into `BUILDING`, and `CANCELLED` into `CANCELED`, because both spellings appear.

**Picking the production URL** has its own trap. A deployment's `alias` array holds every domain
pointing at it — typically both `my-site-git-main-acme.vercel.app` and `my-site.com`. The
canonical domain is almost always the *shortest* one, so that's the heuristic, falling back to
`deployment.url`. It's a heuristic, and it's documented as one.

### 6.2 Build logs arrive in two different formats

`GET /v2/deployments/{id}/events` returns:

- a **JSON array** when the deployment has finished
- **newline-delimited JSON**, sometimes with `data:` prefixes, while it's still building

`parseEvents()` tries `JSON.parse` on the whole body first, and falls back to line-by-line
parsing. A line that isn't valid JSON is kept as raw text rather than dropped — during a live
build you'd rather see a stray line than silently lose it.

Then the ANSI problem. Log text is full of colour codes: `ESC [ 32 m`. The obvious regex is
`/\[[0-9;]*[A-Za-z]/g` — and it's wrong, because without anchoring to the escape character it
also matches the `[m` inside a perfectly ordinary log line like `branch [main] is up to date`,
which renders as `branch ain] is up to date`. The fix is to build the pattern from
`String.fromCharCode(27)` so no raw control byte ends up in the source file either.

`tests/logs.test.mjs` pins that exact string.

### 6.3 Live tailing without stealing the scroll

While a deployment is `BUILDING` or `QUEUED`, `LogViewer` re-fetches every 5s. Naively scrolling
to the bottom on every update makes the log unreadable the moment you try to read it — you scroll
up to the error, and 5 seconds later you're back at the bottom.

So the component tracks a `pinnedRef`: on every scroll event it records whether the reader is
within 48px of the bottom. The auto-scroll only fires when that's true. Scroll up and it stops
following; a "Jump to end" button re-pins. Polling also pauses when the browser tab is hidden.

### 6.4 Keeping tabs mounted

Committing a file used to switch you to the Deployments tab, unmounting the editor and losing your
place in a large repo tree. Now each tab mounts on first visit and stays mounted (`hidden` when
inactive), which means:

- an in-progress edit survives a trip to Deployments and back
- `DeploymentsTab` keeps polling in the background, which powers the live build counter rendered
  on the tab label itself
- the GitHub tree still isn't fetched until you actually open the Code tab — mounting is lazy, so
  a large repo costs nothing if you never look at it

### 6.5 Editor performance

The editor re-renders on every keystroke. A repo file tree can be thousands of nodes. `FileTree`
is wrapped in `memo()`, and `openFile` reads the dirty flag through a ref instead of taking it as
a dependency — otherwise its identity would change on every keystroke and defeat the memo.

The line-number gutter is a separate element translated by the textarea's `scrollTop` (one scroll
container, not two). Opening a new file resets both, or the gutter silently drifts out of sync.

## 7. Tradeoffs taken deliberately

| Decision | Cost | Why it's right here |
|---|---|---|
| No database | Every load hits the APIs | The APIs are the truth. A cache is a second, wronger copy — and rate limits are generous for one user |
| No auth | Can't be public as-is | Single-user local tool. Auth would be the largest subsystem in the app, protecting one person |
| Polling, not webhooks | Up to 30s of staleness | Webhooks need a public URL and a persistence layer. Polling is a `setInterval` |
| JavaScript, not TypeScript | No compile-time safety | Payloads are validated at the boundary and the normalisers are unit-tested. Types would guard code that's already guarded |
| Textarea, not CodeMirror | No syntax highlighting | The use case is fixing a typo or a config value, not writing features. A CDN editor would add a network dependency and a CSP problem |
| Single-file commits | No refactors across files | Multi-file commits need the Git Trees API and conflict UI. Out of scope for v1 |

## 8. What I'd build next

1. **Deployment protection before it's public.** The security note in DEPLOYMENT.md is not
   decorative — anyone reaching a deployed instance can redeploy and commit to your repos.
2. **Multi-file commits** via the Git Trees API, with a proper diff view before pushing.
3. **A real diff view** — right now you see the file, not what you changed.
4. **Webhook ingestion** instead of polling, if this ever ran for more than one person.
5. **Response caching with a short TTL**, if the polling ever bumps rate limits.

## 9. Testing

`npm test` — 34 assertions, no network, no tokens, `node:test` only.

`lib/` carries its own `package.json` with `{ "type": "module" }`. That scopes ESM to one folder
so the test runner can import those modules directly, without changing how the rest of the app
builds. Verified against both `next build` and `next dev`.

What's covered: status folding, production-alias selection, the `latestDeployments` fallback,
non-GitHub providers, empty payloads, build-duration maths, relative times, byte formatting,
inspector-URL parsing, repo-path encoding, UTF-8 base64 round-trips, secret scrubbing, and the
whole log-parsing pipeline.

What isn't: the authenticated round-trips against real Vercel/GitHub accounts. Those need live
tokens. The error paths — missing tokens, bad tokens, missing params, malformed bodies — were
exercised over HTTP against both dev and production servers.
