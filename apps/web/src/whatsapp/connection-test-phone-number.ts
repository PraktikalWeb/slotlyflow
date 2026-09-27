export type ConnectionTestPhoneNumberIssue = 'REQUIRED' | 'INVALID';
export type ConnectionTestPhoneNumberResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly issue: ConnectionTestPhoneNumberIssue };

/** Browser equivalent of the server's South African Connection Test boundary. */
export function normalizeConnectionTestPhoneNumber(value: string): ConnectionTestPhoneNumberResult {
  const input = value.trim();
  if (input.length === 0) return { ok: false, issue: 'REQUIRED' };
  if (!/^[+0-9][0-9 -]*$/.test(input)) return { ok: false, issue: 'INVALID' };
  const compact = input.replace(/[ -]/g, '');
  if (/^0[1-9][0-9]{8}$/.test(compact)) return { ok: true, value: `+27${compact.slice(1)}` };
  if (/^(?:\+27|27)[1-9][0-9]{8}$/.test(compact)) return { ok: true, value: `+${compact.replace(/^\+?/, '')}` };
  return { ok: false, issue: 'INVALID' };
}

export function connectionTestPhoneNumberMessage(issue: ConnectionTestPhoneNumberIssue): string {
  if (issue === 'REQUIRED') return 'Enter the WhatsApp number you’ll use for testing.';
  return 'Enter a valid South African WhatsApp number.';
}
