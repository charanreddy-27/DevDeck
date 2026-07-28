# Deploying DevDeck

---

## ⚠️ Read this first

DevDeck has **no authentication**. It's a single-user local tool, and the tokens it holds can:

- redeploy any project in your Vercel account
- read and **commit to** any repository your GitHub token can reach

**Anyone who can open a deployed instance can do all of that.** A public URL is a remote control
for your accounts. Before deploying, pick one:

1. **Keep it local.** `npm run dev` on your machine. Nothing to secure. *(Recommended.)*
2. **Deploy with Vercel Deployment Protection on** — Vercel Authentication (only your Vercel
   account can view it) or Password Protection. Configure it *before* the first deployment
   finishes, not after.
3. **Deploy with a scoped-down GitHub token** — a fine-grained token limited to the specific
   repositories you want editable, so the blast radius is bounded even if the URL leaks.

Do not skip this because it's the boring section.

---

## Deploy to Vercel

### Option A — dashboard

1. Push the repo to GitHub (see the checklist below — it currently has no commits).
2. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick `DevDeck`.
3. Vercel detects Next.js. Leave the build settings alone:

   | Setting | Value |
   |---|---|
   | Framework Preset | Next.js |
   | Build Command | `next build` (default) |
   | Output Directory | `.next` (default) |
   | Install Command | `npm install` (default) |
   | Node Version | 18.x or later |

4. Add the environment variables (next section) **before** clicking Deploy.
5. Deploy. Then immediately: **Project → Settings → Deployment Protection → enable.**

### Option B — CLI

```bash
npm i -g vercel
vercel            # first run links the project
vercel env add VERCEL_TOKEN production
vercel env add GITHUB_TOKEN production
vercel env add VERCEL_TEAM_ID production   # only if your projects live under a team
vercel --prod
```

### Environment variables

Set these under **Settings → Environment Variables**, for Production (and Preview if you use it):

| Name | Required | Value | Notes |
|---|---|---|---|
| `VERCEL_TOKEN` | yes | from [vercel.com/account/tokens](https://vercel.com/account/tokens) | Server-side only — never prefix with `NEXT_PUBLIC_` |
| `GITHUB_TOKEN` | yes | from [github.com/settings/tokens](https://github.com/settings/tokens) | Classic with `repo`, or fine-grained with Contents: read & write |
| `VERCEL_TEAM_ID` | no | Team Settings → Team ID | Only if projects live under a team |
| `NEXT_PUBLIC_SITE_URL` | no | e.g. `https://devdeck.charanreddy.dev` | Sets `metadataBase` so OG/canonical URLs are absolute. Defaults to the devdeck subdomain |

None of these are read at build time, so a build with no env vars still succeeds — it just renders
the setup guide at runtime.

### Custom domain

1. **Project → Settings → Domains → Add** → `devdeck.charanreddy.dev`.
2. At your DNS provider, add the record Vercel shows — for a subdomain that's a `CNAME` to
   `cname.vercel-dns.com`.
3. Wait for propagation, then confirm the certificate is issued.
4. Set `NEXT_PUBLIC_SITE_URL` to the final URL and redeploy so metadata points at the right host.
5. **GET the URL before you put it anywhere.** A "live site" line in a README is a claim, not a
   fact.

---

## Manual checklist — the things only you can do

Nothing below can be done from inside the repo.

1. **Commit and push.** This repo has an `origin` but **zero commits** — `main` is empty, so
   nothing can deploy and a visitor lands on an empty default branch.
   ```bash
   git add -A
   git commit -m "DevDeck: dashboard, logs, edit-to-commit, docs"
   git push -u origin main
   ```
2. **Create the two tokens** and put them in `.env.local` locally (git-ignored) and in Vercel's
   env vars for the deployment.
3. **Turn on Deployment Protection** immediately after the first deploy — see the warning above.
4. **Capture three screenshots** and drop them in `docs/screenshots/` as `dashboard.png`,
   `logs.png`, `editor.png`. The README already references them. A short GIF of the
   edit → commit → build flow is the single highest-value asset here.
5. **Point the DNS** for `devdeck.charanreddy.dev` and verify it resolves.
6. **Update the vault** — `03-projects/_index.md` still says DevDeck's *"code never pushed, not on
   this machine"*, and `03-projects/devdeck/_context.md` says the same. Both are stale now. Add a
   row to `02-career/public-surfaces.md` the day the URL goes live.
7. **Decide the email question.** This project uses the canonical `charanreddychanda27@gmail.com`.
   The portfolio and GitHub profile still show the older address in ~11 places
   (`public-surfaces.md`). Either finish that migration or consciously leave it.
8. **Fill in the live URL and LinkedIn post** in `lib/profile.js` — `liveUrl` and `linkedinPost`
   are `null`, and the UI renders honest placeholders until they aren't.
9. **Post it.** The build story in `/about-project` is written to be the skeleton of that post —
   the "week the build logs won" beat is the part people actually reply to.
10. **Add it to the portfolio's project list** on charanreddy.dev once the URL answers.

---

## Post-deploy verification

```bash
curl -I https://<your-url>                      # 200
curl -s https://<your-url>/api/vercel/projects  # JSON, not an error envelope
curl -sI https://<your-url>/opengraph-image     # image/png, 1200x630
```

Then paste the URL into a LinkedIn or Slack composer and confirm the social card renders. If it
doesn't, `NEXT_PUBLIC_SITE_URL` is wrong.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Setup guide on a deployed instance | Env vars missing or set for the wrong environment | Add them for Production, then **redeploy** — env changes don't apply retroactively |
| "Vercel denied access" | Invalid token, or projects live under a team | Regenerate the token, or set `VERCEL_TEAM_ID` |
| Empty project list | Token scoped to a personal account while projects are on a team | Set `VERCEL_TEAM_ID` |
| Commit fails with a conflict | File changed on GitHub since it was loaded | Reload the file and reapply — this is the safety check working |
| OG image doesn't render when shared | `NEXT_PUBLIC_SITE_URL` unset or wrong | Set it to the canonical URL and redeploy |
| Build fails on the OG route | Node version too old | Use Node 18.17+ |
