# DevDeck — deep dive

How it's built, why it's built that way, and where the genuinely hard parts are. Current as of
v2.0.

---

## 1. The shape of the thing

DevDeck is a Next.js 16 App Router application (React 19, Turbopack) with five pages and twelve
route handlers. There is no database, no background worker, and no cache. Every screen is a live
read of two external APIs, proxied through this app — or, in demo mode, a read of a seeded
simulation that never leaves the server. Authentication is optional: one password, a signed
cookie, checked in `proxy.js` before anything renders.

```
Browser ──► proxy.js ──► route handlers ──► lib/source ──┬─► live ──► api.vercel.com
            (optional     (server only)    (per request)  │           api.github.com
             password)                                    └─► demo ──► seeded, in-memory
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
   The server trims it to the ~12 fields the UI actually renders, so the client stays small and the
   component code stays readable.

The cost is one hop of latency and a dozen small route files. Worth it.

It also paid off later. Demo mode and the password gate both plug in at that one server-side choke
point: swap what answers behind it (§6), or put a check in front of it (§7). Response shapes
didn't change for either; data responses just gained a `mode` field.

## 3. Folder structure

```
proxy.js                       optional password gate (Next 16's rename of middleware)
eslint.config.mjs              ESLint 9 flat config: eslint-config-next, React Compiler hook rules

app/
  layout.js                    shell: metadata, theme boot script, fonts, top bar, palette,
                               demo banner, toast provider
  page.js                      dashboard (server) → components/Dashboard.js (client)
  project/[id]/page.js         project detail → components/ProjectDetail.js (client)
  login/page.js                sign-in; server-rendered so the gate's state is read per request
  about/page.js                about me + contact card
  about-project/page.js        the build story
  error.js                     render-crash boundary
  not-found.js                 404
  icon.svg                     favicon
  opengraph-image.js           social card, generated with next/og, prerendered at build
  api/
    vercel/projects/route.js     list, or ?id= for one
    vercel/deployments/route.js  ?projectId= → last N deployments
    vercel/logs/route.js         ?deploymentId= → parsed log lines
    vercel/redeploy/route.js     POST { projectId } → production rebuild
    vercel/activity/route.js     newest 100 deployments across every project + a summary
    github/tree/route.js         ?owner=&repo= → file tree + default branch
    github/file/route.js         GET file contents · PUT commit
    github/commits/route.js      ?owner=&repo= → recent commits
    demo/route.js                POST / DELETE → set / clear the demo cookie
    status/route.js              { mode, demo, auth } for the app shell
    auth/login/route.js          POST password → session cookie (throttled)
    auth/logout/route.js         POST → clears the session cookie

lib/                           (ESM-scoped via lib/package.json so node:test can import it)
  source/
    index.js                   getSource(request) → the live or the demo provider
    mode.js                    the live/demo rules; import-free so the proxy can use it
    live.js                    live provider: Vercel + GitHub with the server-side tokens
    shared.js                  limits, shared errors, the SOURCE_METHODS interface
    respond.js                 JSON responses that carry `mode`
    demo/                      demo provider: catalog, history, buildlog, repos, store, prng
  auth/
    session.js                 HMAC-signed session cookie (Web Crypto)
    gate.js                    public paths, safe post-login redirect, the 401 body
    throttle.js                per-IP login throttle
  vercel.js                    Vercel client: auth, teamId, error mapping
  github.js                    GitHub client: auth, path encoding, base64
  errors.js                    ApiError + the single error envelope + secret scrubbing
  normalize.js                 Vercel/GitHub payloads → the shapes the UI renders
  logs.js                      build-event parsing (array vs NDJSON) + ANSI stripping
  activity.js                  deployments → per-day counts, success rate, median build
  diff.js                      Myers line diff + unified hunks
  fuzzy.js                     command-palette ranking
  theme.js                     light/dark: boot script, storage, subscription
  format.js                    relative time, durations, bytes, sha, host
  client.js                    fetch wrapper: error envelope → Error, records `mode`, 401 → /login
  profile.js                   identity/links used by metadata, OG card and pages

components/                    all client components
tests/                         node:test suites (*.test.mjs)
```

## 4. Data flow, end to end

### Dashboard

1. `Dashboard.js` mounts and fetches `/api/vercel/projects` and `/api/vercel/activity`.
2. The route handler calls `getSource(request)` and asks the provider for `listProjects()`. The live
   provider calls `GET /v9/projects?limit=100` with the bearer token, appending `teamId` when
   `VERCEL_TEAM_ID` is set.
3. Each project goes through `normalizeProject()`, which resolves the "what's live in production"
   question (see §11.1) and returns a flat object. The provider sorts newest deploy first.
4. The response carries `mode: 'live' | 'demo'` next to the data. The client filters, renders, and
   re-polls every 30s — skipping the poll when `document.visibilityState !== 'visible'`, so a
   background tab isn't burning rate limit. Activity rides along with every poll (§8).

### Edit → commit → deploy

This is the flow worth understanding, because it replaces a CI pipeline with one API call.

1. `GET /api/github/tree` → repo metadata for the default branch, then
   `git/trees/{branch}?recursive=1`. Blobs only; anything over 1 MB is listed but flagged
   `tooLarge` and not selectable.
2. `GET /api/github/file` → `contents/{path}`, base64-decoded server-side. A NUL byte anywhere in
   the decoded text marks it binary and the content is withheld rather than mangled.
3. The user edits. The client tracks `draft !== file.content` as the dirty flag and keeps the
   blob `sha` from step 2. The commit bar shows a live `+/−` count, and **Review changes** swaps
   the editor for the diff the commit will make (§9).
4. `PUT /api/github/file` → the live provider base64-encodes the text and calls the Contents API
   with `{ message, content, sha, branch }`.
5. GitHub creates the commit. **Vercel's git integration sees the push and starts a build.**
   Nothing in DevDeck triggers that — it just happens, which is exactly why the design works.
6. The deployments list refetches and the new build appears.

The `sha` is what makes this safe. If the file changed on GitHub since step 2, GitHub rejects the
write with a 409, which is mapped to a `conflict` error telling the user to reload. DevDeck never
force-overwrites somebody else's commit.

In demo mode, steps 4–5 are simulated: the write goes to an in-memory store and starts a simulated
production build. A stale `sha` is rejected with the same 409 as live.

## 5. The error contract

Two APIs that disagree about everything, including how to say no, are normalised into one shape:

```json
{ "mode": "live", "error": { "code": "bad_token", "message": "…", "hint": "…", "service": "vercel" } }
```

`mode` sits beside the envelope, never inside it; the envelope itself didn't change in v2. The UI
branches on `code` alone, never on message text:

| Code | UI response |
|---|---|
| `missing_token`, `bad_token` | Full-page setup guide with token instructions (and a way into the demo) |
| `unauthorized` | Only from the password gate. `fetchJson` does a full navigation to `/login?next=…` |
| `rate_limited` | Inline banner, "wait a minute" hint |
| `not_found`, `forbidden`, `conflict`, `bad_request` | Inline banner with the fix hint |
| `network_error`, `upstream_error` | Inline banner with a Retry button |

Adding a third provider means writing one mapper. No UI changes.

### Secret scrubbing

`scrub()` in `lib/errors.js` strips any configured secret out of a string before it can reach an
HTTP response or a log line: both tokens, `VERCEL_TEAM_ID`, and since v2 `DEVDECK_PASSWORD` and
`DEVDECK_SESSION_SECRET`. Upstream APIs occasionally echo request context back, and a token in a
log file is still a leaked token. Values shorter than 7 characters are ignored so it can't mangle
ordinary text.

## 6. The data-source layer and demo mode

In v1 each route handler called Vercel or GitHub inline. In v2 every data route does the same
three things:

```js
const source = getSource(request);
const result = await source.listProjects();
return respond(source, result);
```

`getSource` returns one of two providers with the same ten methods (`SOURCE_METHODS` in
`lib/source/shared.js`; a test asserts both implement all of them). Route handlers still validate
their own params, and nothing else. No route handler knows whether the data is real.

### Which provider answers

The rules live at the top of `lib/source/mode.js`, in order:

1. `DEVDECK_DEMO=1` forces demo for everyone and ignores any tokens. That's the public-deployment
   mode.
2. If any real token is configured, the demo cookie is ignored. Fake data must never be shown over
   a real account by accident.
3. Otherwise a `devdeck_demo=1` cookie opts this browser in. The setup guide's "Explore the live
   demo" button sets it through `POST /api/demo`; the demo banner's "Exit demo" clears it with
   `DELETE`.
4. Otherwise live — which, with no tokens, renders the setup guide.

`mode.js` imports nothing, so the proxy can use it without pulling either provider in.
`POST /api/demo` answers 409 while tokens are set, rather than setting a cookie that rule 2 would
silently ignore.

Every data response carries a top-level `mode`. `fetchJson` records it and the demo banner reads
it through `useSyncExternalStore`, so the banner appears with the first demo response and costs no
request of its own. `/api/status` adds whether demo is forced (no "Exit demo" button then) and
whether the gate is on.

### The demo provider

There is no `fetch` anywhere in `lib/source/demo/`. A test replaces `globalThis.fetch` with a
function that throws and runs every method. That is what makes `DEVDECK_DEMO=1` safe on a public
URL: no code path can reach a real account.

It builds raw payloads in Vercel's and GitHub's own shapes and passes them through the real
`normalizeProject`, `normalizeDeployment`, `normalizeCommit` and `parseLogLines`, so a demo response
can't drift from a live one. The limits and errors in `shared.js` are shared too: a file over 1 MB
or a stale sha fails in demo with exactly the error live would return.

- **Time.** Nothing stores a timestamp. Every historical deployment is an offset from an anchor,
  `floor(now / 2 min) * 2 min`. Within a cycle every request sees identical data, so polling is
  stable and React keys don't churn. Across cycles the history slides forward, so the newest
  deploy is always minutes old, however long the demo has been running.
- **Randomness.** Seeded (an FNV-1a hash into mulberry32), never `Math.random`, so the same clock
  gives the same data on every request and every serverless instance.
- **A build that's always running.** One project gets a production deployment every cycle whose
  state is a pure function of the wall clock: QUEUED, then BUILDING, then READY. Each log line
  carries a weight — its share of the build time — so filtering by elapsed time makes the log grow
  between polls, and the live tail has something to tail.
- **A real bug.** `synapse-web`'s build fails with a TypeScript error: a type renamed `embedding`
  to `embeddings` and a page still reads the old name. The check runs against the repo with demo
  writes applied, so fixing it in the editor and committing turns the next build green.
- **Writes.** Commits and redeploys go into an in-memory list capped at 50. A commit changes the
  file, adds a commit, and starts a simulated production build that goes QUEUED → BUILDING →
  READY (or ERROR) over about 45 seconds. On serverless the list is per instance and vanishes on
  a cold start. For a demo that's fine, and there is nothing persisted to abuse.

## 7. The password gate

Off unless `DEVDECK_PASSWORD` is set, and always off under `DEVDECK_DEMO=1` — a forced demo holds
no real tokens, so there's nothing to protect.

`proxy.js` runs before every request except static build output. The public paths are the login
page, `POST /api/auth/login`, the icons, the OG image and `robots.txt`. Everything else needs a
valid session cookie:

- API requests without one get a 401 in the standard envelope, code `unauthorized`.
- Page requests are redirected to `/login?next=<where they were going>`.

The routing rules live in `lib/auth/gate.js` as plain functions, so they're tested directly
rather than buried in a framework hook.

**The session** is a signed expiry and nothing else: `v1.<expiresAt>.<HMAC-SHA256>`, where the
HMAC covers `v1.<expiresAt>`. No user id and no server-side store — there is exactly one user,
and "knows the password" is the whole identity. The cookie is `devdeck_session`: HttpOnly,
SameSite=Lax, Secure in production, 7-day TTL. Verification rejects anything malformed, wrongly
signed, expired, or claiming more than 7 days (plus 5 minutes of clock skew) of life.

**The key** is `DEVDECK_SESSION_SECRET` if set. Otherwise it's SHA-256 of the password behind a
domain-separation prefix (`devdeck/session-key/v1\0`), so the derived key is never the same bytes
as anything else computed from the password. A side effect I want: changing the password logs every
session out.

It is Web Crypto only (`crypto.subtle`), so the same module runs in the proxy, in route handlers
and under `node:test`.

**The password check** hashes both sides with SHA-256 and compares the digests in constant time:
always 32 bytes against 32, no early exit on length or on the first differing byte. HMAC
verification goes through `subtle.verify`, which is constant-time as well.

**Brute force.** The login endpoint allows 5 failed attempts per IP per 15 minutes, then answers
429 with `Retry-After`. A success resets the count. It's in memory, so on serverless it's per
instance — a speed bump, not a wall — but it turns online guessing from minutes into years. The
wrong-password message says nothing about why.

**Redirects.** `next` survives only as a same-origin path. Absolute URLs, `//evil.com`,
backslashes and control characters collapse to `/`, and so does `/login` itself, so signing in
can't loop.

The login form is a real `<form method="post">`, so signing in works without JavaScript: the
endpoint answers a form post with a 303 instead of JSON. Logout clears the cookie, and because
sessions are stateless, that's all it can do (see §12).

## 8. Activity and insights

The question v1 couldn't answer: is this getting better or worse? `/v6/deployments` without a
`projectId` returns the newest deployments across every project, each tagged with its project's id
and name — one request instead of one per project. `/api/vercel/activity` asks for the newest 100.

`lib/activity.js` turns them into:

- per-day counts (ready / error / canceled) for the last 14 days, bucketed in UTC — the server
  can't know the viewer's timezone, so the raw deployments ship alongside
- success rate = ready ÷ (ready + error). Canceled and in-flight builds are neither a success nor
  a failure
- median build time of successful builds
- per project, the states of its newest 10 deployments

It's pure, so it's tested directly and gives the same answer on live and demo data.

`components/Insights.js` draws three things, all hand-written SVG:

- **`InsightsStrip`** on the dashboard: deploys per day as stacked bars, success rate with a meter,
  median build, and what's in flight right now (taken from the project list, so it always matches
  the cards). Leading empty days are trimmed, with a 7-day minimum — 100 deployments may cover
  less than 14 days.
- **`OutcomeStrip`** on each `ProjectCard`: the last deploys as ticks, oldest → newest, so a
  project that keeps failing stands out before you read anything.
- **`DeploymentStats`** on the project page: success rate, median build, the production/preview
  split, and one bar per build showing its duration. Computed from the 20 deployments the tab has
  already loaded, so it costs no request.

Activity rides along with the dashboard's 30s poll. It's a nice-to-have, so a failure is swallowed:
the strip keeps its last numbers and the grid is unaffected.

## 9. Diff review

v1's "what I'd build next" list said it plainly: you see the file, not what you changed. v2 fixes
that in the Code tab. While the draft differs from the file, the commit bar shows a live `+N −M`,
**Review changes** swaps the editor for a unified diff (the editor is hidden, not unmounted), and
**Reset** puts the draft back to the file as loaded.

`lib/diff.js`:

1. Split into lines. A trailing newline ends the last line rather than starting an empty one.
2. Trim the common prefix and suffix. A one-line edit in a 5,000-line file becomes a one-line
   problem.
3. Run Myers' O(ND) algorithm on what's left, so the cost scales with the size of the edit, not the
   file, and the result is a minimal edit script.
4. Cap it. Past an edit distance of 2,000, bail out with `tooLarge` and report the size of the
   changed region instead. Myers keeps a copy of its frontier per step for the backtrack, so memory
   grows with D × (N + M); a whole-file rewrite would spend seconds and megabytes on a diff nobody
   reads line by line.
5. `toHunks` groups changes into unified hunks with 3 lines of context. Changes close enough to
   share context share a hunk.

The live count re-diffs on every change, so it reads `useDeferredValue(draft)` rather than
`draft`. Typing stays at full priority and the count catches up a frame later — in a big file,
that's the difference between an editor that keeps up and one that stutters.

## 10. Palette, shortcuts and themes

**Command palette** (`components/CommandPalette.js`). ⌘K / Ctrl+K from anywhere: jump to a project,
open its live site, toggle the theme, see the shortcuts, or leave the demo (only offered in demo
mode). Projects are fetched when it opens and cached for 30 seconds, because it can open on any
page, not just the dashboard. The top bar's search-shaped button opens it by dispatching a
`devdeck:palette` window event, so the button and the palette share no state.

Ranking is `lib/fuzzy.js`. A query matches if its characters appear in order. A contiguous
substring always outranks a scattered match; word-start hits beat mid-word hits; earlier beats
later; shorter targets win ties. Equal scores keep their input order, which is how projects stay
above actions. "Open <project> site" entries only appear once you type, or ten of them would drown
the list.

The palette also owns the one global key handler for every app-wide shortcut: ⌘K, Esc, `?` for the
shortcuts dialog and `t` for theme. Single-key shortcuts are ignored while you're typing in a
field. The dashboard's `/` (focus the filter) stays in the dashboard, because it only means
something there.

**Themes** (`lib/theme.js`, `components/ThemeToggle.js`). The theme is `data-theme` on `<html>`. A
small inline script in `<head>` sets it before first paint — from localStorage `devdeck-theme` if
you've chosen, otherwise from `prefers-color-scheme` — so there's no flash of the wrong theme.
Storage access is wrapped in try/catch: the worst case is a theme that isn't remembered, never a
crash. The toggle reads the attribute through `useSyncExternalStore` with a `MutationObserver`, so
the button, the `t` key and the palette action can't disagree. Colours are CSS custom properties
on `:root` in `app/globals.css`, with one `[data-theme='light']` block overriding them; no
component hard-codes a colour.

**Small screens.** Below 620px the header becomes two rows — brand and actions on top, the nav on
its own scrollable row — and grids use `minmax(0, 1fr)` so a long commit message can't widen a
column. The layout holds from 320px up.

## 11. The hard parts

### 11.1 "What is actually live in production?"

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

### 11.2 Build logs arrive in two different formats

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

### 11.3 Live tailing without stealing the scroll

While a deployment is `BUILDING` or `QUEUED`, `LogViewer` re-fetches every 5s. Naively scrolling
to the bottom on every update makes the log unreadable the moment you try to read it — you scroll
up to the error, and 5 seconds later you're back at the bottom.

So the component tracks a `pinnedRef`: on every scroll event it records whether the reader is
within 48px of the bottom. The auto-scroll only fires when that's true. Scroll up and it stops
following; a "Jump to end" button re-pins. Polling also pauses when the browser tab is hidden.

### 11.4 Keeping tabs mounted

Committing a file used to switch you to the Deployments tab, unmounting the editor and losing your
place in a large repo tree. Now each tab mounts on first visit and stays mounted (`hidden` when
inactive), which means:

- an in-progress edit survives a trip to Deployments and back
- `DeploymentsTab` keeps polling in the background, which powers the live build counter rendered
  on the tab label itself
- the GitHub tree still isn't fetched until you actually open the Code tab — mounting is lazy, so
  a large repo costs nothing if you never look at it

### 11.5 Editor performance

The editor re-renders on every keystroke. A repo file tree can be thousands of nodes. `FileTree`
is wrapped in `memo()`, and `openFile` reads the dirty flag through a ref instead of taking it as
a dependency — otherwise its identity would change on every keystroke and defeat the memo. The ref
is updated in an effect, not during render (§11.6).

The line-number gutter is a separate element translated by the textarea's `scrollTop` (one scroll
container, not two). Opening a new file resets both, or the gutter silently drifts out of sync.

### 11.6 Loaders under the React Compiler's lint rules

v2 lints with ESLint 9's flat config and `eslint-config-next`, which brings in
eslint-plugin-react-hooks 7 and the React Compiler's rules. They run at the preset's severity, and
there isn't a single hook-rule disable in the codebase.

`set-state-in-effect` failed every v1 data loader. Most looked like this:

```js
const load = useCallback(async () => {
  setError(null);                      // synchronous setState…
  try {
    const data = await fetchJson(url);
    setCommits(data.commits || []);
  } catch (err) {
    setError(err);
  }
}, [url]);

useEffect(() => { load(); }, [load]);  // …reached from an effect body
```

Calling setState synchronously inside an effect means render, commit, effect, set state, render
again. The v2 loaders in `Dashboard`, `DeploymentsTab`, `LogViewer`, `CommitsTab`, `CodeTab` and
`ProjectDetail` are promise chains instead:

```js
const load = useCallback(
  () => fetchJson(url).then(
    (data) => { setCommits(data.commits || []); setError(null); },
    (err) => setError(err),
  ),
  [url],
);
```

State changes only in a callback after the response, never synchronously in the effect. The
initial loading state is derived (`data === null && !error`) or simply starts `true`. Where a Retry
has to clear the error or bring the skeleton back, it does that in the click handler — an event,
which is where setting state belongs — and then calls `load()`. The dashboard's background refresh
follows the same split: `refresh()` sets `refreshing` and calls `load({ silent: true })`.

Two more fell out of `CodeTab`: `refs` flagged `dirtyRef.current = dirty` written during render (it
now lives in an effect), and `preserve-manual-memoization` flagged `openFile` depending on
`tree?.branch` (it now depends on a derived `branch`).

## 12. Tradeoffs taken deliberately

| Decision | Cost | Why it's right here |
|---|---|---|
| No database | Every load hits the APIs | The APIs are the truth. A cache is a second, wronger copy — and rate limits are generous for one user |
| One shared password, stateless sessions | No user accounts or audit trail. Logout clears the cookie but can't revoke a copied one before it expires (7 days) | It protects one person's tokens. A signed cookie needs no store in an app that has none, and changing the password (or the session secret) kills every session at once |
| In-memory demo writes and login throttle | Per serverless instance, gone on a cold start | Nothing in the demo is worth persisting, and a KV store for a speed bump would be the app's first piece of infrastructure |
| Polling, not webhooks | Up to 30s of staleness | Webhooks need a public URL and a persistence layer. Polling is a `setInterval` |
| JavaScript, not TypeScript | No compile-time safety | Payloads are validated at the boundary and the normalisers are unit-tested. Types would guard code that's already guarded |
| Textarea, not CodeMirror | No syntax highlighting | The use case is fixing a typo or a config value, not writing features. A CDN editor would add a network dependency and a CSP problem |
| Own diff and SVG charts, no libraries | Mine to maintain | Two pure, tested functions and a few small charts. Runtime dependencies are still just `next`, `react` and `react-dom` |
| Single-file commits | No refactors across files | Multi-file commits need the Git Trees API and conflict UI. Still out of scope in v2 |

## 13. What I'd build next

1. **Real accounts, if it ever served more than me.** The gate is one shared password. A team
   needs to know who committed what, which means per-user sign-in.
2. **Multi-file commits** via the Git Trees API. The diff view exists now, so the review step is
   already there.
3. **Webhook ingestion** instead of polling, if this ever ran for more than one person.
4. **A shared store for the login throttle**, if per-instance memory stops being enough.
5. **Response caching with a short TTL**, if the polling — now two calls every 30s on the
   dashboard — ever bumps rate limits.

## 14. Testing

`npm test` — 91 tests, no network, no tokens, `node:test` only. The original 34 over parsing and
normalising are all still there.

`lib/` carries its own `package.json` with `{ "type": "module" }`. That scopes ESM to one folder
so the test runner can import those modules directly, without changing how the rest of the app
builds. Verified against both `next build` and `next dev`.

What's covered: status folding, production-alias selection, the `latestDeployments` fallback,
non-GitHub providers, empty payloads, build-duration maths, relative times, byte formatting,
inspector-URL parsing, repo-path encoding, UTF-8 base64 round-trips, secret scrubbing, and the
whole log-parsing pipeline. Since v2, also: the full live/demo mode matrix; both providers
implementing the whole interface; the live provider against a mocked `fetch` (the 409 mapping, the
1 MB and binary limits, the repo-less redeploy, the one-call activity feed); the demo's
determinism, clock-driven builds, commits, redeploys, the scripted bug and its fix, the write cap,
and that it never touches the network; session signing, expiry, tampering and the TTL bound; key
derivation; constant-time comparison; cookie flags; safe redirects; public paths; the gate's
on/off rules; the login throttle; activity aggregation; the diff, including the bail-out; and the
fuzzy ranking.

What isn't: the authenticated round-trips against real Vercel/GitHub accounts, which need live
tokens; `proxy.js` itself, as opposed to the gate rules it calls; and the React components, which
have no tests of their own.
