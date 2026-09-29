import { configuredApiBaseUrl } from '@/src/auth/auth-client';

type BotPreviewFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type BotPreviewInput =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'interactive_reply'; readonly optionId: string };

export interface BotPreviewOption {
  readonly id: string;
  readonly label: string;
}

export type BotPreviewMessage =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'interactive'; readonly body: string; readonly options: readonly BotPreviewOption[] };

export interface BotPreview {
  readonly previewSessionId: string;
  readonly messages: readonly BotPreviewMessage[];
  readonly handover: boolean;
}

export type BotPreviewIssue =
  | 'NOT_CONFIGURED'
  | 'SESSION_UNAVAILABLE'
  | 'UNAVAILABLE';

export type BotPreviewResult =
  | { readonly ok: true; readonly preview: BotPreview }
  | { readonly ok: false; readonly issue: BotPreviewIssue };

export async function executeBotPreview(
  organizationId: string,
  previewSessionId: string | null,
  input: BotPreviewInput,
  fetcher: BotPreviewFetch = fetch,
): Promise<BotPreviewResult> {
  try {
    const csrfToken = await requestCsrfToken(fetcher);
    if (csrfToken === undefined) return { ok: false, issue: 'UNAVAILABLE' };
    const response = await fetcher(
      `${configuredApiBaseUrl()}/organizations/${encodeURIComponent(organizationId)}/automation/preview`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ previewSessionId, input }),
      },
    );
    if (!response.ok) return { ok: false, issue: await previewIssue(response) };
    const preview = previewFromPayload(await response.json());
    return preview === undefined
      ? { ok: false, issue: 'UNAVAILABLE' }
      : { ok: true, preview };
  } catch {
    return { ok: false, issue: 'UNAVAILABLE' };
  }
}

export async function resetBotPreview(
  organizationId: string,
  previewSessionId: string,
  fetcher: BotPreviewFetch = fetch,
): Promise<boolean> {
  try {
    const csrfToken = await requestCsrfToken(fetcher);
    if (csrfToken === undefined) return false;
    const response = await fetcher(
      `${configuredApiBaseUrl()}/organizations/${encodeURIComponent(organizationId)}/automation/preview/reset`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ previewSessionId }),
      },
    );
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    return typeof payload === 'object' && payload !== null && 'reset' in payload && payload.reset === true;
  } catch {
    return false;
  }
}

async function requestCsrfToken(fetcher: BotPreviewFetch): Promise<string | undefined> {
  const response = await fetcher(`${configuredApiBaseUrl()}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) return undefined;
  const payload: unknown = await response.json();
  return typeof payload === 'object' && payload !== null && 'csrfToken' in payload && typeof payload.csrfToken === 'string'
    ? payload.csrfToken
    : undefined;
}

async function previewIssue(response: Response): Promise<BotPreviewIssue> {
  try {
    const payload: unknown = await response.json();
    const code = typeof payload === 'object' && payload !== null && 'error' in payload
      && typeof payload.error === 'object' && payload.error !== null && 'code' in payload.error
      ? payload.error.code
      : undefined;
    if (code === 'BOT_PREVIEW_NOT_CONFIGURED') return 'NOT_CONFIGURED';
    if (code === 'BOT_PREVIEW_SESSION_UNAVAILABLE') return 'SESSION_UNAVAILABLE';
  } catch { /* Preserve the safe generic failure below. */ }
  return 'UNAVAILABLE';
}

function previewFromPayload(value: unknown): BotPreview | undefined {
  if (
    typeof value !== 'object'
    || value === null
    || !('previewSessionId' in value)
    || typeof value.previewSessionId !== 'string'
    || !('messages' in value)
    || !Array.isArray(value.messages)
    || !('handover' in value)
    || typeof value.handover !== 'boolean'
  ) return undefined;
  const messages = value.messages.map(messageFromPayload);
  if (messages.some((message) => message === undefined)) return undefined;
  return { previewSessionId: value.previewSessionId, messages: messages as BotPreviewMessage[], handover: value.handover };
}

function messageFromPayload(value: unknown): BotPreviewMessage | undefined {
  if (typeof value !== 'object' || value === null || !('type' in value)) return undefined;
  if (value.type === 'text' && 'text' in value && typeof value.text === 'string' && value.text.length > 0) {
    return { type: 'text', text: value.text };
  }
  if (value.type !== 'interactive' || !('body' in value) || typeof value.body !== 'string' || !('options' in value) || !Array.isArray(value.options)) {
    return undefined;
  }
  const options = value.options.map(optionFromPayload);
  if (options.length === 0 || options.some((option) => option === undefined)) return undefined;
  return { type: 'interactive', body: value.body, options: options as BotPreviewOption[] };
}

function optionFromPayload(value: unknown): BotPreviewOption | undefined {
  if (
    typeof value !== 'object'
    || value === null
    || !('id' in value)
    || typeof value.id !== 'string'
    || !('label' in value)
    || typeof value.label !== 'string'
  ) return undefined;
  return { id: value.id, label: value.label };
}
