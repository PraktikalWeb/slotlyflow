import { describe, expect, it } from 'vitest';

import {
  isWhatsAppConnectionSource,
  isWhatsAppConnectionStatus,
  mayTransitionWhatsAppConnection,
} from '../src/whatsapp/whatsapp-connection.types.js';

describe('WhatsApp connection lifecycle', () => {
  it('keeps source and status separate and permits only documented lifecycle transitions', () => {
    expect(isWhatsAppConnectionSource('EXISTING_BUSINESS_APP')).toBe(true);
    expect(isWhatsAppConnectionSource('NEW_NUMBER')).toBe(true);
    expect(isWhatsAppConnectionSource('EXISTING_PLATFORM')).toBe(true);
    expect(isWhatsAppConnectionSource('UNKNOWN_SOURCE')).toBe(false);
    expect(isWhatsAppConnectionStatus('CONNECTED')).toBe(true);
    expect(isWhatsAppConnectionStatus('NOT_STARTED')).toBe(false);

    expect(mayTransitionWhatsAppConnection('PENDING', 'VERIFYING')).toBe(true);
    expect(mayTransitionWhatsAppConnection('VERIFYING', 'CONNECTED')).toBe(true);
    expect(mayTransitionWhatsAppConnection('CONNECTED', 'DISCONNECTED')).toBe(true);
    expect(mayTransitionWhatsAppConnection('FAILED', 'VERIFYING')).toBe(true);
    expect(mayTransitionWhatsAppConnection('DISCONNECTED', 'VERIFYING')).toBe(true);
    expect(mayTransitionWhatsAppConnection('CONNECTED', 'PENDING')).toBe(false);
    expect(mayTransitionWhatsAppConnection('PENDING', 'CONNECTED')).toBe(false);
  });
});
