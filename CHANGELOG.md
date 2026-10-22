# Changelog

All notable changes to DevDeck. Dates are release dates; versions follow [semver](https://semver.org).

## [2.0.0] — 2026-10-21

The release that turns DevDeck from a local tool into something you can show people: a demo
anyone can open, a password gate for the real thing, and the numbers a deploy dashboard should
have had from the start.

### Added
- **Demo mode.** A seeded, in-memory Vercel and GitHub: ten projects with twenty deployments
  of history each, build logs that stream, redeploys that queue and finish, commits that land and trigger
  a deploy. `DEVDECK_DEMO=1` forces it for every visitor and ignores tokens; otherwise the setup
  guide offers it per browser through a cookie, and the palette can exit it.
- **Data-source layer** (`lib/source`). Every API route reads through `getSource(request)`, which
  returns the live or the demo provider. Both implement one interface, so no route knows which it
  is talking to.
- **Password gate.** `DEVDECK_PASSWORD` puts every page and API route behind an HMAC-SHA256 signed,
  HTTP-only session cookie (Web Crypto, 7 days, timing-safe checks), with a sign-in page that also
  works without JavaScript, sign-in throttling (5 per 15 minutes per IP) and sign out.
  `DEVDECK_SESSION_SECRET` rotates sessions.
- **Insights.** `/api/vercel/activity` fetches the newest 100 deployments across all projects in
  one call. The dashboard shows deploys per day (ready vs failed), success rate, median build and
  what's in flight; each card shows its last deploy outcomes as ticks.
- **Project stats.** The Deployments tab adds success rate, median build, the production/preview
  split and a duration bar per build.
- **Command palette** on <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd>: fuzzy-ranked projects, their live
  sites and app actions, with full keyboard navigation and combobox ARIA. <kbd>?</kbd> opens the
  shortcut list and <kbd>t</kbd> toggles the theme.
- **Light theme.** Every colour is a custom property; a boot script applies the saved or OS theme
  before first paint, so there's no flash.
- **Diff review.** The Code tab can show the exact change a commit will make (Myers line diff,
  3 lines of context, capped so a huge edit degrades to a summary) and keeps a live `+/−` count
  in the commit bar.
- `GET /api/status` reports the data mode and whether the gate is on.
- **CI** (`.github/workflows/ci.yml`): lint, 91 tests and a production build on Node 20 and 22,
  then `scripts/smoke.sh` against the build: no token in the client output (the build sees canary
  values), demo mode end to end, and the password gate locking, rejecting and admitting.

### Changed
- **Next.js 16** (Turbopack) and **React 19.** `proxy.js` replaces middleware.
- **ESLint 9** flat config with `eslint-config-next`, replacing `next lint` (removed in Next 16).
  The React Compiler's hook rules run at full strength: data loaders became promise chains and
  retries reset state in their click handlers, so no effect sets state synchronously.
- The top bar gained a palette button and a theme toggle; below 620px it becomes two rows.
- Link chips use one font everywhere instead of inheriting it from their container.
- Node 20.9 or newer is required (Next.js 16).

### Fixed
- The phone layout scrolled sideways: a long commit message widened the card grid, the top bar
  didn't fit at 390px, and a long bot branch name pushed a deployment row out. Every page now holds
  from 320px up.
- On a narrow card the deploy time and "Open site" link wrapped onto two lines.

## [1.0.0] — 2026-07

First release: every Vercel project on one screen with 30-second status polling, live-tailing
build logs with filtering and copy, edit-a-file-into-a-commit with a 409 on conflicting edits,
redeploy production with a confirm step, error envelopes with hints, a token setup guide, and
34 tests on `node:test`.
