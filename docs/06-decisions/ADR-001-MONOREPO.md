# ADR-001 — Monorepo

Status: Accepted

## Context
SlotlyFlow has multiple deployable applications and shared contracts. Early separate repositories would increase coordination and contract drift.

## Decision
Use a pnpm/Turborepo monorepo.

## Consequences
- Shared types/contracts can be versioned atomically.
- CI can target affected packages.
- Deployables remain independently scalable.
- Repository discipline is required to avoid circular coupling.
