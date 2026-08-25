# Domain Entities

## Identity and tenancy

### User
Human account.

### Organization
Tenant/customer business.

### OrganizationMembership
User-to-organization relationship with role/status.

## Messaging

### WhatsAppAccount
Connected provider-level WhatsApp business relationship.

### WhatsAppPhoneNumber
Specific sender/receiver identity connected to an organization.

### Contact
Organization-scoped customer identity.

### Conversation
Organization-scoped messaging thread.

### Message
Inbound/outbound item in a conversation.

### MessageStatusEvent
Provider/application message lifecycle event.

## Automation

### AutomationFlow
Logical automation.

### AutomationVersion
Immutable flow definition snapshot.

### AutomationSession
Durable execution state bound to a conversation/version.

## Handover

### Handoff
Human takeover lifecycle.

### AgentAssignment
Assignment/ownership of a conversation/handoff to an eligible member.

## Business knowledge

### BusinessProfile
Structured business facts.

### KnowledgeItem
FAQ/service/policy/other usable business information.

## Commercial

### Subscription
Commercial plan state.

### UsageRecord
Meterable usage.

## Operational

### AuditLog
Security/business audit event.

### OutboxEvent
Durable event waiting for publication.

### WebhookReceipt
Deduplication/audit record for external webhook delivery.
