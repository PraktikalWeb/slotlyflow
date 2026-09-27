export type ConnectionTestPhoneNumberIssue = 'REQUIRED' | 'INVALID';
export type ConnectionTestPhoneNumberResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly issue: ConnectionTestPhoneNumberIssue };

/** South African Connection Test form shared by creation and webhook matching. */
export function normalizeConnectionTestPhoneNumber(value: unknown): ConnectionTestPhoneNumberResult {
  if (typeof value !== 'string' || value.trim().length === 0) return { ok: false, issue: 'REQUIRED' };
  const input = value.trim();
  if (!/^[+0-9][0-9 -]*$/.test(input)) return { ok: false, issue: 'INVALID' };
  const compact = input.replace(/[ -]/g, '');
  if (/^0[1-9][0-9]{8}$/.test(compact)) return { ok: true, value: `+27${compact.slice(1)}` };
  if (/^(?:\+27|27)[1-9][0-9]{8}$/.test(compact)) return { ok: true, value: `+${compact.replace(/^\+?/, '')}` };
  return { ok: false, issue: 'INVALID' };
}

/** Meta's `from` normally omits `+`; use the same South African normalizer before matching. */
export function normalizeConnectionTestWebhookSender(value: string): string | undefined {
  const normalized = normalizeConnectionTestPhoneNumber(value);
  return normalized.ok ? normalized.value : undefined;
}
