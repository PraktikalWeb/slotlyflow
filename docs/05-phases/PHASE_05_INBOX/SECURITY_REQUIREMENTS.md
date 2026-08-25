# Security Requirements — Phase 05 — Realtime Team Inbox


- Authenticate realtime connections.
- Authorize organization channel subscriptions.
- Re-check send permission server-side.
- Prevent client subscription to arbitrary foreign organization IDs.
- Rate-limit abusive sends.
- Do not put provider credentials in realtime payloads.


## Gate

A security requirement is not optional merely because functional tests pass.
