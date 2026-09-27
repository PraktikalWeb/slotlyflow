import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { auditLogs, organizations, type SlotlyFlowDatabase, whatsappConnections } from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type { ProviderCredentialReference } from './credential-store.js';
import type {
  VerifiedWhatsAppConnectionResult,
  WhatsAppConnection,
  WhatsAppConnectionStatus,
} from './whatsapp-connection.types.js';
import { mayTransitionWhatsAppConnection } from './whatsapp-connection.types.js';
import type { WhatsAppConnectionValidationResult } from './whatsapp-provider.js';

export interface WhatsAppConnectionRepository {
  /** Normal tenant reads always require an explicit Organization scope. */
  findForOrganization(organizationId: string): Promise<WhatsAppConnection | undefined>;
  /**
   * Server-side-only persistence for a result already verified by a provider
   * adapter. There is intentionally no browser-facing equivalent.
   */
  recordVerifiedForOrganization(
    actorUserId: string,
    organizationId: string,
    result: VerifiedWhatsAppConnectionResult,
  ): Promise<RecordedWhatsAppConnection>;
  reconcileValidationForOrganization(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly connectionId: string;
    readonly result: WhatsAppConnectionValidationResult;
    readonly now: Date;
  }): Promise<WhatsAppConnection>;
}

export type RecordedWhatsAppConnection =
  | { readonly outcome: 'created'; readonly connection: WhatsAppConnection }
  | { readonly outcome: 'reconnected'; readonly connection: WhatsAppConnection }
  | { readonly outcome: 'already_recorded'; readonly connection: WhatsAppConnection };

/** Required connection audit persistence failed and the database transaction rolled back. */
export class WhatsAppConnectionAuditPersistenceError extends Error {
  constructor() {
    super('WhatsApp connection audit persistence failed.');
    this.name = 'WhatsAppConnectionAuditPersistenceError';
  }
}

function connectionFromRow(row: typeof whatsappConnections.$inferSelect): WhatsAppConnection {
  return {
    id: row.id,
    organizationId: row.organizationId,
    provider: row.provider,
    connectionSource: row.connectionSource,
    connectionStatus: row.connectionStatus,
    externalWabaId: row.externalWabaId,
    externalPhoneNumberId: row.externalPhoneNumberId,
    displayPhoneNumber: row.displayPhoneNumber,
    credentialReference: row.credentialReference === null ? null : row.credentialReference as ProviderCredentialReference,
    verificationStatus: row.verificationStatus,
    lastVerifiedAt: row.lastVerifiedAt,
    lastVerificationCode: row.lastVerificationCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class DrizzleWhatsAppConnectionRepository implements WhatsAppConnectionRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  async findForOrganization(organizationId: string): Promise<WhatsAppConnection | undefined> {
    const [row] = await this.db
      .select()
      .from(whatsappConnections)
      .where(eq(whatsappConnections.organizationId, organizationId));
    return row === undefined ? undefined : connectionFromRow(row);
  }

  async recordVerifiedForOrganization(
    actorUserId: string,
    organizationId: string,
    result: VerifiedWhatsAppConnectionResult,
  ): Promise<RecordedWhatsAppConnection> {
    return this.db.transaction(async (tx) => {
      // Serializes repeated completion for one Business before its unique row is read or written.
      await tx.execute(sql`select ${organizations.id} from ${organizations} where ${organizations.id} = ${organizationId} for update`);

      const [existing] = await tx
        .select()
        .from(whatsappConnections)
        .where(eq(whatsappConnections.organizationId, organizationId));

      if (existing !== undefined) {
        const connection = connectionFromRow(existing);
        if (
          connection.provider !== result.provider ||
          connection.connectionSource !== result.source ||
          connection.externalPhoneNumberId !== result.externalPhoneNumberId
        ) {
          throw new WhatsAppOrganizationConnectionAlreadyExistsError();
        }
        if (connection.connectionStatus === 'CONNECTED') {
          return { outcome: 'already_recorded', connection };
        }
        if (!mayTransitionWhatsAppConnection(connection.connectionStatus, 'CONNECTED')) {
          throw new WhatsAppConnectionInvalidStatusTransitionError(connection.connectionStatus, 'CONNECTED');
        }

        const [reconnected] = await tx
          .update(whatsappConnections)
          .set({
            connectionStatus: 'CONNECTED',
            externalWabaId: result.externalWabaId,
            displayPhoneNumber: result.displayPhoneNumber,
            credentialReference: result.credentialReference,
            updatedAt: new Date(),
          })
          .where(and(
            eq(whatsappConnections.organizationId, organizationId),
            eq(whatsappConnections.id, connection.id),
          ))
          .returning();
        if (reconnected === undefined) throw new Error('WhatsApp connection update failed.');
        await this.insertAudit(tx, {
          organizationId,
          actorUserId,
          action: 'whatsapp.connection.status_changed',
          targetId: reconnected.id,
          metadata: { provider: result.provider, source: result.source, previousStatus: connection.connectionStatus, status: 'CONNECTED' },
        });
        return { outcome: 'reconnected', connection: connectionFromRow(reconnected) };
      }

      const [created] = await tx
        .insert(whatsappConnections)
        .values({
          organizationId,
          provider: result.provider,
          connectionSource: result.source,
          connectionStatus: 'CONNECTED',
          externalWabaId: result.externalWabaId,
          externalPhoneNumberId: result.externalPhoneNumberId,
          displayPhoneNumber: result.displayPhoneNumber,
          credentialReference: result.credentialReference,
        })
        .returning();
      if (created === undefined) throw new Error('WhatsApp connection creation failed.');
      await this.insertAudit(tx, {
        organizationId,
        actorUserId,
        action: 'whatsapp.connection.created',
        targetId: created.id,
        metadata: { provider: result.provider, source: result.source, status: 'CONNECTED' },
      });
      return { outcome: 'created', connection: connectionFromRow(created) };
    });
  }

  async reconcileValidationForOrganization(input: {
    readonly actorUserId: string;
    readonly organizationId: string;
    readonly connectionId: string;
    readonly result: WhatsAppConnectionValidationResult;
    readonly now: Date;
  }): Promise<WhatsAppConnection> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select ${organizations.id} from ${organizations} where ${organizations.id} = ${input.organizationId} for update`);
      const [stored] = await tx.select().from(whatsappConnections).where(and(
        eq(whatsappConnections.id, input.connectionId),
        eq(whatsappConnections.organizationId, input.organizationId),
      ));
      if (stored === undefined) throw new WhatsAppConnectionValidationTargetNotFoundError();

      const current = connectionFromRow(stored);
      const identityMatches = input.result.outcome !== 'VERIFIED'
        || (
          input.result.externalWabaId === current.externalWabaId
          && input.result.externalPhoneNumberId === current.externalPhoneNumberId
        );
      const effectiveResult: WhatsAppConnectionValidationResult = identityMatches
        ? input.result
        : { outcome: 'CONFLICT', code: 'META_IDENTITY_CONFLICT' };
      const nextStatus: WhatsAppConnectionStatus = effectiveResult.outcome === 'VERIFIED'
        ? 'CONNECTED'
        : effectiveResult.outcome === 'CHECK_FAILED'
          ? current.connectionStatus
          : effectiveResult.outcome;

      if (nextStatus !== current.connectionStatus && !mayTransitionWhatsAppConnection(current.connectionStatus, nextStatus)) {
        throw new WhatsAppConnectionInvalidStatusTransitionError(current.connectionStatus, nextStatus);
      }

      const [updated] = await tx.update(whatsappConnections).set({
        connectionStatus: nextStatus,
        displayPhoneNumber: effectiveResult.outcome === 'VERIFIED'
          ? effectiveResult.displayPhoneNumber
          : current.displayPhoneNumber,
        verificationStatus: effectiveResult.outcome === 'CHECK_FAILED' ? 'CHECK_FAILED' : 'VERIFIED',
        lastVerifiedAt: effectiveResult.outcome === 'CHECK_FAILED' ? current.lastVerifiedAt : input.now,
        lastVerificationCode: effectiveResult.outcome === 'VERIFIED' ? null : effectiveResult.code,
        updatedAt: input.now,
      }).where(and(
        eq(whatsappConnections.id, input.connectionId),
        eq(whatsappConnections.organizationId, input.organizationId),
      )).returning();
      if (updated === undefined) throw new WhatsAppConnectionValidationTargetNotFoundError();

      if (nextStatus !== current.connectionStatus) {
        await this.insertAudit(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'whatsapp.connection.status_changed',
          targetId: input.connectionId,
          metadata: {
            provider: current.provider,
            source: current.connectionSource,
            previousStatus: current.connectionStatus,
            status: nextStatus,
            verification: effectiveResult.outcome,
          },
        });
      }
      return connectionFromRow(updated);
    });
  }

  private async insertAudit(
    tx: SlotlyFlowDatabase,
    audit: { readonly organizationId: string; readonly actorUserId: string; readonly action: string; readonly targetId: string; readonly metadata: object },
  ): Promise<void> {
    try {
      await tx.insert(auditLogs).values({
        organizationId: audit.organizationId,
        actorUserId: audit.actorUserId,
        action: audit.action,
        targetType: 'whatsapp_connection',
        targetId: audit.targetId,
        metadata: audit.metadata,
      });
    } catch {
      throw new WhatsAppConnectionAuditPersistenceError();
    }
  }
}

/** One Business per M1 connection resource; a future multi-number design needs a migration. */
export class WhatsAppOrganizationConnectionAlreadyExistsError extends Error {
  constructor() {
    super('The Organization already has a different WhatsApp connection.');
    this.name = 'WhatsAppOrganizationConnectionAlreadyExistsError';
  }
}

export class WhatsAppConnectionInvalidStatusTransitionError extends Error {
  constructor(from: WhatsAppConnectionStatus, to: WhatsAppConnectionStatus) {
    super(`WhatsApp connection cannot transition from ${from} to ${to}.`);
    this.name = 'WhatsAppConnectionInvalidStatusTransitionError';
  }
}

export class WhatsAppConnectionValidationTargetNotFoundError extends Error {
  constructor() {
    super('The WhatsApp connection validation target is unavailable.');
    this.name = 'WhatsAppConnectionValidationTargetNotFoundError';
  }
}
