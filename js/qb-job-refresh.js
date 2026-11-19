// Realtime consumers share this bounded fallback. A read returns true
// only while a job is active, false when idle, or null on a failed read.
const IDLE_MS = 60_000;
const IDLE_STOP_MS = 10 * 60_000;

export function createJobRefresh({ refresh: read, initialActive = false,
  activeInterval = 30_000, document: doc = globalThis.document }) {
  let active = initialActive;
  let idleAt = active ? null : Date.now();
  let emptyReplies = 0;
  let mode = null;
  let timer = null;
  let inFlight = null;
  let destroyed = false;

  function cancel() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function expired() {
    return idleAt !== null && Date.now() - idleAt >= IDLE_STOP_MS;
  }
  function schedule() {
    cancel();
    if (destroyed || inFlight || mode !== 'poll' || doc?.hidden || expired()) return;
    const delay = active ? activeInterval
      : Math.min(IDLE_MS * 2 ** Math.max(0, emptyReplies - 2), IDLE_STOP_MS);
    const remaining = idleAt === null ? Infinity : IDLE_STOP_MS - (Date.now() - idleAt);
    timer = setTimeout(() => {
      timer = null;
      if (!expired()) run(false);
    }, Math.min(delay, remaining));
  }
  function run(fromEvent) {
    if (destroyed) return Promise.resolve();
    if (inFlight) return inFlight;
    if (fromEvent && expired()) { idleAt = Date.now(); emptyReplies = 0; }
    cancel();
    inFlight = Promise.resolve().then(read).catch(() => null).then(result => {
      if (destroyed) return;
      active = result === true;
      if (active) { idleAt = null; emptyReplies = 0; }
      else {
        // Failed reads share the idle retry budget so outages cannot
        // create an endless retry loop either.
        if (idleAt === null) idleAt = Date.now();
        emptyReplies += 1;
      }
    }).finally(() => { inFlight = null; schedule(); });
    return inFlight;
  }
  function onVisibility() { schedule(); }
  doc?.addEventListener('visibilitychange', onVisibility);
  return {
    refresh: ({ restartIdle = true } = {}) => run(restartIdle),
    setMode(next) { mode = next; schedule(); },
    destroy() {
      destroyed = true; cancel();
      doc?.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
