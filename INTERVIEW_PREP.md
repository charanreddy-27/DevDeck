# DevDeck — interview prep

Rehearsal material. Read §1 and §2 out loud until they're yours, then skim §4 before the call.

---

## 1. The 30-second elevator pitch

> DevDeck is a dashboard for everything I've deployed on Vercel. I ship a lot of small projects,
> and I kept hitting the same problem — someone asks for a link, and I don't actually know if it
> still works. Vercel's dashboard is great for one project; it's not built for "how are all of
> them?"
>
> So DevDeck shows every project with a live status, and gives you the three things you reach for
> when the status is bad: the build log, a redeploy button, and an editor that commits a fix
> straight to GitHub. Next.js 14, no database, everything proxied through route handlers so the
> browser never touches a token.

Land on the last clause. It's the part that says "I think about security boundaries."

## 2. The two-minute walkthrough

**Open with the problem (~20s).**
> I ship a lot of small projects — all on Vercel, all wired to GitHub repos. The problem is
> drift. Months later I can't tell you which ones are still healthy without opening a dozen tabs.
> DevDeck answers that in one screen.

**Then the shape (~30s).**
> It's Next.js 14, App Router, JavaScript. Three pages and seven route handlers. No database —
> everything's a live read of the Vercel and GitHub REST APIs. The important structural decision
> is that every external call goes through a route handler. The browser only ever talks to my
> app. That kills CORS, keeps tokens out of the client bundle entirely, and gives me one place to
> normalise two APIs that disagree about everything.

**Then the feature that's actually clever (~40s).**
> The part I like most is the edit-to-deploy flow. You browse the repo file tree, edit a file,
> write a commit message, and hit commit. It goes to GitHub through the Contents API — and that's
> it. Vercel's git integration already rebuilds on push, so the commit *is* the deploy. I didn't
> have to build a deployment pipeline; I just had to notice one already existed.
>
> The safety comes from the blob SHA. I keep the SHA from when the file was read, and send it
> back on write. If anything changed in between, GitHub rejects it with a 409 and I tell the user
> to reload. It never force-overwrites.

**Then a real bug (~30s).**
> Build logs were the hard part. The events endpoint returns a JSON array when a deployment's
> finished, but newline-delimited JSON while it's still building — so the parser handles both.
> And the text is full of ANSI colour codes. My first strip regex wasn't anchored to the escape
> character, so it also matched the bracket in an ordinary line like `branch [main] is up to
> date` and rendered it as `branch ain] is up to date`. Took me an afternoon. There's a test
> pinning that exact string now.

**Close (~10s).**
> 34 tests over the parsing and normalising, zero test dependencies — `node:test`. And the whole
> thing is deliberately narrow: it doesn't manage infrastructure or replace Vercel. It answers
> one question fast.

## 3. STAR stories

### STAR 1 — The error contract (system design)

**Situation.** DevDeck talks to two REST APIs that disagree about almost everything — field names,
casing, pagination, and especially how they report failure. Early on, error handling was scattered:
each component pattern-matched on HTTP status codes and message strings.

**Task.** Make failures actionable rather than decorative. A user whose token is wrong should be
told how to fix it, not shown a 403.

**Action.** I defined one error envelope — `{ code, message, hint, service }` — and put a mapper
in each API client that translates upstream failures into it. The UI branches on `code` only,
never message text. `missing_token` and `bad_token` render the full setup guide; everything else
renders an inline banner with the hint attached. I also added a `scrub()` pass that strips any
configured token out of a message before it can reach a response or a log line, because upstream
APIs sometimes echo request context back.

**Result.** Error handling became a solved problem instead of a recurring one. Adding a third
provider now means writing one mapper and touching no UI. And the most common first-run failure —
a bad token — leads the user straight into instructions instead of a dead end.

*If they push:* the scrub ignores values under 7 characters, so a short `VERCEL_TEAM_ID` can't
start mangling ordinary text.

---

### STAR 2 — The 403 that should have been a 401 (debugging / rigour)

**Situation.** The whole first-run experience depends on detecting a bad token. I'd wired the
setup guide to `missing_token` and `bad_token`, mapping 401 to the latter — which is what the
documentation implies.

**Task.** Verify the path actually worked, rather than assuming it did.

**Action.** I put a deliberately invalid token in `.env.local` and pointed it at the live API to
see exactly what came back. Vercel answers **403 "Not authorized"** for an invalid token — not
401. My mapper was sending that to a generic `forbidden` banner suggesting the user set
`VERCEL_TEAM_ID`. So the single most common failure mode would have shown a misleading message and
never surfaced the setup guide. I remapped 403 to `bad_token` with a hint covering both real
causes — invalid token *or* wrong scope — since both are fixed in the same file.

**Result.** The failure that most first-time users will hit now lands them on the instructions
that fix it. The wider lesson: an API's error contract is a claim until you've tested it. I now
test error paths the same way I test happy paths.

---

### STAR 3 — Live tailing without stealing the scroll (product judgement)

**Situation.** Watching a build finish is the core use case. The first version fetched the log
once when you expanded a deployment, so during an active build it was stale the second it loaded.

**Task.** Make the log follow a running build without making it unreadable.

**Action.** I added a 5-second poll that runs only while the deployment is `BUILDING` or `QUEUED`,
and only while the browser tab is visible. But naive auto-scroll makes it worse: you scroll up to
read the error that just flew past, and five seconds later you're yanked back to the bottom. So
the viewer tracks whether the reader is within 48px of the bottom, and auto-scrolls only if they
are. Scroll up and it stops following; a "Jump to end" button re-pins it.

**Result.** The log follows the build when you want it to and holds still when you're reading. It
was maybe fifteen lines of code, and it's the difference between a feature people use and a
feature people fight.

*The point to make:* the hard part wasn't polling. It was noticing that the obvious implementation
would be actively annoying.

## 4. Likely technical Q&A

**"Why no database?"**
> The APIs are the source of truth. Any cache I add is a second, wronger copy of that — plus
> invalidation logic, plus a migration story, for a tool with one user. Rate limits are generous
> enough that live reads are fine. If it ever ran for a team I'd add a short-TTL response cache,
> not a database.

**"Why proxy everything instead of calling the APIs from the browser?"**
> Three reasons, and only one of them is CORS. A token in client-side code is in the bundle and
> in devtools — that's the real one. And proxying lets me trim a large, inconsistent payload down
> to the dozen fields the UI needs, so the client stays small. The cost is one hop of latency.

**"How do you stop concurrent edits from clobbering each other?"**
> Optimistic concurrency, via GitHub's own mechanism. I keep the blob SHA from when the file was
> read and send it back on write. If the file changed in between, GitHub rejects the write with a
> 409, and I surface that as a `conflict` error telling the user to reload and reapply. I never
> retry a write with a fresh SHA — that would be silently overwriting someone.

**"Walk me through what happens when I click Commit & Deploy."**
> Client PUTs to my route handler with owner, repo, path, branch, message, content and SHA. The
> handler base64-encodes the text server-side — the client never deals with encoding — and calls
> the GitHub Contents API. GitHub creates the commit. Vercel's git integration sees the push and
> starts a build on its own. The deployments list refetches and the new build shows up. Nothing
> in my code triggers the deploy; I'm using a pipeline that already exists.

**"Why JavaScript and not TypeScript?"**
> Honest answer: the app is a thin layer over two REST APIs, and the payloads are external — types
> would describe what I *hope* comes back, not what does. The real validation happens in the
> normalisers at the boundary, and those are unit-tested. On a larger codebase, or one with more
> than one contributor, I'd take TypeScript.

**"How would you scale this to a team?"**
> Three things change. Auth becomes mandatory — right now anyone who reaches a deployed instance
> can redeploy your projects and commit to your repos, which is why it's a local tool and why
> that's in bold in the deployment doc. Second, polling becomes webhooks, because N users polling
> every 30 seconds hits rate limits fast. Third, I'd add a short-TTL shared cache so one user's
> refresh serves everyone's.

**"What's the weakest part of the code?"**
> The production-URL heuristic. A deployment's `alias` array holds every domain pointing at it,
> and I pick the shortest as canonical, because `my-site.com` beats
> `my-site-git-main-acme.vercel.app`. That's right almost always and wrong for someone with a
> genuinely short preview alias. It's documented as a heuristic. The proper fix is reading the
> project's configured production domain.

**"How do you know the tokens aren't leaking?"**
> Two checks. No client component imports the API clients — that's grep-able and it's clean. And
> I scanned the built output and served HTML for the token strings after running with real values
> in env; nothing. Plus `scrub()` removes them from error messages before those become responses
> or logs.

**"What did you test, and what didn't you?"**
> 34 unit tests over the pure logic — normalising, formatting, encoding, log parsing, scrubbing.
> Error paths were exercised over HTTP against both dev and production servers. What I didn't
> test end-to-end is the authenticated round-trip against real accounts, because that needs live
> tokens. I'd rather say that than imply coverage I don't have.

## 5. What I'd improve next

1. **Deployment protection.** As built, a public instance is a remote control for my entire
   Vercel account. That's the first thing I'd fix before it's anything other than local.
2. **Multi-file commits** through the Git Trees API — the current single-file limit means you
   can't do a real refactor.
3. **A diff view.** You see the file you're editing, not what changed. That's the wrong thing to
   look at before you commit.
4. **Webhooks over polling**, the moment more than one person uses it.
5. **Retry with backoff** on rate-limit responses instead of just telling the user to wait.

## 6. Questions to ask them

- What does your deploy pipeline look like today — and where does it hurt? *(Shows I think about
  the boring parts.)*
- When something breaks in production, how does the person who has to fix it find out?
- How much of your team's tooling is bought vs. built, and how do you decide?
- What's a piece of internal tooling here that everyone quietly relies on?
- What does the first 90 days look like for someone in this role?
- What would make you say, a year from now, that hiring for this role went well?

## 7. Traps to avoid

- **Don't oversell the scale.** It's a well-built single-user tool. Calling it a platform invites
  questions it can't survive. The craft is the story, not the scale.
- **Don't claim metrics you don't have.** No user counts, no "reduced deploy time by X%". The
  interesting parts are the decisions.
- **Do volunteer the security limitation.** Saying "this can't be public without auth, and here's
  why" reads as judgement. Being caught not knowing it reads as the opposite.
- **Don't say "it was easy."** The log parser wasn't. Say so — the debugging story is better
  material than the feature list.
