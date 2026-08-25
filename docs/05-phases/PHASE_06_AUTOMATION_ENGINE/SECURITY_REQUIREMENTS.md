# Security Requirements — Phase 06 — Automation Engine


- Flow definitions are validated before persistence/publish.
- No arbitrary code execution/eval.
- Expression/condition language is constrained.
- Tenant-owned flows/sessions are isolated.
- Publishing requires `automation.publish`.
- All externally triggered actions respect outbound messaging controls.
- Sensitive business/customer data is not unnecessarily embedded in logs.


## Gate

A security requirement is not optional merely because functional tests pass.
