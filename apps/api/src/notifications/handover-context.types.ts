/** Structured, trusted automation context persisted with a tenant-owned human handover. */
export interface TrustedAutomationHandoverContext {
  readonly requestType: string;
  readonly answers: Readonly<Record<string, string>>;
  readonly receivedAt: string;
  readonly receivedDuringBusinessHours: boolean | null;
  readonly customerWhatsAppId: string;
  readonly savedContact?: boolean | null;
  readonly contactId?: string | null;
}
