# Testing Standards

## Test layers

### Unit
Pure domain/application logic.

### Integration
Database repositories, transactions, NATS behavior where practical, provider adapter boundaries.

### API
Request validation, authentication, authorization, response contracts.

### Security
Cross-tenant access, privilege escalation, webhook authenticity, duplicate delivery.

### End-to-end
Critical customer journeys after the necessary phases exist.

## Mandatory rules

- Tests must be deterministic.
- No production credentials.
- External providers mocked or isolated in automated tests.
- Tenant isolation receives explicit adversarial tests.
- Bugs affecting security/data integrity require regression tests.
