# Webhooks

## Endpoint goals

Provider webhooks must be:
- authenticated/verified;
- fast to acknowledge;
- schema validated;
- deduplicated;
- observable;
- safely retryable.

## Request lifecycle

1. Receive request.
2. Enforce request size and basic transport constraints.
3. Verify provider authenticity/signature.
4. Parse and validate.
5. Resolve provider account/phone to organization where possible.
6. Record deduplication receipt.
7. Normalize/enqueue event.
8. Return provider-appropriate acknowledgement.

Long-running automation, AI, analytics, or outbound messaging must not execute synchronously in the webhook request.

## Duplicate handling

Provider event/message identifiers must be persisted in a way that safely prevents duplicate side effects.
