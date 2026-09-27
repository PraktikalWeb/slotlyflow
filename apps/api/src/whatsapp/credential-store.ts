import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { providerCredentials, type SlotlyFlowDatabase } from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type { WhatsAppProviderName } from './whatsapp-connection.types.js';

declare const providerCredentialReferenceBrand: unique symbol;

/** An opaque server-side pointer to credentials held by a CredentialStore. */
export type ProviderCredentialReference = string & {
  readonly [providerCredentialReferenceBrand]: 'ProviderCredentialReference';
};

/**
 * Provider adapters may handle secret material only at this boundary. M1 has
 * no store implementation and therefore cannot fall back to plaintext tokens.
 */
export interface PreparedProviderCredential {
  readonly reference: ProviderCredentialReference;
  readonly provider: WhatsAppProviderName;
  readonly encryptionVersion: 'aes-256-gcm-v1';
  readonly nonce: string;
  readonly ciphertext: string;
  readonly authenticationTag: string;
  readonly expiresAt: Date | null;
}

/**
 * The concrete store seals plaintext with AES-256-GCM before the local
 * completion transaction persists it. No plaintext reaches PostgreSQL.
 */
export interface CredentialStore {
  prepare(input: { readonly provider: WhatsAppProviderName; readonly accessToken: string; readonly expiresAt: Date | null }): PreparedProviderCredential;
  retrieve(reference: ProviderCredentialReference): Promise<unknown>;
  rotate(reference: ProviderCredentialReference, material: unknown): Promise<ProviderCredentialReference>;
  revoke(reference: ProviderCredentialReference): Promise<void>;
}

export class CredentialEncryptionError extends Error {
  constructor() {
    super('Provider credential material could not be processed.');
    this.name = 'CredentialEncryptionError';
  }
}

export class AesGcmCredentialStore implements CredentialStore {
  constructor(private readonly key: Uint8Array) {
    if (key.length !== 32) throw new CredentialEncryptionError();
  }

  prepare(input: { readonly provider: WhatsAppProviderName; readonly accessToken: string; readonly expiresAt: Date | null }): PreparedProviderCredential {
    if (typeof input.accessToken !== 'string' || input.accessToken.length === 0 || input.accessToken.length > 4096) {
      throw new CredentialEncryptionError();
    }
    try {
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
      const ciphertext = Buffer.concat([cipher.update(input.accessToken, 'utf8'), cipher.final()]);
      return {
        reference: providerCredentialReference(randomUUID()),
        provider: input.provider,
        encryptionVersion: 'aes-256-gcm-v1',
        nonce: nonce.toString('base64url'),
        ciphertext: ciphertext.toString('base64url'),
        authenticationTag: cipher.getAuthTag().toString('base64url'),
        expiresAt: input.expiresAt,
      };
    } catch {
      throw new CredentialEncryptionError();
    }
  }

  /** Server-only test/support primitive; ordinary product APIs never invoke it. */
  decrypt(prepared: PreparedProviderCredential): string {
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(prepared.nonce, 'base64url'));
      decipher.setAuthTag(Buffer.from(prepared.authenticationTag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(prepared.ciphertext, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      throw new CredentialEncryptionError();
    }
  }

  async retrieve(reference: ProviderCredentialReference): Promise<unknown> { void reference; throw new CredentialEncryptionError(); }
  async rotate(reference: ProviderCredentialReference, material: unknown): Promise<ProviderCredentialReference> { void reference; void material; throw new CredentialEncryptionError(); }
  async revoke(reference: ProviderCredentialReference): Promise<void> { void reference; }
}

/** PostgreSQL-backed credential store for server-side provider adapters only. */
export class DrizzleCredentialStore extends AesGcmCredentialStore {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase, key: Uint8Array) { super(key); }

  async store(input: { readonly organizationId: string; readonly provider: WhatsAppProviderName; readonly accessToken: string; readonly expiresAt: Date | null }): Promise<ProviderCredentialReference> {
    const prepared = this.prepare(input);
    await this.db.insert(providerCredentials).values({
      id: prepared.reference, organizationId: input.organizationId, provider: prepared.provider, encryptionVersion: prepared.encryptionVersion,
      nonce: prepared.nonce, ciphertext: prepared.ciphertext, authenticationTag: prepared.authenticationTag, expiresAt: prepared.expiresAt,
    });
    return prepared.reference;
  }

  override async retrieve(reference: ProviderCredentialReference): Promise<{ readonly provider: WhatsAppProviderName; readonly accessToken: string; readonly expiresAt: Date | null }> {
    const [row] = await this.db.select().from(providerCredentials).where(eq(providerCredentials.id, reference));
    if (row === undefined) throw new CredentialEncryptionError();
    return {
      provider: row.provider,
      accessToken: this.decrypt({ reference, provider: row.provider, encryptionVersion: 'aes-256-gcm-v1', nonce: row.nonce, ciphertext: row.ciphertext, authenticationTag: row.authenticationTag, expiresAt: row.expiresAt }),
      expiresAt: row.expiresAt,
    };
  }

  override async rotate(reference: ProviderCredentialReference, material: unknown): Promise<ProviderCredentialReference> {
    if (typeof material !== 'object' || material === null || !('accessToken' in material) || !('provider' in material)) throw new CredentialEncryptionError();
    const current = await this.retrieve(reference);
    const input = material as { provider: WhatsAppProviderName; accessToken: string; expiresAt?: Date | null };
    const replacement = this.prepare({ provider: input.provider, accessToken: input.accessToken, expiresAt: input.expiresAt ?? current.expiresAt });
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(providerCredentials).where(eq(providerCredentials.id, reference));
      if (row === undefined) throw new CredentialEncryptionError();
      await tx.insert(providerCredentials).values({ id: replacement.reference, organizationId: row.organizationId, provider: replacement.provider, encryptionVersion: replacement.encryptionVersion, nonce: replacement.nonce, ciphertext: replacement.ciphertext, authenticationTag: replacement.authenticationTag, expiresAt: replacement.expiresAt });
      await tx.delete(providerCredentials).where(eq(providerCredentials.id, reference));
    });
    return replacement.reference;
  }

  override async revoke(reference: ProviderCredentialReference): Promise<void> { await this.db.delete(providerCredentials).where(eq(providerCredentials.id, reference)); }
}

/** Creates a typed reference after structural validation, never credential material. */
export function providerCredentialReference(value: string): ProviderCredentialReference {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 255 || /[\r\n]/.test(normalized)) {
    throw new Error('Credential reference is invalid.');
  }
  return normalized as ProviderCredentialReference;
}
