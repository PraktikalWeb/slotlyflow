# ADR-003 — NATS JetStream

Status: Accepted

## Decision
Use NATS JetStream for durable asynchronous event/message transport.

## Reasons
- open-source;
- portable;
- durable streams/consumers;
- horizontal worker scaling;
- simpler operational profile than Kafka for current requirements.

## Consequence
All consumers must assume at-least-once delivery and be idempotent.
