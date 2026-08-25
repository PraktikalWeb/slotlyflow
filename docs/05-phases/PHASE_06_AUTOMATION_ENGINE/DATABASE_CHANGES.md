# Database Changes — Phase 06 — Automation Engine


Introduce:
- automation_flows
- automation_versions
- automation_sessions
- optional automation_session_events/history if required for audit/debugging
- scheduled automation work representation if not safely handled entirely by queue semantics

Published version definition must be immutable.


## Global rules

Follow `docs/02-standards/DATABASE_STANDARDS.md` and `docs/01-architecture/MULTI_TENANCY.md`.
