# Database Standards

- PostgreSQL.
- Drizzle ORM.
- Migrations committed to repository.
- Foreign keys enabled and intentional.
- `NOT NULL` by default unless absence has defined meaning.
- Unique constraints enforced in database when uniqueness is a business invariant.
- Use `timestamptz` for timestamps.
- Tenant-owned tables include/derive `organization_id`.
- Index known query paths.
- Avoid N+1 query patterns.
- Do not serialize important relational invariants into opaque JSON without reason.
- JSONB may be used for provider/raw payload archives or versioned flexible definitions where appropriate.
- Transactions cover multi-write invariants.
- Use an outbox row in the same transaction where reliable event publication is required.
