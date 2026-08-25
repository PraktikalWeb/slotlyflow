# Event Architecture

## Transport

NATS JetStream.

## Event naming

Use:

`<domain>.<entity-or-action>.<past-tense-event>.v<major>`

Examples:
- `whatsapp.message.received.v1`
- `conversation.created.v1`
- `conversation.updated.v1`
- `automation.session.started.v1`
- `handoff.requested.v1`
- `message.outbound.requested.v1`
- `message.sent.v1`
- `message.delivered.v1`
- `message.failed.v1`

## Required envelope fields

Every domain/integration event must include:

- `event_id`
- `event_type`
- `event_version`
- `occurred_at`
- `correlation_id`
- `causation_id` when applicable
- `organization_id` for tenant-scoped events
- typed `payload`

## Delivery

Assume at-least-once delivery.

Consumers therefore must be idempotent.

## Ordering

Do not assume global ordering.

Where ordering is required, define the exact scope and persistence strategy.

## Reliable publication

When a database state change and emitted event must remain consistent, write an outbox record in the same PostgreSQL transaction and publish asynchronously.

## Retry

Every consumer must define:
- transient failure policy;
- retry count/backoff;
- non-retryable failure rules;
- dead-letter or terminal failure handling;
- alerting/observability.

## Schema evolution

Breaking payload changes require a new major event version.
