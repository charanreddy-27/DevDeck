# Deploying DevDeck

There are two very different things you might deploy:

| | A public demo | Your own dashboard |
|---|---|---|
| Data | Simulated, in memory | Your real Vercel and GitHub accounts |
| Env | `DEVDECK_DEMO=1` and nothing else | Tokens **and** `DEVDECK_PASSWORD` |
| Risk | None. No code path can reach a real account | A leaked session is a remote control for your accounts |

---

## ⚠️ Read this first (your own dashboard)

The tokens DevDeck holds can:

- redeploy any project in your Vercel account
- read and **commit to** any repository your GitHub token can reach

Since 2.0 DevDeck has a password gate: set `DEVDECK_PASSWORD` and every page and API route
requires a signed, HTTP-only session cookie (7 days), with sign-in attempts throttled to 5 per 15
minutes per IP. **Do not put real tokens on a URL without it.** Layer the rest on top:

1. **Keep it local** if you can. `npm run dev` on your machine. Nothing to secure.
2. **Set `DEVDECK_PASSWORD`** to something long and random (a password manager's 24+ characters).
   It's one shared password, not user accounts. It protects one person's tokens.
3. **Use a scoped-down GitHub token**, fine-grained and limited to the repositories you want
   editable, so the blast radius is bounded even if a session leaks.
4. **Optionally add Vercel Deployment Protection** (Vercel Authentication) in front of it, so
   only your Vercel account can even reach the login page.

Do not skip this because it's the boring section.

---

## A public demo

```bash
vercel env add DEVDECK_DEMO production   # value: 1
vercel --prod
```

`DEVDECK_DEMO=1` serves the simulated workspace to every visitor and **ignores any tokens**, even
if some are set by mistake. The password gate is also off in this mode, because there's nothing
to protect. Edits, commits and redeploys are real interactions against an in-memory simulation;
they reset when the server instance recycles.

## Your own dashboard

### Option A: dashboard

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick `DevDeck`.
2. Vercel detects Next.js. Leave the build settings alone:

   | Setting | Value |
   |---|---|
   | Framework Preset | Next.js |
   | Build Command | `next build` (default) |
   | Output Directory | `.next` (default) |
   | Install Command | `npm install` (default) |
   | Node Version | 20.x or later (Next.js 16 needs 20.9+) |

3. Add the environment variables (next section), **including `DEVDECK_PASSWORD`**, before
   clicking Deploy.
4. Deploy, open the URL, and confirm you land on the sign-in page.

### Option B: CLI

```bash
npm i -g vercel
vercel                                       # first run links the project
vercel env add VERCEL_TOKEN production
vercel env add GITHUB_TOKEN production
vercel env add DEVDECK_PASSWORD production
vercel env add VERCEL_TEAM_ID production     # only if your projects live under a team
vercel --prod
```

### Environment variables

Set these under **Settings → Environment Variables**, for Production (and Preview if you use it):

| Name | Required | Value | Notes |
|---|---|---|---|
| `VERCEL_TOKEN` | for live data | from [vercel.com/account/tokens](https://vercel.com/account/tokens) | Server-side only. Never prefix with `NEXT_PUBLIC_` |
| `GITHUB_TOKEN` | for live data | from [github.com/settings/tokens](https://github.com/settings/tokens) | Classic with `repo`, or fine-grained with Contents: read & write |
| `DEVDECK_PASSWORD` | yes, with real tokens | a long random string | Turns on the gate for every page and API route |
| `DEVDECK_SESSION_SECRET` | no | a long random string | Signs session cookies. Defaults to a key derived from the password. Change it to sign every session out |
| `VERCEL_TEAM_ID` | no | Team Settings → Team ID | Only if projects live under a team |
| `DEVDECK_DEMO` | no | `1` | Public demo mode; see above. Overrides everything else |
| `NEXT_PUBLIC_SITE_URL` | no | e.g. `https://devdeck.charanreddy.dev` | Sets `metadataBase` so OG/canonical URLs are absolute. Defaults to the devdeck subdomain |

None of these are read at build time, so a build with no env vars still succeeds. It just renders
the setup guide at runtime. CI builds with canary token values and fails if either appears in the
client output.

### Custom domain

1. **Project → Settings → Domains → Add** → `devdeck.charanreddy.dev`.
2. At your DNS provider, add the record Vercel shows. For a subdomain that's a `CNAME` to
   `cname.vercel-dns.com`.
3. Wait for propagation, then confirm the certificate is issued.
4. Set `NEXT_PUBLIC_SITE_URL` to the final URL and redeploy so metadata points at the right host.
5. **GET the URL before you put it anywhere.** A "live site" line in a README is a claim, not a
   fact.

---

## Manual checklist: the things only you can do

Nothing below can be done from inside the repo.

1. **Decide which deployment this is.** A public demo (`DEVDECK_DEMO=1`) is the one to link from
   a portfolio. Your own dashboard should sit behind `DEVDECK_PASSWORD` and ideally not be linked
   at all.
2. **Create the two tokens** (only for your own dashboard) and put them in `.env.local` locally
   (git-ignored) and in Vercel's env vars for the deployment.
3. **Point the DNS** for `devdeck.charanreddy.dev` and verify it resolves.
4. **Fill in the live URL and LinkedIn post** in `lib/profile.js`. `liveUrl` and `linkedinPost`
   are `null`, and the UI renders honest placeholders until they aren't.
5. **Update the vault.** `03-projects/_index.md` and `03-projects/devdeck/_context.md` still say
   DevDeck's code was never pushed. Add a row to `02-career/public-surfaces.md` the day the URL
   goes live.
6. **Decide the email question.** This project uses the canonical `charanreddychanda27@gmail.com`.
   The portfolio and GitHub profile still show the older address in ~11 places
   (`public-surfaces.md`). Either finish that migration or consciously leave it.
7. **Post it.** The build story in `/about-project` is written to be the skeleton of that post.
   The "week the build logs won" beat is the part people actually reply to.
8. **Add it to the portfolio's project list** on charanreddy.dev once the URL answers.

---

## Post-deploy verification

Public demo:

```bash
curl -s https://<your-url>/api/status            # {"mode":"demo",...}
curl -s https://<your-url>/api/vercel/projects   # simulated projects
curl -sI https://<your-url>/opengraph-image      # image/png, 1200x630
```

Your own dashboard:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<your-url>/api/vercel/projects   # 401
curl -s -o /dev/null -w '%{redirect_url}\n' https://<your-url>/                   # .../login?next=%2F
```

Then sign in in a browser and check the dashboard loads. Paste the URL into a LinkedIn or Slack
composer and confirm the social card renders. If it doesn't, `NEXT_PUBLIC_SITE_URL` is wrong.

`npm run smoke` runs the same checks locally against a production build: no token in the client
output, demo mode, and the gate.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Setup guide on a deployed instance | Env vars missing or set for the wrong environment | Add them for Production, then **redeploy**. Env changes don't apply retroactively |
| Demo data when you expected your projects | `DEVDECK_DEMO=1` is set | Remove it and redeploy. It overrides tokens on purpose |
| Sign-in page loops back to itself | `DEVDECK_SESSION_SECRET` differs between deployments, or cookies are blocked | Use one secret for the environment; allow cookies for the domain |
| "Too many sign-in attempts" | Five wrong passwords from one IP in 15 minutes | Wait it out. The limit is per server instance |
| "Vercel denied access" | Invalid token, or projects live under a team | Regenerate the token, or set `VERCEL_TEAM_ID` |
| Empty project list | Token scoped to a personal account while projects are on a team | Set `VERCEL_TEAM_ID` |
| Commit fails with a conflict | File changed on GitHub since it was loaded | Reload the file and reapply. This is the safety check working |
| OG image doesn't render when shared | `NEXT_PUBLIC_SITE_URL` unset or wrong | Set it to the canonical URL and redeploy |
| Build fails | Node version too old | Use Node 20.9+ |
