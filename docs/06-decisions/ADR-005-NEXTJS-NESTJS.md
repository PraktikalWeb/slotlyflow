# ADR-005 — Next.js Web + NestJS API

Status: Accepted

## Decision
Use Next.js for the web platform and a separate NestJS/Fastify backend for core API/business execution.

## Reasons
- web UI and backend can scale independently;
- long-running/event-driven backend work is not tied to Next.js runtime;
- clearer application/domain boundaries;
- future native clients can consume the same API.
