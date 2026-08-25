# Security Requirements — Phase 02 — WhatsApp Connection


- Only OWNER/ADMIN with `whatsapp.manage` can connect/disconnect.
- OAuth/signup state/nonce is verified.
- Credentials encrypted at rest.
- Credentials never logged or returned in normal API payloads.
- Callback redirect targets are allow-listed.
- Connection actions are audited.
- Cross-tenant phone/account IDs cannot be accessed.


## Gate

A security requirement is not optional merely because functional tests pass.
