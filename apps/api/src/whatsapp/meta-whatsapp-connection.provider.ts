import type { MetaWhatsAppConfig } from '@slotlyflow/config';

import { AesGcmCredentialStore, type CredentialStore } from './credential-store.js';
import {
  CoexistenceContactSyncError,
  CoexistenceHistorySyncError,
  WhatsAppWebhookSubscriptionError,
  type CoexistenceContactSyncResult,
  type CoexistenceHistorySyncResult,
  type WabaSubscriptionResult,
  type WhatsAppConnectionProvider,
  type WhatsAppConnectionValidationResult,
} from './whatsapp-provider.js';
import {
  noCoexistenceContactSyncDiagnostics,
  type CoexistenceContactSyncDiagnosticReporter,
} from './coexistence-contact-sync-diagnostics.js';
import {
  noCoexistenceHistorySyncDiagnostics,
  type CoexistenceHistorySyncDiagnosticReporter,
} from './coexistence-history-sync-diagnostics.js';
import {
  noWabaSubscriptionDiagnostics,
  type WabaSubscriptionDiagnosticReporter,
} from './waba-subscription-diagnostics.js';

const graphOrigin = 'https://graph.facebook.com';
const identifier = /^[0-9]{1,32}$/;

export class MetaProviderOperationError extends Error {
  constructor(readonly stage: 'AUTHORIZATION_CODE_EXCHANGE' | 'PHONE_OWNERSHIP_VERIFICATION') {
    super('Meta provider operation failed.');
    this.name = 'MetaProviderOperationError';
  }
}

/** Meta-only infrastructure adapter. Raw Graph shapes do not leave this module. */
export class MetaWhatsAppConnectionProvider implements WhatsAppConnectionProvider {
  readonly provider = 'META' as const;
  private readonly credentials: CredentialStore;
  private readonly request: typeof fetch;

  constructor(
    private readonly config: MetaWhatsAppConfig,
    credentialsOrRequest?: CredentialStore | typeof fetch,
    request: typeof fetch = fetch,
  ) {
    this.credentials = typeof credentialsOrRequest === 'function'
      ? new AesGcmCredentialStore(config.credentialEncryptionKey)
      : credentialsOrRequest ?? new AesGcmCredentialStore(config.credentialEncryptionKey);
    this.request = typeof credentialsOrRequest === 'function' ? credentialsOrRequest : request;
  }

  async completeExistingBusinessAppConnection(completion: {
    readonly authorizationCode: string;
    readonly phoneNumberIdHint: string | null;
    readonly whatsappBusinessAccountIdHint: string | null;
  }) {
    if (!isSafeCode(completion.authorizationCode) || !isIdentifier(completion.phoneNumberIdHint) || !isIdentifier(completion.whatsappBusinessAccountIdHint)) {
      throw new MetaProviderOperationError('PHONE_OWNERSHIP_VERIFICATION');
    }
    const token = await this.exchangeAuthorizationCode(completion.authorizationCode);
    const verified = await this.verifyPhoneInWaba(token.accessToken, completion.whatsappBusinessAccountIdHint, completion.phoneNumberIdHint);
    const expiresAt = token.expiresInSeconds === null ? null : new Date(Date.now() + token.expiresInSeconds * 1000);
    return {
      connection: {
        provider: 'META' as const,
        source: 'EXISTING_BUSINESS_APP' as const,
        externalWabaId: completion.whatsappBusinessAccountIdHint,
        externalPhoneNumberId: completion.phoneNumberIdHint,
        displayPhoneNumber: verified.displayPhoneNumber,
      },
      credential: this.credentials.prepare({ provider: 'META', accessToken: token.accessToken, expiresAt }),
    };
  }

  async validateExistingConnection(input: {
    readonly credentialReference: Parameters<CredentialStore['retrieve']>[0];
    readonly expectedWabaId: string;
    readonly expectedPhoneNumberId: string;
  }): Promise<WhatsAppConnectionValidationResult> {
    if (!isIdentifier(input.expectedWabaId) || !isIdentifier(input.expectedPhoneNumberId)) {
      return { outcome: 'CONFLICT', code: 'META_IDENTITY_CONFLICT' };
    }

    let credential: { readonly provider: 'META'; readonly accessToken: string; readonly expiresAt: Date | null };
    try {
      const resolved = await this.credentials.retrieve(input.credentialReference);
      if (!isMetaCredential(resolved)) return { outcome: 'CHECK_FAILED', code: 'CREDENTIAL_UNAVAILABLE' };
      credential = resolved;
    } catch {
      return { outcome: 'CHECK_FAILED', code: 'CREDENTIAL_UNAVAILABLE' };
    }
    if (credential.expiresAt !== null && credential.expiresAt.getTime() <= Date.now()) {
      return { outcome: 'NEEDS_REAUTH', code: 'META_CREDENTIAL_EXPIRED' };
    }

    const wabaEndpoint = new URL(`${graphOrigin}/${this.config.graphApiVersion}/${encodeURIComponent(input.expectedWabaId)}`);
    wabaEndpoint.searchParams.set('fields', 'id');
    const waba = await this.readGraph(wabaEndpoint, credential.accessToken);
    if (waba.failure !== undefined) return waba.failure;
    if (!isRecord(waba.payload) || typeof waba.payload.id !== 'string') {
      return { outcome: 'CHECK_FAILED', code: 'META_RESPONSE_INVALID' };
    }
    if (waba.payload.id !== input.expectedWabaId) {
      return { outcome: 'CONFLICT', code: 'META_IDENTITY_CONFLICT' };
    }

    const phoneEndpoint = new URL(`${graphOrigin}/${this.config.graphApiVersion}/${encodeURIComponent(input.expectedWabaId)}/phone_numbers`);
    phoneEndpoint.searchParams.set('fields', 'id,display_phone_number');
    const phones = await this.readGraph(phoneEndpoint, credential.accessToken);
    if (phones.failure !== undefined) return phones.failure;
    if (!isRecord(phones.payload) || !Array.isArray(phones.payload.data)) {
      return { outcome: 'CHECK_FAILED', code: 'META_RESPONSE_INVALID' };
    }
    const match = phones.payload.data.find((entry): entry is Record<string, unknown> => (
      isRecord(entry) && entry.id === input.expectedPhoneNumberId
    ));
    if (match === undefined) return { outcome: 'DISCONNECTED', code: 'META_ASSET_UNAVAILABLE' };

    const displayPhoneNumber = match.display_phone_number;
    return {
      outcome: 'VERIFIED',
      externalWabaId: waba.payload.id,
      externalPhoneNumberId: input.expectedPhoneNumberId,
      displayPhoneNumber: typeof displayPhoneNumber === 'string'
        && displayPhoneNumber.trim().length > 0
        && displayPhoneNumber.length <= 64
        ? displayPhoneNumber
        : null,
    };
  }

  async ensureWabaSubscribedToApp(
    input: {
      readonly credentialReference: Parameters<CredentialStore['retrieve']>[0];
      readonly expectedWabaId: string;
    },
    diagnostics: WabaSubscriptionDiagnosticReporter = noWabaSubscriptionDiagnostics,
  ): Promise<WabaSubscriptionResult> {
    try {
      if (!isIdentifier(input.expectedWabaId)) {
        throw new WhatsAppWebhookSubscriptionError('CONFIGURATION', 'META_WABA_ID_INVALID');
      }

      let credential: { readonly provider: 'META'; readonly accessToken: string; readonly expiresAt: Date | null };
      try {
        const resolved = await this.credentials.retrieve(input.credentialReference);
        if (!isMetaCredential(resolved)) {
          throw new WhatsAppWebhookSubscriptionError('CONFIGURATION', 'CREDENTIAL_UNAVAILABLE');
        }
        credential = resolved;
      } catch (error) {
        if (error instanceof WhatsAppWebhookSubscriptionError) throw error;
        throw new WhatsAppWebhookSubscriptionError('CONFIGURATION', 'CREDENTIAL_UNAVAILABLE');
      }
      if (credential.expiresAt !== null && credential.expiresAt.getTime() <= Date.now()) {
        throw new WhatsAppWebhookSubscriptionError(
          'AUTHORIZATION',
          'META_CREDENTIAL_EXPIRED',
          'META_CREDENTIAL_EXPIRED',
        );
      }

      diagnostics({ event: 'waba_subscription_check_started' });
      const endpoint = new URL(`${graphOrigin}/${this.config.graphApiVersion}/${encodeURIComponent(input.expectedWabaId)}/subscribed_apps`);
      const checkResponse = await this.requestWabaSubscription(endpoint, 'GET', credential.accessToken);
      const checkPayload = await safeJson(checkResponse);
      if (!checkResponse.ok) throw classifySubscriptionFailure(checkResponse.status, checkPayload);
      if (!hasSubscriptionData(checkPayload)) {
        throw new WhatsAppWebhookSubscriptionError('CONFIGURATION', 'META_RESPONSE_INVALID');
      }
      if (hasConfiguredAppSubscription(checkPayload, this.config.appId)) {
        diagnostics({ event: 'waba_subscription_already_present' });
        return { outcome: 'ALREADY_SUBSCRIBED' };
      }

      diagnostics({ event: 'waba_subscription_requested' });
      const subscribeResponse = await this.requestWabaSubscription(endpoint, 'POST', credential.accessToken);
      const subscribePayload = await safeJson(subscribeResponse);
      if (!subscribeResponse.ok) throw classifySubscriptionFailure(subscribeResponse.status, subscribePayload);
      if (!isRecord(subscribePayload) || subscribePayload.success !== true) {
        throw new WhatsAppWebhookSubscriptionError('CONFIGURATION', 'META_RESPONSE_INVALID');
      }
      diagnostics({ event: 'waba_subscription_succeeded' });
      return { outcome: 'SUBSCRIBED' };
    } catch (error) {
      const failure = error instanceof WhatsAppWebhookSubscriptionError
        ? error
        : new WhatsAppWebhookSubscriptionError('TRANSIENT', 'META_UNAVAILABLE');
      diagnostics({
        event: 'waba_subscription_failed',
        failureCategory: failure.category,
        providerErrorCode: failure.providerErrorCode,
      });
      throw failure;
    }
  }

  async requestCoexistenceContactSync(
    input: {
      readonly credentialReference: Parameters<CredentialStore['retrieve']>[0];
      readonly expectedPhoneNumberId: string;
    },
    diagnostics: CoexistenceContactSyncDiagnosticReporter = noCoexistenceContactSyncDiagnostics,
  ): Promise<CoexistenceContactSyncResult> {
    diagnostics({ event: 'coexistence_contact_sync_request_started' });
    try {
      const result = await this.requestCoexistenceSmbAppData(input, 'smb_app_state_sync');
      diagnostics({
        event: 'coexistence_contact_sync_request_accepted',
        providerRequestId: result.providerRequestId,
      });
      return result;
    } catch (error) {
      const failure = error instanceof CoexistenceContactSyncError
        ? error
        : new CoexistenceContactSyncError('TRANSIENT', 'META_UNAVAILABLE');
      diagnostics({
        event: 'coexistence_contact_sync_request_failed',
        failureCategory: failure.category,
        providerErrorCode: failure.providerErrorCode,
        ...(failure.providerErrorSubcode === undefined
          ? {}
          : { providerErrorSubcode: failure.providerErrorSubcode }),
      });
      throw failure;
    }
  }

  async requestCoexistenceHistorySync(
    input: {
      readonly credentialReference: Parameters<CredentialStore['retrieve']>[0];
      readonly expectedPhoneNumberId: string;
    },
    diagnostics: CoexistenceHistorySyncDiagnosticReporter = noCoexistenceHistorySyncDiagnostics,
  ): Promise<CoexistenceHistorySyncResult> {
    diagnostics({ event: 'coexistence_history_sync_request_started' });
    try {
      const result = await this.requestCoexistenceSmbAppData(input, 'history');
      diagnostics({
        event: 'coexistence_history_sync_request_accepted',
        providerRequestId: result.providerRequestId,
      });
      return result;
    } catch (error) {
      const source = error instanceof CoexistenceContactSyncError
        ? error
        : new CoexistenceContactSyncError('TRANSIENT', 'META_UNAVAILABLE');
      const failure = new CoexistenceHistorySyncError(
        source.category,
        source.providerErrorCode,
        source.providerErrorSubcode,
        source.reauthenticationCode,
      );
      diagnostics({
        event: 'coexistence_history_sync_request_failed',
        failureCategory: failure.category,
        providerErrorCode: failure.providerErrorCode,
        ...(failure.providerErrorSubcode === undefined
          ? {}
          : { providerErrorSubcode: failure.providerErrorSubcode }),
      });
      throw failure;
    }
  }

  private async requestCoexistenceSmbAppData(
    input: {
      readonly credentialReference: Parameters<CredentialStore['retrieve']>[0];
      readonly expectedPhoneNumberId: string;
    },
    syncType: 'smb_app_state_sync' | 'history',
  ): Promise<CoexistenceContactSyncResult> {
    if (!isIdentifier(input.expectedPhoneNumberId)) {
      throw new CoexistenceContactSyncError('CONFIGURATION', 'META_PHONE_NUMBER_ID_INVALID');
    }

    let credential: { readonly provider: 'META'; readonly accessToken: string; readonly expiresAt: Date | null };
    try {
      const resolved = await this.credentials.retrieve(input.credentialReference);
      if (!isMetaCredential(resolved)) {
        throw new CoexistenceContactSyncError('CONFIGURATION', 'CREDENTIAL_UNAVAILABLE');
      }
      credential = resolved;
    } catch (error) {
      if (error instanceof CoexistenceContactSyncError) throw error;
      throw new CoexistenceContactSyncError('CONFIGURATION', 'CREDENTIAL_UNAVAILABLE');
    }
    if (credential.expiresAt !== null && credential.expiresAt.getTime() <= Date.now()) {
      throw new CoexistenceContactSyncError(
        'AUTHORIZATION',
        'META_CREDENTIAL_EXPIRED',
        undefined,
        'META_CREDENTIAL_EXPIRED',
      );
    }

    const endpoint = new URL(`${graphOrigin}/${this.config.graphApiVersion}/${encodeURIComponent(input.expectedPhoneNumberId)}/smb_app_data`);
    let response: Response;
    try {
      response = await this.request(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${credential.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', sync_type: syncType }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new CoexistenceContactSyncError('TRANSIENT', 'META_UNAVAILABLE');
    }

    const payload = await safeJson(response);
    if (!response.ok) throw classifyContactSyncFailure(response.status, payload);
    if (
      !isRecord(payload)
      || payload.messaging_product !== 'whatsapp'
      || typeof payload.request_id !== 'string'
      || payload.request_id.length === 0
      || payload.request_id.length > 255
    ) {
      throw new CoexistenceContactSyncError('CONFIGURATION', 'META_RESPONSE_INVALID');
    }
    return { outcome: 'REQUESTED', providerRequestId: payload.request_id };
  }

  private async exchangeAuthorizationCode(code: string): Promise<{ readonly accessToken: string; readonly expiresInSeconds: number | null }> {
    const endpoint = new URL(`${graphOrigin}/${this.config.graphApiVersion}/oauth/access_token`);
    endpoint.searchParams.set('client_id', this.config.appId);
    endpoint.searchParams.set('client_secret', this.config.appSecret);
    endpoint.searchParams.set('code', code);
    const response = await this.send(endpoint, undefined, 'AUTHORIZATION_CODE_EXCHANGE');
    const payload = await safeJson(response);
    if (!response.ok || !isRecord(payload) || typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
      throw new MetaProviderOperationError('AUTHORIZATION_CODE_EXCHANGE');
    }
    const expiresIn = payload.expires_in;
    return {
      accessToken: payload.access_token,
      expiresInSeconds: typeof expiresIn === 'number' && Number.isInteger(expiresIn) && expiresIn > 0 ? expiresIn : null,
    };
  }

  private async verifyPhoneInWaba(accessToken: string, wabaId: string, phoneNumberId: string): Promise<{ readonly displayPhoneNumber: string | null }> {
    const endpoint = new URL(`${graphOrigin}/${this.config.graphApiVersion}/${encodeURIComponent(wabaId)}/phone_numbers`);
    endpoint.searchParams.set('fields', 'id,display_phone_number');
    const response = await this.send(endpoint, accessToken, 'PHONE_OWNERSHIP_VERIFICATION');
    const payload = await safeJson(response);
    if (!response.ok || !isRecord(payload) || !Array.isArray(payload.data)) {
      throw new MetaProviderOperationError('PHONE_OWNERSHIP_VERIFICATION');
    }
    const match = payload.data.find((entry): entry is Record<string, unknown> => isRecord(entry) && entry.id === phoneNumberId);
    if (match === undefined) throw new MetaProviderOperationError('PHONE_OWNERSHIP_VERIFICATION');
    const displayPhoneNumber = match.display_phone_number;
    return { displayPhoneNumber: typeof displayPhoneNumber === 'string' && displayPhoneNumber.trim().length > 0 && displayPhoneNumber.length <= 64 ? displayPhoneNumber : null };
  }

  private async send(
    url: URL,
    accessToken: string | undefined,
    stage: MetaProviderOperationError['stage'],
  ): Promise<Response> {
    try {
      return await this.request(url, {
        method: 'GET',
        ...(accessToken === undefined ? {} : { headers: { authorization: `Bearer ${accessToken}` } }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new MetaProviderOperationError(stage);
    }
  }

  private async readGraph(
    url: URL,
    accessToken: string,
  ): Promise<{ readonly payload: unknown; readonly failure?: Exclude<WhatsAppConnectionValidationResult, { readonly outcome: 'VERIFIED' }> }> {
    let response: Response;
    try {
      response = await this.request(url, {
        method: 'GET',
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { payload: undefined, failure: { outcome: 'CHECK_FAILED', code: 'META_UNAVAILABLE' } };
    }
    const payload = await safeJson(response);
    if (response.ok) return { payload };
    return { payload, failure: classifyValidationFailure(response.status, payload) };
  }

  private async requestWabaSubscription(
    url: URL,
    method: 'GET' | 'POST',
    accessToken: string,
  ): Promise<Response> {
    try {
      return await this.request(url, {
        method,
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new WhatsAppWebhookSubscriptionError('TRANSIENT', 'META_UNAVAILABLE');
    }
  }
}

function isSafeCode(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 4096 && !/[\r\n]/.test(value); }
function isIdentifier(value: unknown): value is string { return typeof value === 'string' && identifier.test(value); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
async function safeJson(response: Response): Promise<unknown> { try { return await response.json(); } catch { return undefined; } }

function isMetaCredential(value: unknown): value is { readonly provider: 'META'; readonly accessToken: string; readonly expiresAt: Date | null } {
  return isRecord(value)
    && value.provider === 'META'
    && typeof value.accessToken === 'string'
    && value.accessToken.length > 0
    && (value.expiresAt === null || value.expiresAt instanceof Date);
}

function hasSubscriptionData(payload: unknown): payload is { readonly data: readonly unknown[] } {
  return isRecord(payload) && Array.isArray(payload.data);
}

function hasConfiguredAppSubscription(payload: { readonly data: readonly unknown[] }, configuredAppId: string): boolean {
  return payload.data.some((entry) => {
    if (!isRecord(entry)) return false;
    if (entry.id === configuredAppId) return true;
    return isRecord(entry.whatsapp_business_api_data)
      && entry.whatsapp_business_api_data.id === configuredAppId;
  });
}

function classifySubscriptionFailure(status: number, payload: unknown): WhatsAppWebhookSubscriptionError {
  const code = graphErrorCode(payload);
  const providerCode = code === undefined ? `META_HTTP_${status}` : `META_GRAPH_${code}`;
  if (status === 429 || status >= 500 || code === 4 || code === 17 || code === 32 || code === 613) {
    return new WhatsAppWebhookSubscriptionError('TRANSIENT', providerCode);
  }
  if (status === 401 || status === 403 || code === 10 || code === 190 || code === 200) {
    return new WhatsAppWebhookSubscriptionError(
      'AUTHORIZATION',
      providerCode,
      'META_AUTHORIZATION_REJECTED',
    );
  }
  if (status === 404 || code === 100 || code === 803) {
    return new WhatsAppWebhookSubscriptionError('WABA_ACCESS', providerCode);
  }
  return new WhatsAppWebhookSubscriptionError('CONFIGURATION', providerCode);
}

function classifyValidationFailure(
  status: number,
  payload: unknown,
): Exclude<WhatsAppConnectionValidationResult, { readonly outcome: 'VERIFIED' }> {
  const code = graphErrorCode(payload);
  if (status === 429 || status >= 500 || code === 4 || code === 17 || code === 32 || code === 613) {
    const rateLimited = status === 429 || code === 4 || code === 17 || code === 32 || code === 613;
    return { outcome: 'CHECK_FAILED', code: rateLimited ? 'META_RATE_LIMITED' : 'META_UNAVAILABLE' };
  }
  if (status === 401 || status === 403 || code === 10 || code === 190 || code === 200) {
    return { outcome: 'NEEDS_REAUTH', code: 'META_AUTHORIZATION_REJECTED' };
  }
  if (status === 404 || code === 100 || code === 803) {
    return { outcome: 'DISCONNECTED', code: 'META_ASSET_UNAVAILABLE' };
  }
  return { outcome: 'CHECK_FAILED', code: 'META_RESPONSE_INVALID' };
}

function classifyContactSyncFailure(status: number, payload: unknown): CoexistenceContactSyncError {
  const code = graphErrorCode(payload);
  const subcode = graphErrorSubcode(payload);
  const providerCode = code === undefined ? `META_HTTP_${status}` : `META_GRAPH_${code}`;
  const providerSubcode = subcode === undefined ? undefined : `META_GRAPH_SUBCODE_${subcode}`;
  if (status === 429 || status >= 500 || code === 4 || code === 17 || code === 32 || code === 613) {
    return new CoexistenceContactSyncError('TRANSIENT', providerCode, providerSubcode);
  }
  if (status === 401 || code === 190) {
    return new CoexistenceContactSyncError(
      'AUTHORIZATION',
      providerCode,
      providerSubcode,
      'META_AUTHORIZATION_REJECTED',
    );
  }
  if (status === 403 || status === 404 || code === 10 || code === 200 || code === 803) {
    return new CoexistenceContactSyncError('ELIGIBILITY_OR_PERMISSION', providerCode, providerSubcode);
  }
  return new CoexistenceContactSyncError('PROVIDER_REJECTED', providerCode, providerSubcode);
}

function graphErrorCode(payload: unknown): number | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
  return typeof payload.error.code === 'number' && Number.isInteger(payload.error.code)
    ? payload.error.code
    : undefined;
}

function graphErrorSubcode(payload: unknown): number | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
  return typeof payload.error.error_subcode === 'number' && Number.isInteger(payload.error.error_subcode)
    ? payload.error.error_subcode
    : undefined;
}
