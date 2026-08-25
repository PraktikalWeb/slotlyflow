# Core User Journeys

## Journey 1 — First-time setup

1. Visitor creates account.
2. Visitor verifies email.
3. User creates organization.
4. User enters business basics.
5. User connects WhatsApp.
6. SlotlyFlow verifies connection health.
7. User chooses a starting automation/template.
8. User configures business-specific information.
9. User configures human handover.
10. User sends/receives a test interaction.
11. User activates automation.
12. Dashboard confirms live status.

## Journey 2 — Automated customer conversation

1. Customer messages business on WhatsApp.
2. Meta webhook reaches SlotlyFlow.
3. Event is authenticated, normalized, deduplicated, persisted/enqueued.
4. Conversation is resolved/created.
5. Automation session is resolved/started.
6. Engine determines actions.
7. Outbound message request is queued.
8. Outbound worker sends through provider.
9. Provider statuses update message state.
10. Inbox receives realtime updates.

## Journey 3 — Human handover

1. Automation or customer requests a person.
2. Conversation enters handover-requested state.
3. Eligible agents are notified.
4. Agent accepts/takes over.
5. Automation pauses.
6. Agent communicates with customer.
7. Agent completes handover.
8. Resume policy is evaluated.
9. Automation resumes or conversation remains manually controlled according to configuration.

## Journey 4 — Organization management

1. Owner invites a user.
2. Invitee joins organization.
3. Owner/admin assigns allowed role.
4. Authorization updates immediately.
5. Role change is written to audit log.
