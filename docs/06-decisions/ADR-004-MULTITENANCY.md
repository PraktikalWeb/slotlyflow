# ADR-004 — Multi-Tenancy

Status: Accepted

## Decision
Use Organization as the tenant boundary with explicit `organization_id` scoping and defense-in-depth authorization.

## Consequence
Every tenant-owned operation must resolve verified organization context.
