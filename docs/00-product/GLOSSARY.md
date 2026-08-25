# Glossary

## Organization
Canonical tenant/domain entity representing one customer business workspace.

UI may use the word **Business** or **Workspace**, but code and persistence use `Organization`.

## Tenant
Architectural concept referring to organization-level isolation. Do not create a separate `Tenant` domain entity unless an ADR explicitly changes this decision.

## User
A human account that can belong to one or more organizations.

## Organization Membership
Relationship between a User and an Organization, including role.

## Contact
A customer/end-user identity known to an organization.

## Conversation
A bounded customer communication thread owned by an organization.

## Message
One inbound or outbound communication item within a conversation.

## WhatsApp Account
SlotlyFlow representation of a connected WhatsApp Business account/provider relationship.

## WhatsApp Phone Number
A connected phone-number identity used for WhatsApp messaging.

## Automation
Logical automation owned by an organization.

## Automation Version
Immutable published definition of an automation at a point in time.

## Automation Session
Durable runtime state for a conversation executing an automation version.

## Handoff
Stateful transfer of a conversation between automation and a human agent.

## Provider
External messaging/infrastructure integration. Meta WhatsApp Cloud API is a provider implementation, not the domain itself.

## Agent
A user acting in the conversation inbox. Typically an organization member with AGENT or higher privileges.
