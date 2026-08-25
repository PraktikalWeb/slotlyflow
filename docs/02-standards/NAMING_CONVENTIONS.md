# Naming Conventions

## Domain
PascalCase: `Organization`, `Conversation`, `AutomationSession`.

## Database
snake_case plural tables: `organization_members`, `automation_sessions`.

## TypeScript
- files: kebab-case unless framework conventions require otherwise;
- variables/functions: camelCase;
- classes/types/interfaces: PascalCase;
- constants: UPPER_SNAKE_CASE for true constants.

## Events
dot-separated versioned names:
`whatsapp.message.received.v1`

## HTTP
plural resource nouns where resource-oriented routes are used.

## Terminology
Use canonical vocabulary from `docs/00-product/GLOSSARY.md`.
