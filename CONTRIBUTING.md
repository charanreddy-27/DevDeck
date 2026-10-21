# Contributing / extending DevDeck

Mostly notes to my future self, but they apply to anyone extending this.

## Ground rules

1. **Tokens never leave the server.** If a client component needs data from Vercel or GitHub, it
   goes through a route handler. No exceptions — this is the one architectural rule. CI builds
   with canary tokens and fails if either shows up in the client output.
2. **Route handlers read through `lib/source`, never a client directly.** `getSource(request)`
   returns the live or the demo provider; both implement `SOURCE_METHODS`. A new capability means
   a method on both, or the demo stops being a faithful stand-in.
3. **Every route returns the error envelope.** `{ error: { code, message, hint, service } }` via
   `errorResponse()`. The UI branches on `code`, never on message text.
4. **Normalise at the boundary.** Route handlers return the shape the UI renders, not the shape
   the upstream API happens to send. Components should never see `readyState`.
5. **No new dependencies without a reason you'd defend out loud.** The app currently has three:
   `next`, `react`, `react-dom`.

## Adding a route handler

```js
import { getSource } from '@/lib/source';
import { respond, respondError } from '@/lib/source/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';   // required — keeps it out of the build-time render

export async function GET(request) {
  const source = getSource(request);      // live or demo, decided per request
  try {
    // validate params, call source.someMethod(), return the shape the UI renders
    return respond(source, { ...data });
  } catch (error) {
    return respondError(source, error);
  }
}
```

The password gate in `proxy.js` covers new routes automatically. Only add a path to
`PUBLIC_EXACT` in `lib/auth/gate.js` if it must work signed out, and say why in the commit.

`force-dynamic` matters: without it Next may try to evaluate the route during `next build`, which
fails when no tokens are configured.

## Adding to the UI

- Use the existing primitives — `.panel`, `.pill`, `.badge`, `.btn`, `.link-chip`, `.input`.
  There is one design system; don't start a second.
- Colours come from the custom properties in `app/globals.css`. No hard-coded hex in components.
- Every interactive element needs a visible `:focus-visible` state. The global rule handles most
  of it — don't override it away.
- Anything that fetches needs three states: loading (skeleton), empty, and error.
- Check both themes (`t` toggles) and a 320px-wide window before calling it done.
- Load data in an effect as a promise chain, `fetchJson(url).then(onData, onError)`, and reset
  loading/error state in the event handler that starts a retry. The React Compiler's
  `set-state-in-effect` rule rejects synchronous `setState` in an effect body, and lint runs it.
- Global keyboard shortcuts belong to the one handler in `components/CommandPalette.js`. Add the
  key there and to its `SHORTCUTS` list, so `?` shows it.

## Tests

```bash
npm test         # node:test, no network, no tokens
npm run lint     # ESLint 9 flat config + eslint-config-next
npm run build && npm run smoke   # production build, then demo + password gate end to end
```

CI runs all of these on Node 20 and 22 for every push.

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
