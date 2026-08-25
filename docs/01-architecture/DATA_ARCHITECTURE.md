# Data Architecture

## Source of truth

PostgreSQL is authoritative for durable transactional business state.

## Identifier strategy

- Use UUID-compatible globally unique identifiers.
- IDs are opaque to clients.
- Provider identifiers are stored separately from internal IDs.

## Tenant ownership

Tenant-owned records include or derive an immutable `organization_id`.

Common high-volume tables should generally include `organization_id` directly to simplify authorization/indexing.

## Initial core entities

- users
- organizations
- organization_members
- sessions
- audit_logs
- whatsapp_accounts
- whatsapp_phone_numbers
- provider_credentials
- contacts
- conversations
- messages
- message_status_events
- automation_flows
- automation_versions
- automation_sessions
- handoffs
- agent_assignments
- business_profiles
- knowledge_items
- subscriptions
- usage_records
- outbox_events
- webhook_receipts

## Timestamps

Use timezone-aware UTC storage for system timestamps.

## Soft deletion

Do not apply generic soft-delete to every table.

Use explicit lifecycle fields where business/audit requirements justify retention. Deletion policy must be documented per entity.

## High-volume message data

Schema/index design must anticipate large message volumes.

Primary access paths:
- organization + conversation;
- organization + time;
- provider message ID;
- status lookup;
- unread/query projections.

Partitioning is not required in Phase 1 but the schema must not prevent later PostgreSQL native partitioning.

## Migrations

- All schema changes use migrations.
- Migrations must be reproducible on a clean database.
- Destructive changes require explicit migration/rollback strategy.
