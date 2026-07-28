# Contributing / extending DevDeck

Mostly notes to my future self, but they apply to anyone extending this.

## Ground rules

1. **Tokens never leave the server.** If a client component needs data from Vercel or GitHub, it
   goes through a route handler. No exceptions — this is the one architectural rule.
2. **Every route returns the error envelope.** `{ error: { code, message, hint, service } }` via
   `errorResponse()`. The UI branches on `code`, never on message text.
3. **Normalise at the boundary.** Route handlers return the shape the UI renders, not the shape
   the upstream API happens to send. Components should never see `readyState`.
4. **No new dependencies without a reason you'd defend out loud.** The app currently has three:
   `next`, `react`, `react-dom`.

## Adding a route handler

```js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';   // required — keeps it out of the build-time render

export async function GET(request) {
  try {
    // validate params, call the client, normalise, return
  } catch (error) {
    return errorResponse(error);
  }
}
```

`force-dynamic` matters: without it Next may try to evaluate the route during `next build`, which
fails when no tokens are configured.

## Adding to the UI

- Use the existing primitives — `.panel`, `.pill`, `.badge`, `.btn`, `.link-chip`, `.input`.
  There is one design system; don't start a second.
- Colours come from the custom properties in `app/globals.css`. No hard-coded hex in components.
- Every interactive element needs a visible `:focus-visible` state. The global rule handles most
  of it — don't override it away.
- Anything that fetches needs three states: loading (skeleton), empty, and error.

## Tests

```bash
npm test
```

Pure logic goes in `lib/` and gets a test in `tests/*.test.mjs`. If you find yourself wanting to
test something inside a route handler or component, that's a sign the logic should move to `lib/`
— which is exactly how `lib/logs.js` came to exist.

`lib/package.json` marks that folder as ESM so `node --test` can import it directly. Leave it
there.

## Style

- No semicolon-free experiments; match what's there.
- Comments explain *why*, not *what*. If a line needs a comment to explain what it does, rewrite
  the line.
- Commit messages: imperative mood, one line, no ceremony.
