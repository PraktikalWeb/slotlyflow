# Security Requirements — Phase 04 — Contacts and Conversations


- Every query is organization-scoped.
- Contact phone/customer data must not cross tenants.
- Message content not exposed through logs.
- Cross-tenant IDs return non-disclosing 404.
- Pagination cursors cannot be used to escape tenant scope.


## Gate

A security requirement is not optional merely because functional tests pass.
