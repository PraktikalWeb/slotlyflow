# User Roles

## OWNER

The organization owner.

Default permissions:
- Full organization access.
- Manage billing.
- Manage WhatsApp connection.
- Manage automations.
- Manage business profile.
- Invite/remove users.
- Change roles subject to owner-protection rules.
- View all conversations and analytics.
- Configure security-sensitive organization settings.

## ADMIN

Operational administrator.

Default permissions:
- Manage automations.
- Manage business profile.
- Manage team members except protected owner operations.
- View/manage conversations.
- Manage WhatsApp operational settings allowed by policy.
- View analytics.
- Cannot transfer ownership unless explicitly added later.

## AGENT

Conversation operator.

Default permissions:
- View conversations permitted by organization policy.
- Reply to customers.
- Accept/complete handovers.
- View necessary contact context.
- Cannot manage billing.
- Cannot manage organization security.
- Cannot connect/disconnect WhatsApp.
- Cannot publish automation changes unless later explicitly granted.

## Platform super-admin

Internal SlotlyFlow operator. Not an organization role.

Must use separate authorization policy and all privileged actions must be audited.
