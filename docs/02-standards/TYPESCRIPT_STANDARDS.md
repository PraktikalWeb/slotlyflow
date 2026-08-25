# TypeScript Standards

- Enable strict TypeScript.
- Avoid `any`.
- Prefer `unknown` at untrusted boundaries and validate/narrow.
- Domain identifiers should use explicit types or branded/value-object patterns where useful.
- API DTOs and domain entities are distinct concepts.
- Do not export persistence row types as public API models.
- Exhaustively handle discriminated unions for state machines/actions.
- Prefer immutable values in domain logic where practical.
- No non-null assertion for untrusted/external data.
- Async operations must surface failures explicitly.
