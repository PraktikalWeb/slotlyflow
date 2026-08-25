# Scaling Strategy

## Principle

Scale the bottleneck, not the entire platform.

## Stateless components

Web, API, webhook ingress, realtime gateway, and workers must support multiple replicas.

## Database

Progression:
1. correct indexing/query design;
2. connection pooling;
3. vertical capacity;
4. read replicas for appropriate read workloads;
5. partition high-volume tables;
6. archive cold data;
7. shard only when evidence requires it.

## Workers

Use NATS consumer groups to scale processing horizontally.

Potential later extraction:
- automation workers;
- outbound workers;
- analytics workers;
- notification workers.

## Realtime

Scale independently from API.

## Analytics

Initially PostgreSQL is acceptable for operational analytics.

Domain events must allow later projection into an analytical store such as ClickHouse without changing transactional domain behavior.

## Avoid premature complexity

MVP does not require:
- Kafka;
- database sharding;
- multi-region active-active;
- service mesh.
