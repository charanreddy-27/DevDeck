/**
 * Where demo writes go: an in-memory, module-level list. On serverless that
 * means per-instance — a commit made on one warm instance is invisible to
 * another — which is fine for a demo and impossible to abuse: nothing is
 * persisted, and the list is capped so a busy public demo can't grow memory.
 */

export const MAX_WRITES = 50;

// How a simulated deployment progresses after a write. ~45s end to end, so a
// visitor sees QUEUED → BUILDING → READY without waiting long.
export const SIM_TOTAL_MS = 45000;
export const SIM_QUEUE_AFTER_COMMIT_MS = 1000;
export const SIM_QUEUE_AFTER_REDEPLOY_MS = 5000;

export function createStore({ maxWrites = MAX_WRITES } = {}) {
  const writes = [];
  let seq = 0;

  return {
    /** Appends a write (oldest first) and drops the oldest past the cap. */
    record(write) {
      seq += 1;
      const entry = { ...write, seq };
      writes.push(entry);
      while (writes.length > maxWrites) writes.shift();
      return entry;
    },
    all() {
      return writes;
    },
    get size() {
      return writes.length;
    },
    clear() {
      writes.length = 0;
    },
  };
}

/** The process-wide store every demo request shares. */
export const defaultStore = createStore();
