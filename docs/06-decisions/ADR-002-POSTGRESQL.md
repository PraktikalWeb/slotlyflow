# ADR-002 — PostgreSQL

Status: Accepted

## Decision
Use PostgreSQL as the primary transactional source of truth.

## Reasons
- mature relational integrity;
- open-source portability;
- transactional semantics;
- indexing and partitioning options;
- strong ecosystem.

## Rejected as core source of truth
Vendor-specific realtime/serverless databases and in-memory stores.
