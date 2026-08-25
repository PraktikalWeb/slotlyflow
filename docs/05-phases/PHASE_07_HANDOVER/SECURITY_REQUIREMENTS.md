# Security Requirements — Phase 07 — Human Handover


- Only eligible organization members may see/accept handoffs.
- Accept operation must be concurrency-safe.
- Cross-tenant handoff IDs cannot leak.
- Transition commands are permission checked and audited.
- Automation cannot resume while agent-active unless explicit override policy allows it.


## Gate

A security requirement is not optional merely because functional tests pass.
