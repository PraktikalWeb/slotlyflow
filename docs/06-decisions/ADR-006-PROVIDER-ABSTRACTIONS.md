# ADR-006 — Provider Abstractions

Status: Accepted

## Decision
External providers are accessed through SlotlyFlow-owned interfaces/adapters.

## Applies to
- messaging;
- object storage;
- credentials/secrets;
- payments;
- email;
- AI when approved.

## Consequence
Provider SDK types may exist in adapter code but must not spread through the domain.
