import type { InboundWhatsAppMessage } from './inbound-whatsapp-message.types.js';
import type { HumanBusinessAppMessage } from './human-business-app-message.types.js';
import type { ProviderMessageStatusUpdate } from './outbound-whatsapp-message.repository.js';
import type { CoexistenceContactIdentity } from '../contacts/contact.types.js';
import { normalizeWhatsAppContactIdentity } from '../contacts/whatsapp-contact-identity.js';

const identifier = /^[0-9A-Za-z._:=-]{1,255}$/;
const customerIdentifier = /^[0-9]{1,64}$/;
const maximumTextLength = 4_096;
const maximumDisplayNameLength = 256;

export class MetaWebhookPayloadError extends Error {
  constructor() {
    super('Meta webhook payload is invalid.');
    this.name = 'MetaWebhookPayloadError';
  }
}

export interface NormalizedMetaWebhook {
  readonly messages: readonly InboundWhatsAppMessage[];
  readonly humanBusinessAppMessages: readonly HumanBusinessAppMessage[];
  readonly statuses: readonly ProviderMessageStatusUpdate[];
  readonly coexistenceContacts: readonly CoexistenceContactIdentity[];
  readonly coexistenceSyncEvents: number;
  readonly coexistenceContactEntriesReceived: number;
  readonly coexistenceContactEntriesSkipped: number;
  readonly coexistenceHistoryEvents: readonly NormalizedCoexistenceHistoryEvent[];
  readonly ignoredStatusEvents: number;
  readonly ignoredEvents: number;
}

export interface NormalizedCoexistenceHistoryEvent {
  readonly destinationPhoneNumberId: string;
  readonly contacts: readonly CoexistenceContactIdentity[];
  readonly entriesReceived: number;
  readonly entriesSkipped: number;
  readonly declined: boolean;
  readonly processed: boolean;
}

/**
 * Meta-only JSON normalization boundary for messages, statuses, Business app
 * echoes, and narrow Coexistence contact/history identity slices. Raw provider
 * fragments never escape.
 */
export function normalizeMetaWhatsAppWebhook(payload: unknown): NormalizedMetaWebhook {
  if (!isRecord(payload) || payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
    throw new MetaWebhookPayloadError();
  }

  const messages: InboundWhatsAppMessage[] = [];
  const humanBusinessAppMessages: HumanBusinessAppMessage[] = [];
  const statuses: ProviderMessageStatusUpdate[] = [];
  const coexistenceContacts: CoexistenceContactIdentity[] = [];
  const coexistenceHistoryEvents: NormalizedCoexistenceHistoryEvent[] = [];
  let coexistenceSyncEvents = 0;
  let coexistenceContactEntriesReceived = 0;
  let coexistenceContactEntriesSkipped = 0;
  let ignoredStatusEvents = 0;
  let ignoredEvents = 0;

  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) throw new MetaWebhookPayloadError();
    for (const change of entry.changes) {
      if (!isRecord(change)) {
        ignoredEvents += 1;
        continue;
      }

      if (change.field === 'smb_app_state_sync') {
        coexistenceSyncEvents += 1;
        const sync = normalizeCoexistenceContactSync(change.value);
        coexistenceContacts.push(...sync.contacts);
        coexistenceContactEntriesReceived += sync.received;
        coexistenceContactEntriesSkipped += sync.skipped;
        continue;
      }


      if (change.field === 'history') {
        const history = normalizeCoexistenceHistory(change.value);
        if (history === undefined) ignoredEvents += 1;
        else coexistenceHistoryEvents.push(history);
        continue;
      }

      if (change.field === 'smb_message_echoes') {
        const value = change.value;
        if (!isIdentifier(entry.id) || !isRecord(value) || !isRecord(value.metadata)
          || value.messaging_product !== 'whatsapp'
          || !isIdentifier(value.metadata.phone_number_id)
          || !Array.isArray(value.message_echoes)) throw new MetaWebhookPayloadError();
        const destinationPhoneNumberId = value.metadata.phone_number_id;
        for (const echo of value.message_echoes) {
          const normalized = normalizeHumanBusinessAppEcho(echo, entry.id, destinationPhoneNumberId);
          if (normalized === undefined) ignoredEvents += 1;
          else humanBusinessAppMessages.push(normalized);
        }
        continue;
      }

      // All other provider fields are acknowledged without traversing them.
      if (change.field !== 'messages' || !isRecord(change.value)) {
        ignoredEvents += 1;
        continue;
      }

      const metadata = change.value.metadata;
      if (!isRecord(metadata) || !isIdentifier(metadata.phone_number_id)) {
        throw new MetaWebhookPayloadError();
      }
      const destinationPhoneNumberId = metadata.phone_number_id;

      if (change.value.statuses !== undefined) {
        if (!Array.isArray(change.value.statuses)) throw new MetaWebhookPayloadError();
        for (const status of change.value.statuses) {
          const normalizedStatus = normalizeStatus(status, destinationPhoneNumberId);
          if (normalizedStatus === undefined) ignoredStatusEvents += 1;
          else statuses.push(normalizedStatus);
        }
      }
      if (!Array.isArray(change.value.messages)) continue;

      const contacts = contactsByWhatsAppId(change.value.contacts);
      for (const message of change.value.messages) {
        messages.push(normalizeMessage(message, destinationPhoneNumberId, contacts));
      }
    }
  }

  return {
    messages,
    humanBusinessAppMessages,
    statuses,
    coexistenceContacts,
    coexistenceSyncEvents,
    coexistenceContactEntriesReceived,
    coexistenceContactEntriesSkipped,
    coexistenceHistoryEvents,
    ignoredStatusEvents,
    ignoredEvents,
  };
}

function normalizeHumanBusinessAppEcho(
  echo: unknown,
  wabaId: string,
  destinationPhoneNumberId: string,
): HumanBusinessAppMessage | undefined {
  if (!isRecord(echo) || !isIdentifier(echo.id) || typeof echo.type !== 'string'
    || normalizeWhatsAppContactIdentity(echo.from) === undefined) throw new MetaWebhookPayloadError();
  const recipient = normalizeWhatsAppContactIdentity(echo.to);
  if (recipient === undefined) throw new MetaWebhookPayloadError();
  const occurredAt = parseUnixSeconds(
    typeof echo.timestamp === 'number' && Number.isSafeInteger(echo.timestamp)
      ? String(echo.timestamp)
      : echo.timestamp,
  );
  // Edit, revoke and other non-message echoes must not extend inactivity.
  if (echo.type === 'text') {
    if (!isRecord(echo.text) || typeof echo.text.body !== 'string'
      || echo.text.body.length === 0 || echo.text.body.length > maximumTextLength) throw new MetaWebhookPayloadError();
    return {
      provider: 'META', providerMessageId: echo.id, wabaId, destinationPhoneNumberId,
      customerWhatsAppId: recipient.whatsappId, occurredAt, messageType: 'TEXT', textBody: echo.text.body,
    };
  }
  if (!['image', 'audio', 'video', 'document', 'sticker', 'location'].includes(echo.type)
    || !isRecord(echo[echo.type])) return undefined;
  return {
    provider: 'META', providerMessageId: echo.id, wabaId, destinationPhoneNumberId,
    customerWhatsAppId: recipient.whatsappId, occurredAt, messageType: 'UNSUPPORTED', textBody: null,
  };
}

function normalizeCoexistenceHistory(value: unknown): NormalizedCoexistenceHistoryEvent | undefined {
  if (
    !isRecord(value)
    || !isRecord(value.metadata)
    || !isIdentifier(value.metadata.phone_number_id)
    || !Array.isArray(value.history)
  ) {
    return undefined;
  }
  const destinationPhoneNumberId = value.metadata.phone_number_id;

  const contacts: CoexistenceContactIdentity[] = [];
  let entriesReceived = 0;
  let entriesSkipped = 0;
  let declined = false;
  let processed = false;

  for (const historyEntry of value.history) {
    if (!isRecord(historyEntry)) {
      entriesSkipped += 1;
      continue;
    }

    if (Array.isArray(historyEntry.errors)) {
      declined = declined || historyEntry.errors.some((error) => (
        isRecord(error) && (error.code === 2593109 || error.code === '2593109')
      ));
    }
    if (
      isRecord(historyEntry.metadata)
      && typeof historyEntry.metadata.progress === 'number'
      && historyEntry.metadata.progress === 100
    ) {
      processed = true;
    }
    if (historyEntry.threads === undefined) continue;
    if (!Array.isArray(historyEntry.threads)) {
      entriesSkipped += 1;
      continue;
    }

    for (const thread of historyEntry.threads) {
      entriesReceived += 1;
      if (!isRecord(thread)) {
        entriesSkipped += 1;
        continue;
      }
      // Only the documented 1-to-1 thread identity is inspected. Message
      // arrays and all content/timestamps/media remain completely untouched.
      const identity = normalizeWhatsAppContactIdentity(thread.id);
      if (identity === undefined) {
        entriesSkipped += 1;
        continue;
      }
      contacts.push({
        provider: 'META',
        destinationPhoneNumberId,
        ...identity,
      });
    }
  }

  return {
    destinationPhoneNumberId,
    contacts,
    entriesReceived,
    entriesSkipped,
    declined,
    processed,
  };
}

function normalizeCoexistenceContactSync(value: unknown): {
  readonly contacts: readonly CoexistenceContactIdentity[];
  readonly received: number;
  readonly skipped: number;
} {
  if (!isRecord(value) || !isRecord(value.metadata) || !isIdentifier(value.metadata.phone_number_id)) {
    return { contacts: [], received: 0, skipped: 1 };
  }
  if (!Array.isArray(value.state_sync)) return { contacts: [], received: 0, skipped: 1 };

  const contacts: CoexistenceContactIdentity[] = [];
  let skipped = 0;
  for (const entry of value.state_sync) {
    if (!isRecord(entry) || entry.type !== 'contact') {
      skipped += 1;
      continue;
    }
    // Meta currently uses `add` for contact creation/update. Removal and all
    // unknown actions are intentionally ignored; Contacts are never deleted by sync.
    if (entry.action !== 'add' || !isRecord(entry.contact)) {
      skipped += 1;
      continue;
    }
    const identity = normalizeWhatsAppContactIdentity(entry.contact.phone_number);
    if (identity === undefined) {
      skipped += 1;
      continue;
    }
    contacts.push({
      provider: 'META',
      destinationPhoneNumberId: value.metadata.phone_number_id,
      ...identity,
    });
  }
  return { contacts, received: value.state_sync.length, skipped };
}

function normalizeStatus(value: unknown, destinationPhoneNumberId: string): ProviderMessageStatusUpdate | undefined {
  if (!isRecord(value) || !isIdentifier(value.id) || typeof value.status !== 'string') throw new MetaWebhookPayloadError();
  const status = value.status.toUpperCase();
  if (status !== 'SENT' && status !== 'DELIVERED' && status !== 'READ' && status !== 'FAILED') return undefined;
  return {
    provider: 'META',
    destinationPhoneNumberId,
    providerMessageId: value.id,
    status,
    occurredAt: parseUnixSeconds(value.timestamp),
  };
}

function normalizeMessage(
  message: unknown,
  destinationPhoneNumberId: string,
  contacts: ReadonlyMap<string, string | null>,
): InboundWhatsAppMessage {
  if (!isRecord(message) || !isIdentifier(message.id) || !isCustomerIdentifier(message.from) || typeof message.type !== 'string') {
    throw new MetaWebhookPayloadError();
  }
  const occurredAt = parseUnixSeconds(message.timestamp);
  const customerWhatsAppId = message.from;
  const displayName = contacts.get(customerWhatsAppId) ?? null;

  if (message.type === 'text') {
    if (!isRecord(message.text) || typeof message.text.body !== 'string' || message.text.body.length === 0 || message.text.body.length > maximumTextLength) {
      throw new MetaWebhookPayloadError();
    }
    return {
      provider: 'META',
      providerMessageId: message.id,
      destinationPhoneNumberId,
      customerWhatsAppId,
      customerDisplayName: displayName,
      occurredAt,
      messageType: 'TEXT',
      textBody: message.text.body,
      interactiveOptionId: null,
    };
  }

  if (message.type === 'interactive') {
    const reply = normalizeInteractiveReply(message.interactive);
    if (reply === undefined) throw new MetaWebhookPayloadError();
    return {
      provider: 'META',
      providerMessageId: message.id,
      destinationPhoneNumberId,
      customerWhatsAppId,
      customerDisplayName: displayName,
      occurredAt,
      messageType: 'INTERACTIVE_REPLY',
      textBody: reply.title,
      interactiveOptionId: reply.id,
    };
  }

  return {
    provider: 'META',
    providerMessageId: message.id,
    destinationPhoneNumberId,
    customerWhatsAppId,
    customerDisplayName: displayName,
    occurredAt,
    messageType: 'UNSUPPORTED',
    textBody: null,
    interactiveOptionId: null,
  };
}

/** Meta sends the same stable row/button ID for both interactive response kinds. */
function normalizeInteractiveReply(value: unknown): { readonly id: string; readonly title: string } | undefined {
  if (!isRecord(value) || (value.type !== 'button_reply' && value.type !== 'list_reply')) return undefined;
  const reply = value.type === 'button_reply' ? value.button_reply : value.list_reply;
  if (
    !isRecord(reply)
    || !isIdentifier(reply.id)
    || typeof reply.title !== 'string'
    || reply.title.length === 0
    || reply.title.length > maximumTextLength
  ) return undefined;
  return { id: reply.id, title: reply.title };
}

function contactsByWhatsAppId(value: unknown): ReadonlyMap<string, string | null> {
  const contacts = new Map<string, string | null>();
  if (value === undefined) return contacts;
  if (!Array.isArray(value)) throw new MetaWebhookPayloadError();
  for (const contact of value) {
    if (!isRecord(contact) || !isCustomerIdentifier(contact.wa_id)) continue;
    const profile = contact.profile;
    const name = isRecord(profile) && typeof profile.name === 'string' && profile.name.trim().length > 0 && profile.name.length <= maximumDisplayNameLength
      ? profile.name.trim()
      : null;
    contacts.set(contact.wa_id, name);
  }
  return contacts;
}

function parseUnixSeconds(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{1,12}$/.test(value)) throw new MetaWebhookPayloadError();
  const milliseconds = Number(value) * 1_000;
  const date = new Date(milliseconds);
  if (!Number.isSafeInteger(milliseconds) || Number.isNaN(date.getTime()) || date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2100) {
    throw new MetaWebhookPayloadError();
  }
  return date;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && identifier.test(value);
}

function isCustomerIdentifier(value: unknown): value is string {
  return typeof value === 'string' && customerIdentifier.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
