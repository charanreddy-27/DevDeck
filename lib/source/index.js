/**
 * The single entry point route handlers use for data:
 *
 *   const source = getSource(request);
 *   const { projects } = await source.listProjects();
 *
 * Both providers implement the same interface (see SOURCE_METHODS in
 * shared.js), so no route handler knows or cares whether the data is real.
 */
import { createDemoSource } from './demo/index.js';
import { createLiveSource } from './live.js';
import { modeForRequest } from './mode.js';

export { DEMO_COOKIE, hasAnyToken, isDemoForced, modeForRequest, resolveMode } from './mode.js';
export { SOURCE_METHODS } from './shared.js';

// Both providers are stateless apart from the demo's in-memory write store,
// which lives at module level inside the demo package — so one instance each
// is enough.
let live = null;
let demo = null;

/**
 * @param {Request} request  read for the demo cookie only
 * @param {{ env?: object }} [options]  env is injectable so the mode matrix is testable
 */
export function getSource(request, { env = process.env } = {}) {
  const { mode } = modeForRequest(request, env);
  if (mode === 'demo') {
    demo ||= createDemoSource();
    return demo;
  }
  live ||= createLiveSource();
  return live;
}
