# Security Requirements — Phase 03 — Reliable Message Pipeline


- Reject invalid webhook authenticity/signature.
- Enforce request size/schema limits.
- Do not log raw credentials or full sensitive payloads.
- Resolve provider identity to organization using server-side mappings.
- Outbound provider credentials loaded only server-side.
- Rate/abuse controls where appropriate.
- Duplicate/replay events cannot duplicate side effects.


## Gate

A security requirement is not optional merely because functional tests pass.
