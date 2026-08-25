# Logging Standards

Use structured logs.

Required fields where applicable:
- service;
- environment;
- timestamp;
- level;
- correlation_id;
- request_id / event_id / job_id;
- organization_id;
- error_code.

Never log:
- passwords;
- password hashes;
- session tokens;
- reset tokens;
- Meta access tokens;
- secret-store plaintext;
- encryption keys;
- authorization headers;
- cookies containing authentication material.

Avoid logging full customer message bodies by default.
