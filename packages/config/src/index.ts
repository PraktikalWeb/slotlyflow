export type RuntimeEnvironment = 'development' | 'test' | 'production';

export interface ApiConfig {
  readonly environment: RuntimeEnvironment;
  readonly host: string;
  readonly port: number;
  readonly requestBodyLimitBytes: number;
  readonly cors: {
    readonly enabled: boolean;
    readonly origins: readonly string[];
  };
}

export interface DatabaseConfig {
  readonly url: string;
  readonly pool: {
    readonly maxConnections: number;
  };
}

export interface AuthenticationConfig {
  readonly session: {
    readonly cookieName: string;
    readonly lifetimeSeconds: number;
    readonly secure: boolean;
    readonly sameSite: 'lax' | 'strict';
  };
  readonly argon2: { readonly memoryCost: number; readonly timeCost: number; readonly parallelism: number };
  readonly email: EmailDeliveryConfig;
  readonly googleOidc?: GoogleOidcConfig;
}

export type EmailDeliveryConfig =
  | { readonly provider: 'disabled' }
  | {
      readonly provider: 'smtp';
      readonly webAppUrl: string;
      readonly from: { readonly address: string; readonly name: string };
      readonly smtp: {
        readonly host: string;
        readonly port: number;
        readonly secure: boolean;
        readonly username?: string;
        readonly password?: string;
      };
    };

export interface GoogleOidcConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly webAppUrl: string;
}

/**
 * Server-owned configuration for Meta WhatsApp Embedded Signup. The app
 * secret is intentionally never part of the browser-facing configuration.
 */
export interface MetaWhatsAppConfig {
  readonly appId: string;
  readonly appSecret: string;
  readonly embeddedSignupConfigurationId: string;
  readonly graphApiVersion: string;
  /** Server-only shared value used only to answer Meta's webhook challenge. */
  readonly webhookVerifyToken: string;
  /** Server-only 256-bit key for authenticated credential encryption. */
  readonly credentialEncryptionKey: Uint8Array;
}

const runtimeEnvironments = new Set<RuntimeEnvironment>(['development', 'test', 'production']);
const maximumRequestBodyBytes = 1_048_576;

function readOptional(environment: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = environment[name];
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  return value;
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 3001;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error('PORT must be a whole number between 1 and 65535.');
  }

  const port = Number(value);
  if (port < 1 || port > 65_535) {
    throw new Error('PORT must be a whole number between 1 and 65535.');
  }

  return port;
}

function parseBodyLimit(value: string | undefined): number {
  if (value === undefined) {
    return maximumRequestBodyBytes;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error('REQUEST_BODY_LIMIT_BYTES must be a positive whole number.');
  }

  const limit = Number(value);
  if (limit < 1 || limit > maximumRequestBodyBytes) {
    throw new Error(`REQUEST_BODY_LIMIT_BYTES must be between 1 and ${maximumRequestBodyBytes}.`);
  }

  return limit;
}

function parseCorsOrigins(value: string | undefined): readonly string[] {
  if (value === undefined) {
    return [];
  }

  const origins = value.split(',').map((origin) => origin.trim());
  if (origins.some((origin) => origin === '')) {
    throw new Error('CORS_ORIGINS must be a comma-separated list of absolute HTTP(S) origins.');
  }

  return origins.map((origin) => {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('CORS_ORIGINS must be a comma-separated list of absolute HTTP(S) origins.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('CORS_ORIGINS must be a comma-separated list of absolute HTTP(S) origins.');
    }

    return parsed.origin;
  });
}

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const nodeEnvironment = readOptional(environment, 'NODE_ENV') ?? 'development';
  if (!runtimeEnvironments.has(nodeEnvironment as RuntimeEnvironment)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const corsOrigins = parseCorsOrigins(readOptional(environment, 'CORS_ORIGINS'));

  return {
    environment: nodeEnvironment as RuntimeEnvironment,
    host: readOptional(environment, 'HOST') ?? '127.0.0.1',
    port: parsePort(readOptional(environment, 'PORT')),
    requestBodyLimitBytes: parseBodyLimit(readOptional(environment, 'REQUEST_BODY_LIMIT_BYTES')),
    cors: {
      enabled: corsOrigins.length > 0,
      origins: corsOrigins,
    },
  };
}

export function loadDatabaseConfig(environment: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const databaseUrl = readOptional(environment, 'DATABASE_URL');
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
  }

  const poolValue = readOptional(environment, 'DATABASE_POOL_MAX');
  if (poolValue !== undefined && !/^\d+$/.test(poolValue)) {
    throw new Error('DATABASE_POOL_MAX must be a whole number between 1 and 100.');
  }

  const maxConnections = poolValue === undefined ? 10 : Number(poolValue);
  if (maxConnections < 1 || maxConnections > 100) {
    throw new Error('DATABASE_POOL_MAX must be a whole number between 1 and 100.');
  }

  return {
    url: databaseUrl,
    pool: { maxConnections },
  };
}

export function loadAuthenticationConfig(environment: NodeJS.ProcessEnv = process.env): AuthenticationConfig {
  const production = (readOptional(environment, 'NODE_ENV') ?? 'development') === 'production';
  const webAppUrlValue = readOptional(environment, 'WEB_APP_URL');
  const webAppUrl = webAppUrlValue === undefined ? undefined : validateAbsoluteHttpUrl(webAppUrlValue, 'WEB_APP_URL');
  const googleOidc = loadGoogleOidcConfig(environment, webAppUrl);
  const sessionLifetime = Number(readOptional(environment, 'AUTH_SESSION_LIFETIME_SECONDS') ?? '1209600');
  if (!Number.isInteger(sessionLifetime) || sessionLifetime < 300 || sessionLifetime > 2_592_000) {
    throw new Error('AUTH_SESSION_LIFETIME_SECONDS must be a whole number between 300 and 2592000.');
  }
  return {
    session: {
      cookieName: readOptional(environment, 'AUTH_SESSION_COOKIE_NAME') ?? 'slotlyflow_session',
      lifetimeSeconds: sessionLifetime,
      secure: production || readOptional(environment, 'AUTH_SESSION_COOKIE_SECURE') === 'true',
      sameSite: 'lax',
    },
    argon2: { memoryCost: 19_456, timeCost: 2, parallelism: 1 },
    email: loadEmailDeliveryConfig(environment, production, webAppUrl),
    ...(googleOidc === undefined ? {} : { googleOidc }),
  };
}

/**
 * Meta Embedded Signup is optional until an Organization starts onboarding,
 * but a partially configured provider is unsafe and fails at startup.
 */
export function loadMetaWhatsAppConfig(environment: NodeJS.ProcessEnv = process.env): MetaWhatsAppConfig | undefined {
  const appId = readOptional(environment, 'META_APP_ID');
  const appSecret = readOptional(environment, 'META_APP_SECRET');
  const embeddedSignupConfigurationId = readOptional(environment, 'META_EMBEDDED_SIGNUP_CONFIG_ID');
  const graphApiVersion = readOptional(environment, 'META_GRAPH_API_VERSION');
  const webhookVerifyToken = readOptional(environment, 'META_WHATSAPP_WEBHOOK_VERIFY_TOKEN');
  const credentialEncryptionKey = readOptional(environment, 'PROVIDER_CREDENTIAL_ENCRYPTION_KEY');
  const values = [appId, appSecret, embeddedSignupConfigurationId, graphApiVersion, webhookVerifyToken, credentialEncryptionKey];

  if (values.every((value) => value === undefined)) return undefined;
  if (values.some((value) => value === undefined)) {
    throw new Error('META_APP_ID, META_APP_SECRET, META_EMBEDDED_SIGNUP_CONFIG_ID, META_GRAPH_API_VERSION, META_WHATSAPP_WEBHOOK_VERIFY_TOKEN, and PROVIDER_CREDENTIAL_ENCRYPTION_KEY must be configured together.');
  }
  if (!/^\d{1,32}$/.test(appId as string)) throw new Error('META_APP_ID must be a numeric Meta application identifier.');
  if (!/^\d{1,32}$/.test(embeddedSignupConfigurationId as string)) {
    throw new Error('META_EMBEDDED_SIGNUP_CONFIG_ID must be a numeric Embedded Signup configuration identifier.');
  }
  if (!/^v\d+\.\d+$/.test(graphApiVersion as string)) {
    throw new Error('META_GRAPH_API_VERSION must use the vNN.NN format.');
  }
  if (!/^[\x21-\x7e]{16,512}$/.test(webhookVerifyToken as string)) {
    throw new Error('META_WHATSAPP_WEBHOOK_VERIFY_TOKEN must be a 16-512 character printable server-only verification value.');
  }
  const decodedEncryptionKey = Buffer.from(credentialEncryptionKey as string, 'base64url');
  if (decodedEncryptionKey.length !== 32) {
    throw new Error('PROVIDER_CREDENTIAL_ENCRYPTION_KEY must be a base64url-encoded 256-bit key.');
  }

  return {
    appId: appId as string,
    appSecret: appSecret as string,
    embeddedSignupConfigurationId: embeddedSignupConfigurationId as string,
    graphApiVersion: graphApiVersion as string,
    webhookVerifyToken: webhookVerifyToken as string,
    credentialEncryptionKey: decodedEncryptionKey,
  };
}

function loadGoogleOidcConfig(environment: NodeJS.ProcessEnv, webAppUrl: string | undefined): GoogleOidcConfig | undefined {
  const clientId = readOptional(environment, 'GOOGLE_OIDC_CLIENT_ID');
  const clientSecret = readOptional(environment, 'GOOGLE_OIDC_CLIENT_SECRET');
  const redirectUri = readOptional(environment, 'GOOGLE_OIDC_REDIRECT_URI');
  const googleValues = [clientId, clientSecret, redirectUri];

  if (googleValues.every((value) => value === undefined)) return undefined;
  if (googleValues.some((value) => value === undefined) || webAppUrl === undefined) {
    throw new Error('GOOGLE_OIDC_CLIENT_ID, GOOGLE_OIDC_CLIENT_SECRET, GOOGLE_OIDC_REDIRECT_URI, and WEB_APP_URL must be configured together.');
  }

  return {
    clientId: clientId as string,
    clientSecret: clientSecret as string,
    redirectUri: validateAbsoluteHttpUrl(redirectUri as string, 'GOOGLE_OIDC_REDIRECT_URI'),
    webAppUrl: webAppUrl as string,
  };
}

function loadEmailDeliveryConfig(
  environment: NodeJS.ProcessEnv,
  production: boolean,
  webAppUrl: string | undefined,
): EmailDeliveryConfig {
  const provider = readOptional(environment, 'EMAIL_PROVIDER');
  if (provider === undefined || provider === 'disabled') {
    if (production) throw new Error('EMAIL_PROVIDER must be configured in production.');
    return { provider: 'disabled' };
  }
  if (provider !== 'smtp') throw new Error('EMAIL_PROVIDER must be smtp or disabled.');
  if (webAppUrl === undefined) throw new Error('WEB_APP_URL is required when EMAIL_PROVIDER is smtp.');

  const host = readOptional(environment, 'SMTP_HOST');
  const fromAddress = readOptional(environment, 'EMAIL_FROM_ADDRESS');
  if (host === undefined) throw new Error('SMTP_HOST is required when EMAIL_PROVIDER is smtp.');
  if (fromAddress === undefined || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress)) {
    throw new Error('EMAIL_FROM_ADDRESS must be a valid email address when EMAIL_PROVIDER is smtp.');
  }

  const portValue = readOptional(environment, 'SMTP_PORT') ?? '1025';
  if (!/^\d+$/.test(portValue) || Number(portValue) < 1 || Number(portValue) > 65_535) {
    throw new Error('SMTP_PORT must be a whole number between 1 and 65535.');
  }
  const secureValue = readOptional(environment, 'SMTP_SECURE') ?? 'false';
  if (secureValue !== 'true' && secureValue !== 'false') throw new Error('SMTP_SECURE must be true or false.');

  const username = readOptional(environment, 'SMTP_USER');
  const password = readOptional(environment, 'SMTP_PASSWORD');
  if ((username === undefined) !== (password === undefined)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together.');
  }

  const fromName = readOptional(environment, 'EMAIL_FROM_NAME') ?? 'SlotlyFlow';
  if (/[\r\n]/.test(fromName)) throw new Error('EMAIL_FROM_NAME must not contain line breaks.');

  return {
    provider: 'smtp',
    webAppUrl,
    from: { address: fromAddress, name: fromName },
    smtp: {
      host,
      port: Number(portValue),
      secure: secureValue === 'true',
      ...(username === undefined ? {} : { username, password: password as string }),
    },
  };
}

function validateAbsoluteHttpUrl(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
  return parsed.toString();
}
