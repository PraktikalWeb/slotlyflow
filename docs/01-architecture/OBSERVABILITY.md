# Observability

## Goals

For a single customer message, operators should be able to trace processing across:
- webhook ingress;
- event publication;
- conversation resolution;
- automation processing;
- outbound request;
- provider response/status.

## Standards

Use OpenTelemetry-compatible instrumentation.

## Signals

### Logs
Structured logs with:
- timestamp;
- severity;
- service;
- request/job/event ID;
- correlation ID;
- organization ID where safe and useful;
- error code;
- non-sensitive metadata.

### Metrics
At minimum:
- request rates/latency/errors;
- webhook verification failures;
- queue lag;
- consumer failures/retries;
- outbound send latency/failure rate;
- database pool saturation;
- realtime connection count;
- automation execution errors.

### Traces
Trace critical distributed flows.

## Sensitive data

Do not place secrets or unnecessary message contents in telemetry.
