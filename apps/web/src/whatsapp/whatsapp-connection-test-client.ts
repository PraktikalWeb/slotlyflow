import { configuredApiBaseUrl } from '@/src/auth/auth-client';
import { normalizeConnectionTestPhoneNumber, type ConnectionTestPhoneNumberIssue } from './connection-test-phone-number';

type TestFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type ConnectionTestStatus = 'NOT_TESTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';
export type ConnectionTestStage = 'WAITING_FOR_MESSAGE' | 'MESSAGE_RECEIVED' | 'REPLY_SENT' | 'PASSED' | 'FAILED';

export interface WhatsAppConnectionTest {
  readonly id: string | null;
  readonly status: ConnectionTestStatus;
  readonly stage: ConnectionTestStage | null;
  readonly testSenderPhoneNumber: string | null;
  readonly expiresAt: string | null;
  readonly inboundReceivedAt: string | null;
  readonly replySentAt: string | null;
  readonly completedAt: string | null;
}

export type StartConnectionTestIssue = ConnectionTestPhoneNumberIssue | 'UNAVAILABLE';

export type StartConnectionTestResult =
  | { readonly ok: true; readonly test: WhatsAppConnectionTest }
  | { readonly ok: false; readonly issue: StartConnectionTestIssue };

export async function getConnectionTest(organizationId: string, fetcher: TestFetch = fetch): Promise<WhatsAppConnectionTest | undefined> {
  try {
    const response = await fetcher(testUrl(organizationId), { credentials: 'include', cache: 'no-store' });
    if (!response.ok) return undefined;
    return testFromPayload(await response.json());
  } catch {
    return undefined;
  }
}

export async function startConnectionTest(organizationId: string, testPhoneNumber: string, fetcher: TestFetch = fetch): Promise<StartConnectionTestResult> {
  const normalized = normalizeConnectionTestPhoneNumber(testPhoneNumber);
  if (!normalized.ok) return { ok: false, issue: normalized.issue };
  try {
    const csrf = await csrfToken(fetcher);
    if (csrf === undefined) return { ok: false, issue: 'UNAVAILABLE' };
    const response = await fetcher(testUrl(organizationId), {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ testPhoneNumber: normalized.value }),
    });
    if (!response.ok) return { ok: false, issue: await startIssue(response) };
    const test = testFromPayload(await response.json());
    return test === undefined ? { ok: false, issue: 'UNAVAILABLE' } : { ok: true, test };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

async function startIssue(response: Response): Promise<StartConnectionTestIssue> {
  try {
    const payload: unknown = await response.json();
    const code = typeof payload === 'object' && payload !== null && 'error' in payload
      && typeof payload.error === 'object' && payload.error !== null && 'code' in payload.error
      ? payload.error.code
      : undefined;
    if (code === 'CONNECTION_TEST_PHONE_NUMBER_REQUIRED') return 'REQUIRED';
    if (code === 'CONNECTION_TEST_PHONE_NUMBER_INVALID') return 'INVALID';
  } catch { /* Preserve the safe generic failure below. */ }
  return 'UNAVAILABLE';
}

function testUrl(organizationId: string): string {
  return `${configuredApiBaseUrl()}/organizations/${encodeURIComponent(organizationId)}/whatsapp-connection/test`;
}

async function csrfToken(fetcher: TestFetch): Promise<string | undefined> {
  const response = await fetcher(`${configuredApiBaseUrl()}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) return undefined;
  const payload: unknown = await response.json();
  return typeof payload === 'object' && payload !== null && 'csrfToken' in payload && typeof payload.csrfToken === 'string'
    ? payload.csrfToken
    : undefined;
}

function testFromPayload(value: unknown): WhatsAppConnectionTest | undefined {
  if (typeof value !== 'object' || value === null || !('test' in value) || typeof value.test !== 'object' || value.test === null) return undefined;
  const test = value.test;
  if (!('status' in test) || !isStatus(test.status) || !('id' in test) || (test.id !== null && typeof test.id !== 'string')) return undefined;
  if (!('stage' in test) || (test.stage !== null && !isStage(test.stage))) return undefined;
  if (!('testSenderPhoneNumber' in test) || (test.testSenderPhoneNumber !== null && typeof test.testSenderPhoneNumber !== 'string')) return undefined;
  if (!('expiresAt' in test) || !('inboundReceivedAt' in test) || !('replySentAt' in test) || !('completedAt' in test)) return undefined;
  if (![test.expiresAt, test.inboundReceivedAt, test.replySentAt, test.completedAt].every((item) => item === null || typeof item === 'string')) return undefined;
  return test as WhatsAppConnectionTest;
}

function isStatus(value: unknown): value is ConnectionTestStatus {
  return value === 'NOT_TESTED' || value === 'IN_PROGRESS' || value === 'PASSED' || value === 'FAILED';
}

function isStage(value: unknown): value is ConnectionTestStage {
  return value === 'WAITING_FOR_MESSAGE' || value === 'MESSAGE_RECEIVED' || value === 'REPLY_SENT' || value === 'PASSED' || value === 'FAILED';
}
