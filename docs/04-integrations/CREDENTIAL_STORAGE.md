# Credential Storage

## Goal

Provider credentials must remain confidential if application data is exposed or logs are inspected.

## Abstraction

Define a credential/secret storage interface rather than binding domain code to one cloud KMS.

Conceptual capabilities:
- encrypt/store;
- retrieve/decrypt for authorized server-side use;
- rotate/version;
- revoke/delete;
- audit access where supported.

## Rules

- No plaintext provider tokens in client responses.
- No secrets in logs.
- No secrets committed to repository.
- No coding-agent generated environment values.
- Production master encryption material must be external to the application database.
