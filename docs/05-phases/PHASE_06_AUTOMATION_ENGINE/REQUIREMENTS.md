# Requirements — Phase 06 — Automation Engine


- AutomationFlow.
- Immutable published AutomationVersion.
- Draft/publish/archive lifecycle.
- Durable AutomationSession.
- Trigger evaluation.
- Supported step types:
  - send text;
  - choice/menu;
  - collect input;
  - set variable;
  - condition/branch;
  - operating-hours condition;
  - fallback;
  - timeout/scheduled continuation;
  - end.
- Deterministic engine input/output model.
- Engine produces actions; infrastructure executes them.
- Session survives restart/deploy.
- Existing session version semantics are explicit.
