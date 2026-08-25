# Meta WhatsApp Integration

## Boundary

Meta WhatsApp Cloud API is an external provider behind SlotlyFlow messaging abstractions.

Core domain logic must not depend on raw Meta request/response types.

## Responsibilities of Meta adapter

- connection/onboarding integration;
- normalize inbound provider payloads;
- send supported outbound messages;
- map provider message IDs;
- map provider status events;
- classify provider errors;
- expose safe connection-health metadata.

## Responsibilities outside adapter

- conversations;
- contacts;
- automation decisions;
- handoff;
- billing;
- tenant authorization;
- product-facing state labels.

## Credentials

Provider credentials are encrypted and never returned through ordinary frontend APIs.

## Provider evolution

Meta API version changes should be isolated primarily to the adapter and contract translation layer.
