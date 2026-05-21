# Pattern · qb-realtime-manager · single-channel, many-consumers Realtime

**Origin:** chapter 2, step 9C (`js/qb-realtime-manager.js`).
**Validated at:** chapter 2, step 11C (three consumers · bell + Phase view + archive · all refreshed from one notification INSERT in <1s).

A shared Supabase Realtime client + state machine that any number of UI consumers subscribe to. The first consumer's `start()` mounts the singleton; later consumers just register handlers. The chapter-2 surfaces use this pattern to keep one WebSocket open instead of one-per-surface.

## When to use

- Two or more UI surfaces need to react to the same Supabase Realtime stream (typically `notifications`-table INSERT/UPDATE).
- Each surface has its own refresh logic but shares the same connection-state lifecycle.
- The poll-fallback (no WebSocket available) is acceptable for all consumers at the same cadence.

## When NOT to use

- A consumer needs a different table or filter from the rest. (The manager is one channel; multi-channel would be a different abstraction.)
- The consumer is server-side. The manager is a browser-side singleton tied to `window.QB`.

## API (verbatim from `js/qb-realtime-manager.js`)

```js
window.QBRealtimeManager = {
  start({ authToken }),            // idempotent · mounts the singleton on first call
  stop(),                          // cleanup · removes channel + clears subscribers
  onNotification(cb),              // cb gets { event, row, oldRow } on each INSERT/UPDATE
  onState(cb),                     // cb gets 'realtime' or 'poll' on transition
  setToken(newToken),              // auth-refresh path
  getState() → 'realtime' | 'poll' | null,
  getUserId() → uuid | null,
};
```

`onNotification` and `onState` both return an unsubscribe function. Consumers MUST call it on teardown.

## State machine

```
                ┌─── SUBSCRIBED ───┐
                ▼                  │
            'realtime' ◄───────────┘ (reconnect)
                │
                │ SUBSCRIBED grace timeout (10s)
                │ OR CHANNEL_ERROR
                │ OR TIMED_OUT
                │ OR CLOSED
                ▼
              'poll' (consumer-owned poll interval, typically 30s)
```

The SUBSCRIBED grace timeout is the resilience guarantee that the manager always reaches a usable state · the Supabase SDK doesn't always surface `CHANNEL_ERROR` cleanly on blocked WebSocket upgrades (firewalls, captive portals, etc.).

## Consumer registration pattern

```js
const mgr = window.QBRealtimeManager;
if (mgr && session?.token) {
  mgr.start({ authToken: session.token });
  const unsub1 = mgr.onNotification(({ event, row, oldRow }) => {
    // react to the event · typically refetch your data + repaint
  });
  const unsub2 = mgr.onState(s => {
    if (s === 'realtime') {
      // clear any local poll interval
    } else if (s === 'poll') {
      // start a local poll interval at your cadence
    }
  });
  // on teardown:
  // unsub1(); unsub2();
}
```

## Gotchas

- **Idempotent start, single-stop.** The manager is a singleton. `start()` is idempotent (safe to call from each consumer). `stop()` is NOT consumer-scoped · it kills the channel for everyone. Don't call `stop()` from a single consumer's teardown · let the page unload do it.
- **Auth refresh.** When the JWT refreshes (qb-cloud's `refreshAccessToken`), call `mgr.setToken(newToken)` so Realtime's RLS context updates. Without this, the channel keeps the stale token until reconnect.
- **Poll cadence is consumer-owned.** The manager tells consumers WHEN to switch between realtime and poll, but doesn't run the poll. Each consumer owns its own poll interval (typical: 30s · matches the bell).
- **Notification filter is shared.** All consumers receive every INSERT/UPDATE event on `notifications` filtered by `user_id`. Consumers must filter further by `kind` if they only care about specific event types (e.g., `chain_ready` for archive vs `dispatch_failed` for bell).

## Why the singleton

- One WebSocket per browser, not one per surface · matters on mobile (battery, connection-count limits).
- One state machine transition path · poll-fallback decision is unified.
- One auth surface · token rotation lives in one place.

## Origin context

Step 9C extracted this from the bell (step 7C) when it became obvious that the bell pattern would need to repeat for every Realtime-aware surface. Extracting it once · adding consumers in one line each · proved out across step 9 (Phase view), step 11 (archive). Step 13's E2E harness confirms all three consumers refresh from a single notification INSERT in <5s.
