# Incident Response

## Severity examples

### Critical
- cross-tenant data exposure;
- credential compromise;
- widespread message corruption/loss;
- authentication bypass.

### High
- WhatsApp sending/receiving unavailable for many tenants;
- database integrity risk;
- large queue backlog with service impact.

## Immediate priorities

1. Contain security/data-integrity impact.
2. Preserve evidence/logs.
3. Stop harmful retries/side effects if necessary.
4. Restore safe service.
5. Identify affected tenants/events.
6. Perform root-cause analysis.
7. Add regression prevention.

Security incidents must never be hidden by deleting audit evidence.
