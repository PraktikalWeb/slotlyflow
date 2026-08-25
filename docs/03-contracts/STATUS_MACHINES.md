# Status Machines

## Handoff

Allowed states:

- `AUTOMATED`
- `HANDOFF_REQUESTED`
- `WAITING_FOR_AGENT`
- `AGENT_ACTIVE`
- `COMPLETED`

Primary transitions:

`AUTOMATED -> HANDOFF_REQUESTED`  
`HANDOFF_REQUESTED -> WAITING_FOR_AGENT`  
`WAITING_FOR_AGENT -> AGENT_ACTIVE`  
`AGENT_ACTIVE -> COMPLETED`  
`COMPLETED -> AUTOMATED` when resume policy permits.

Invalid direct transitions must be rejected.

## Message

Planned outbound lifecycle:

`QUEUED -> SENDING -> SENT -> DELIVERED -> READ`

Failure may occur from appropriate pre-terminal states:

`QUEUED/SENDING/SENT -> FAILED`

Provider status ordering anomalies must not regress a terminal/more-advanced state without an explicit reconciliation rule.

## Automation version

- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

Published versions are immutable.

## WhatsApp connection

Planned conceptual states:
- `NOT_CONNECTED`
- `CONNECTING`
- `CONNECTED`
- `DEGRADED`
- `DISCONNECTED`

Provider-specific sub-statuses remain adapter metadata unless product behavior requires promotion to domain state.
