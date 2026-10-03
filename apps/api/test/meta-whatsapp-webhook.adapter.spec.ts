import { describe, expect, it } from 'vitest';

import { MetaWebhookPayloadError, normalizeMetaWhatsAppWebhook } from '../src/whatsapp/meta-whatsapp-webhook.adapter.js';

const messageId = 'wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA';

function inboundPayload(message: Record<string, unknown> = {
  from: '16505551234', id: messageId, timestamp: '1749416383', type: 'text', text: { body: 'Hello SlotlyFlow' },
}): unknown {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: '102290129340398',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '15550783881', phone_number_id: '106540352242922' },
          contacts: [{ profile: { name: 'Sheena Nelson' }, wa_id: '16505551234' }],
          messages: [message],
        },
      }],
    }],
  };
}

describe('Meta WhatsApp webhook normalization', () => {
  it('normalizes the supported text message subset without returning raw Meta JSON', () => {
    const normalized = normalizeMetaWhatsAppWebhook(inboundPayload());

    expect(normalized).toEqual({
      messages: [{
        provider: 'META', providerMessageId: messageId, destinationPhoneNumberId: '106540352242922',
        customerWhatsAppId: '16505551234', customerDisplayName: 'Sheena Nelson',
        occurredAt: new Date('2025-06-08T20:59:43.000Z'), messageType: 'TEXT', textBody: 'Hello SlotlyFlow',
        interactiveOptionId: null,
      }],
      humanBusinessAppMessages: [],
      statuses: [],
      coexistenceContacts: [],
      coexistenceSyncEvents: 0,
      coexistenceContactEntriesReceived: 0,
      coexistenceContactEntriesSkipped: 0,
      coexistenceHistoryEvents: [],
      ignoredStatusEvents: 0,
      ignoredEvents: 0,
    });
  });

  it('classifies unsupported inbound types without manufacturing text', () => {
    const normalized = normalizeMetaWhatsAppWebhook(inboundPayload({
      from: '16505551234', id: `${messageId}-image`, timestamp: '1749416383', type: 'image', image: { id: 'media-id' },
    }));

    expect(normalized.messages[0]).toMatchObject({ messageType: 'UNSUPPORTED', textBody: null });
  });

  it('distinguishes provider status events from inbound messages and ignores irrelevant changes', () => {
    const normalized = normalizeMetaWhatsAppWebhook({
      object: 'whatsapp_business_account',
      entry: [{ changes: [
        { field: 'messages', value: { metadata: { phone_number_id: '106540352242922' }, statuses: [{ id: messageId, status: 'delivered', timestamp: '1749416383' }] } },
        { field: 'account_update', value: { account: 'ignored' } },
      ] }],
    });

    expect(normalized).toEqual({
      messages: [],
      humanBusinessAppMessages: [],
      statuses: [{
        provider: 'META',
        destinationPhoneNumberId: '106540352242922',
        providerMessageId: messageId,
        status: 'DELIVERED',
        occurredAt: new Date('2025-06-08T20:59:43.000Z'),
      }],
      coexistenceContacts: [],
      coexistenceSyncEvents: 0,
      coexistenceContactEntriesReceived: 0,
      coexistenceContactEntriesSkipped: 0,
      coexistenceHistoryEvents: [],
      ignoredStatusEvents: 0,
      ignoredEvents: 1,
    });
  });

  it('normalizes only documented outbound status states and leaves unsupported states harmless', () => {
    const normalized = normalizeMetaWhatsAppWebhook({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: {
        metadata: { phone_number_id: '106540352242922' },
        statuses: [
          { id: messageId, status: 'read', timestamp: '1749416383', recipient_id: '16505551234' },
          { id: `${messageId}-played`, status: 'played', timestamp: '1749416383', recipient_id: '16505551234' },
        ],
      } }] }],
    });
    expect(normalized.statuses).toHaveLength(1);
    expect(normalized.statuses[0]).toMatchObject({ status: 'READ', providerMessageId: messageId });
    expect(normalized.ignoredStatusEvents).toBe(1);
  });

  it('fails closed on malformed Meta structures', () => {
    expect(() => normalizeMetaWhatsAppWebhook({ object: 'not_whatsapp', entry: [] })).toThrow(MetaWebhookPayloadError);
    expect(() => normalizeMetaWhatsAppWebhook(inboundPayload({ from: 'not-a-phone', id: messageId, timestamp: '1749416383', type: 'text', text: { body: 'Hi' } }))).toThrow(MetaWebhookPayloadError);
    expect(() => normalizeMetaWhatsAppWebhook(inboundPayload({ from: '16505551234', id: messageId, timestamp: '1749416383', type: 'text', text: {} }))).toThrow(MetaWebhookPayloadError);
  });

  it('normalizes the documented Business App text echo using the recipient, not the business sender', () => {
    const normalized = normalizeMetaWhatsAppWebhook({
      object: 'whatsapp_business_account',
      entry: [{ id: '102290129340398', changes: [{ field: 'smb_message_echoes', value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '15550783881', phone_number_id: '106540352242922' },
        message_echoes: [{
          from: '15550783881', to: '+16505551234', id: messageId,
          timestamp: '1739321024', type: 'text', text: { body: 'Here is the information.' },
        }],
      } }] }],
    });
    expect(normalized.humanBusinessAppMessages).toEqual([{
      provider: 'META', providerMessageId: messageId, wabaId: '102290129340398',
      destinationPhoneNumberId: '106540352242922', customerWhatsAppId: '16505551234',
      occurredAt: new Date(1_739_321_024_000), messageType: 'TEXT',
      textBody: 'Here is the information.',
    }]);
    expect(normalized.messages).toEqual([]);
    expect(normalized.statuses).toEqual([]);
  });

  it('does not count non-message edits or revocations as new human activity', () => {
    const normalized = normalizeMetaWhatsAppWebhook({
      object: 'whatsapp_business_account', entry: [{ id: '102290129340398', changes: [{
        field: 'smb_message_echoes', value: {
          messaging_product: 'whatsapp', metadata: { phone_number_id: '106540352242922' },
          message_echoes: [
            { from: '15550783881', to: '16505551234', id: `${messageId}-edit`, timestamp: '1739321024', type: 'edit' },
            { from: '15550783881', to: '16505551234', id: `${messageId}-revoke`, timestamp: '1739321024', type: 'revoke' },
          ],
        },
      }] }],
    });
    expect(normalized.humanBusinessAppMessages).toEqual([]);
    expect(normalized.ignoredEvents).toBe(2);
  });

  it('counts a media reply without inventing text and accepts a numeric Unix timestamp', () => {
    const normalized = normalizeMetaWhatsAppWebhook({
      object: 'whatsapp_business_account', entry: [{ id: '102290129340398', changes: [{
        field: 'smb_message_echoes', value: {
          messaging_product: 'whatsapp', metadata: { phone_number_id: '106540352242922' },
          message_echoes: [{ from: '15550783881', to: '16505551234', id: `${messageId}-image`,
            timestamp: 1739321024, type: 'image', image: { id: 'media-id' } }],
        },
      }] }],
    });
    expect(normalized.humanBusinessAppMessages).toMatchObject([{
      messageType: 'UNSUPPORTED', textBody: null, occurredAt: new Date(1_739_321_024_000),
    }]);
  });

  it('rejects malformed echo routing and timestamp evidence', () => {
    const echo = { from: '15550783881', to: '16505551234', id: messageId,
      timestamp: '1739321024', type: 'text', text: { body: 'Hello' } };
    const payload = (value: Record<string, unknown>) => ({
      object: 'whatsapp_business_account', entry: [{ id: '102290129340398', changes: [{
        field: 'smb_message_echoes', value: { messaging_product: 'whatsapp',
          metadata: { phone_number_id: '106540352242922' }, message_echoes: [value] },
      }] }],
    });
    expect(() => normalizeMetaWhatsAppWebhook(payload({ ...echo, to: 'group@g.us' }))).toThrow(MetaWebhookPayloadError);
    expect(() => normalizeMetaWhatsAppWebhook(payload({ ...echo, timestamp: 'not-a-time' }))).toThrow(MetaWebhookPayloadError);
    expect(() => normalizeMetaWhatsAppWebhook(payload({ ...echo, text: {} }))).toThrow(MetaWebhookPayloadError);
  });
});
