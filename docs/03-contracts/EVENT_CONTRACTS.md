# Event Contracts

## Global envelope

```ts
type EventEnvelope<T> = {
  event_id: string;
  event_type: string;
  event_version: number;
  occurred_at: string;
  correlation_id: string;
  causation_id?: string;
  organization_id?: string;
  payload: T;
};
```

## Planned events

### Messaging
- `whatsapp.message.received.v1`
- `message.outbound.requested.v1`
- `message.sent.v1`
- `message.delivered.v1`
- `message.read.v1`
- `message.failed.v1`

### Conversation
- `conversation.created.v1`
- `conversation.updated.v1`

### Automation
- `automation.session.started.v1`
- `automation.step.executed.v1`
- `automation.session.completed.v1`
- `automation.session.failed.v1`

### Handover
- `handoff.requested.v1`
- `handoff.waiting.v1`
- `handoff.accepted.v1`
- `handoff.completed.v1`
- `automation.paused.v1`
- `automation.resumed.v1`

Event payloads must be finalized by the phase introducing them before implementation.
