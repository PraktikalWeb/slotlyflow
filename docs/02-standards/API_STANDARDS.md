# API Standards

## Versioning

Public application API begins under `/v1`.

## Format

JSON unless endpoint explicitly uses another representation.

## Validation

Validate:
- params;
- query;
- body;
- relevant headers.

## Errors

Use stable machine-readable error codes plus safe human-readable messages.

Never expose stack traces or sensitive provider payloads.

## Authorization behavior

For cross-tenant resource IDs, default behavior is **404 Not Found** to reduce resource enumeration unless a specific endpoint requires otherwise.

## Pagination

High-volume list endpoints use cursor-based pagination unless a documented reason justifies offset pagination.

## Idempotency

State-changing operations exposed to retry-prone clients/providers must define idempotency behavior.

## Correlation

Accept/generate a request/correlation ID and include it in logs and safe error responses.

## Time

Use ISO 8601 timestamps with timezone/UTC semantics.
