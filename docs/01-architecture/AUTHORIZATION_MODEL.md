# Authorization Model

## Approach

RBAC at organization scope with deny-by-default enforcement.

## Initial roles

- OWNER
- ADMIN
- AGENT

## Permission naming

Use capability-oriented permissions, for example:

- `organization.read`
- `organization.update`
- `membership.read`
- `membership.invite`
- `membership.update_role`
- `membership.remove`
- `billing.read`
- `billing.manage`
- `whatsapp.read`
- `whatsapp.manage`
- `automation.read`
- `automation.edit`
- `automation.publish`
- `conversation.read`
- `conversation.reply`
- `handoff.accept`
- `handoff.complete`
- `analytics.read`

## Rules

- Role names must not be scattered in feature logic when a permission check can be used.
- OWNER protection rules are explicit.
- A user cannot grant permissions above their authority.
- Role changes are audited.
- Authorization is checked server-side at the operation boundary.
