# Provider Abstractions

Create interfaces owned by SlotlyFlow, with external implementations behind adapters.

Planned abstractions:

- `MessagingProvider`
- `ObjectStorage`
- `CredentialStore`
- `EmailProvider`
- `PaymentProvider`
- `AIProvider` when AI becomes approved scope

## Rule

Business use cases depend on the abstraction, not an AWS/Cloudflare/Meta/Stripe-specific implementation type.

Provider-specific metadata may be stored when necessary but must not define core domain semantics without an explicit decision.

For Phase 01 verification email, `EmailProvider` has the deliberately narrow responsibility of availability checking and transactional verification-email delivery. The authentication service constructs the SlotlyFlow verification URL and depends only on that boundary; SMTP/Mailpit details remain in the adapter.
