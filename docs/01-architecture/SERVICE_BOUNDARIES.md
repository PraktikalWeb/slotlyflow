# Service and Module Boundaries

## Core API modules

- auth
- organizations
- memberships
- users
- whatsapp
- contacts
- conversations
- inbox
- automation
- handoff
- business-knowledge
- templates
- billing
- usage
- analytics
- notifications
- integrations
- admin
- audit

## Boundary rules

- Modules expose application services/contracts, not internal persistence details.
- Cross-module writes should use documented application interfaces or domain events.
- Avoid circular dependencies.
- Meta-specific payloads/types remain inside provider/integration packages.
- UI consumes API contracts, not database types.
- Database schemas are not public API contracts.
- Event contracts live in a shared contracts package and documentation.

## Extraction rule

A module becomes a separately deployed service only when at least one of these is true:
- materially different scaling profile;
- isolation/reliability requirement;
- independent release cadence is necessary;
- security boundary benefits from isolation;
- operational evidence demonstrates contention.

Do not extract merely for architectural aesthetics.
