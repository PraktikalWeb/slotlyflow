import type { MetaEmbeddedSignupPublicConfig } from './whatsapp-client';

const metaSdkScriptId = 'slotlyflow-meta-facebook-sdk';
const metaSdkUrl = 'https://connect.facebook.net/en_US/sdk.js';
const metaSdkLoadTimeoutMs = 10_000;
const metaSignupResultTimeoutMs = 120_000;

interface MetaFacebookSdk {
  init(options: {
    readonly appId: string;
    readonly autoLogAppEvents: boolean;
    readonly xfbml: boolean;
    readonly version: string;
  }): void;
  login(
    callback: (response: { readonly authResponse?: { readonly code?: string } }) => void,
    options: {
      readonly config_id: string;
      readonly response_type: 'code';
      readonly override_default_response_type: true;
      readonly extras: {
        readonly featureType: 'whatsapp_business_app_onboarding';
        readonly setup: Record<string, never>;
        readonly sessionInfoVersion: 3;
      };
    },
  ): void;
}

interface MetaBrowserWindow {
  FB?: MetaFacebookSdk;
  fbAsyncInit?: () => void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
}

interface MetaBrowserEnvironment {
  readonly window: MetaBrowserWindow;
  readonly document: Document;
}

export type MetaEmbeddedSignupLaunchResult =
  | {
    readonly kind: 'completed';
    readonly authorizationCode: string;
    readonly phoneNumberId: string;
    readonly whatsappBusinessAccountId: string;
  }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'error' };

/** A ready Meta SDK. `launch` must be invoked from a user-activation event. */
export interface MetaEmbeddedSignupLauncher {
  launch(): Promise<MetaEmbeddedSignupLaunchResult>;
}

type MetaSdkDiagnosticCode =
  | 'META_SDK_SCRIPT_FAILED'
  | 'META_SDK_NOT_AVAILABLE'
  | 'META_SDK_INIT_FAILED'
  | 'META_SDK_INIT_TIMEOUT';

export class MetaEmbeddedSignupError extends Error {
  constructor(readonly diagnosticCode: MetaSdkDiagnosticCode = 'META_SDK_INIT_FAILED') {
    super('Meta Embedded Signup could not be completed.');
    this.name = 'MetaEmbeddedSignupError';
  }
}

const sdkLoads = new WeakMap<Document, Promise<MetaFacebookSdk>>();
const initializedSdks = new WeakSet<object>();

function browserEnvironment(): MetaBrowserEnvironment {
  if (typeof window === 'undefined' || typeof document === 'undefined') throw new MetaEmbeddedSignupError();
  return { window, document };
}

/**
 * Loads and initializes Meta's official browser SDK once per document. The
 * `fbAsyncInit` hook is deliberately registered before the script is appended.
 */
export function loadMetaFacebookSdk(
  config: MetaEmbeddedSignupPublicConfig,
  environment: MetaBrowserEnvironment = browserEnvironment(),
): Promise<MetaFacebookSdk> {
  if (environment.window.FB !== undefined) {
    try {
      initializeMetaSdk(environment.window.FB, config);
      logMetaSdk('FB.init completed');
      logMetaSdk('ready');
      return Promise.resolve(environment.window.FB);
    } catch {
      return Promise.reject(new MetaEmbeddedSignupError());
    }
  }
  const existing = sdkLoads.get(environment.document);
  if (existing !== undefined) return existing;

  const loading = new Promise<MetaFacebookSdk>((resolve, reject) => {
    let settled = false;
    const timeout = globalThis.setTimeout(() => fail('META_SDK_INIT_TIMEOUT'), metaSdkLoadTimeoutMs);
    const finish = (operation: () => void) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      operation();
    };
    const fail = (diagnosticCode: MetaSdkDiagnosticCode) => {
      finish(() => {
        logMetaSdk(diagnosticCode);
        sdkLoads.delete(environment.document);
        reject(new MetaEmbeddedSignupError(diagnosticCode));
      });
    };
    const initialize = () => {
      if (settled) return;
      const sdk = environment.window.FB;
      if (sdk === undefined) {
        fail('META_SDK_NOT_AVAILABLE');
        return;
      }
      try {
        initializeMetaSdk(sdk, config);
        logMetaSdk('FB.init completed');
        finish(() => {
          logMetaSdk('ready');
          resolve(sdk);
        });
      } catch {
        fail('META_SDK_INIT_FAILED');
      }
    };

    // The SDK invokes this during script execution, before its load event.
    environment.window.fbAsyncInit = () => {
      logMetaSdk('fbAsyncInit fired');
      initialize();
    };

    const script = environment.document.getElementById(metaSdkScriptId) as HTMLScriptElement | null
      ?? environment.document.createElement('script');
    script.id = metaSdkScriptId;
    script.async = true;
    script.defer = true;
    script.src = metaSdkUrl;
    script.addEventListener('load', () => {
      logMetaSdk('script loaded');
      // This fallback covers an SDK that exposes FB but does not invoke the hook.
      initialize();
    }, { once: true });
    script.addEventListener('error', () => fail('META_SDK_SCRIPT_FAILED'), { once: true });
    if (!script.isConnected) {
      logMetaSdk('script requested');
      environment.document.head.append(script);
    }
  });
  sdkLoads.set(environment.document, loading);
  return loading;
}

/**
 * Loads and initializes Meta's browser SDK without opening the provider. The
 * returned launcher deliberately keeps FB.login behind a direct user action.
 */
export async function prepareMetaEmbeddedSignup(
  config: MetaEmbeddedSignupPublicConfig,
  environment: MetaBrowserEnvironment = browserEnvironment(),
): Promise<MetaEmbeddedSignupLauncher> {
  const sdk = await loadMetaFacebookSdk(config, environment);
  return { launch: () => launchPreparedMetaEmbeddedSignup(sdk, config, environment) };
}

function logMetaSdk(milestone: string): void {
  if (process.env.NODE_ENV !== 'production') console.info(`[META SDK] ${milestone}`);
}

/**
 * Keeps the authorization code and provider identifiers in memory only until
 * the authenticated SlotlyFlow completion request consumes them. This calls
 * FB.login synchronously before returning its result promise.
 */
function launchPreparedMetaEmbeddedSignup(
  sdk: MetaFacebookSdk,
  config: MetaEmbeddedSignupPublicConfig,
  environment: MetaBrowserEnvironment,
): Promise<MetaEmbeddedSignupLaunchResult> {
  return new Promise<MetaEmbeddedSignupLaunchResult>((resolve, reject) => {
    let settled = false;
    let providerResult: { readonly phoneNumberId: string; readonly whatsappBusinessAccountId: string } | undefined;
    let authorizationCode: string | undefined;

    const cleanup = () => {
      globalThis.clearTimeout(timeout);
      environment.window.removeEventListener('message', onMessage);
    };
    const settle = (result: MetaEmbeddedSignupLaunchResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new MetaEmbeddedSignupError());
    };
    const completeIfReady = () => {
      if (authorizationCode !== undefined && providerResult !== undefined) {
        logMetaSignupCompletion('Meta completion evidence correlated', {
          authorizationCodePresent: true,
          whatsappBusinessAccountIdPresent: true,
          phoneNumberIdPresent: true,
        });
        settle({ kind: 'completed', authorizationCode, ...providerResult });
      }
    };
    const onMessage = (event: MessageEvent<unknown>) => {
      const result = parseMetaMessage(event);
      if (result === undefined) return;
      if (result.kind === 'completed') {
        providerResult = result;
        completeIfReady();
      }
      else if (result.kind === 'cancelled') settle({ kind: 'cancelled' });
      else settle({ kind: 'error' });
    };
    const timeout = globalThis.setTimeout(() => settle({ kind: 'error' }), metaSignupResultTimeoutMs);

    environment.window.addEventListener('message', onMessage);
    try {
      sdk.login((response) => {
        const receivedAuthorizationCode = response.authResponse?.code;
        logMetaSignupCompletion('FB.login callback received', {
          authorizationCodePresent: typeof receivedAuthorizationCode === 'string' && receivedAuthorizationCode.length > 0,
        });
        if (typeof receivedAuthorizationCode !== 'string' || receivedAuthorizationCode.length === 0) {
          settle({ kind: 'cancelled' });
          return;
        }
        authorizationCode = receivedAuthorizationCode;
        completeIfReady();
      }, {
        config_id: config.embeddedSignupConfigurationId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          featureType: 'whatsapp_business_app_onboarding',
          setup: {},
          sessionInfoVersion: 3,
        },
      });
    } catch {
      fail();
    }
  });
}

function initializeMetaSdk(sdk: MetaFacebookSdk, config: MetaEmbeddedSignupPublicConfig): void {
  if (initializedSdks.has(sdk)) return;
  try {
    sdk.init({ appId: config.appId, autoLogAppEvents: true, xfbml: true, version: config.graphApiVersion });
    initializedSdks.add(sdk);
  } catch {
    throw new MetaEmbeddedSignupError();
  }
}

function parseMetaMessage(event: MessageEvent<unknown>):
  | { readonly kind: 'completed'; readonly phoneNumberId: string; readonly whatsappBusinessAccountId: string }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'error' }
  | undefined {
  if (!isExpectedMetaOrigin(event.origin)) return undefined;
  const payload = parseMetaMessagePayload(event.data);
  if (!isRecord(payload)) return undefined;

  const type = payload.type === 'WA_EMBEDDED_SIGNUP' ? 'WA_EMBEDDED_SIGNUP' : 'OTHER';
  const metaEventName = safeMetaEventName(payload.event);
  const normalizedEventName = metaEventName?.trim().toUpperCase();
  const data = isRecord(payload.data) ? payload.data : undefined;
  logMetaSignupCompletion('Embedded Signup message received', {
    type,
    event: metaEventName ?? 'MISSING',
    whatsappBusinessAccountIdPresent: typeof data?.waba_id === 'string' && data.waba_id.length > 0,
    phoneNumberIdPresent: typeof data?.phone_number_id === 'string' && data.phone_number_id.length > 0,
  });

  if (type !== 'WA_EMBEDDED_SIGNUP') return undefined;
  if (normalizedEventName === 'CANCEL') return { kind: 'cancelled' };
  if (normalizedEventName === 'ERROR') return { kind: 'error' };
  if (data === undefined) return undefined;
  const phoneNumberId = data.phone_number_id;
  const whatsappBusinessAccountId = data.waba_id;
  return typeof phoneNumberId === 'string' && phoneNumberId !== ''
    && typeof whatsappBusinessAccountId === 'string' && whatsappBusinessAccountId !== ''
    ? { kind: 'completed', phoneNumberId, whatsappBusinessAccountId }
    : undefined;
}

function parseMetaMessagePayload(data: unknown): unknown {
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return undefined; }
  }
  return data;
}

function safeMetaEventName(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(value) ? value : undefined;
}

/** Development-only diagnostics deliberately contain presence flags, never Meta evidence values. */
function logMetaSignupCompletion(
  message: string,
  detail: Readonly<Record<string, string | boolean>>,
): void {
  if (process.env.NODE_ENV !== 'production') console.info(`[META Embedded Signup] ${message}`, detail);
}

function isExpectedMetaOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:'
      && (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com' || host.endsWith('.fb.com'));
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
