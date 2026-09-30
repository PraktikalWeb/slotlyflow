import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
  type SlotlyFlowDatabase,
  auditLogs,
  botDefinitions,
  botDeployments,
  botVersions,
  organizations,
  whatsappConnections,
} from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type {
  BotDefinitionRecord,
  BotDeploymentConfiguration,
  BotDeploymentRecord,
  PlatformBotCatalogueDefinition,
  PlatformBotCatalogueVersion,
  PlatformBotDeploymentListItem,
  PlatformBotDeploymentListQuery,
  BotPublicationState,
  BotVersionRecord,
  ResolvedBotRuntimeMetadata,
} from './bot-deployment.types.js';
import { isTrustedBotImplementationKey } from './trusted-bot-implementations.js';

type DatabaseTransaction = Parameters<SlotlyFlowDatabase['transaction']>[0] extends (tx: infer Transaction) => unknown
  ? Transaction
  : never;

type PlatformActor = { readonly userId: string; readonly role: string } | null;

export interface ProvisioningDeploymentRecord {
  readonly deployment: BotDeploymentRecord;
  readonly definition: BotDefinitionRecord;
  readonly version: BotVersionRecord;
}

export type CreateBotDeploymentOutcome =
  | { readonly outcome: 'created'; readonly deployment: BotDeploymentRecord }
  | { readonly outcome: 'connection_not_found' }
  | { readonly outcome: 'version_not_deployable' };

export type BotDeploymentMutationOutcome =
  | { readonly outcome: 'updated'; readonly deployment: BotDeploymentRecord }
  | { readonly outcome: 'not_found' }
  | { readonly outcome: 'connection_unavailable' }
  | { readonly outcome: 'version_not_deployable' };

export type PlatformBotPublicationMutationOutcome =
  | { readonly outcome: 'updated'; readonly publication: BotPublicationState }
  | { readonly outcome: 'not_found' }
  | { readonly outcome: 'deployment_inactive' };

export interface BotDeploymentRepository {
  listCatalogue(): Promise<readonly PlatformBotCatalogueDefinition[]>;
  listDeployments(input: PlatformBotDeploymentListQuery): Promise<{
    readonly deployments: readonly PlatformBotDeploymentListItem[];
    readonly total: number;
  }>;
  createDefinition(input: {
    readonly actor: PlatformActor;
    readonly definitionKey: string;
    readonly name: string;
    readonly description: string | null;
  }): Promise<BotDefinitionRecord>;
  createPublishedVersion(input: {
    readonly actor: PlatformActor;
    readonly botDefinitionId: string;
    readonly version: string;
    readonly implementationKey: string;
    readonly configurationSchema: BotDeploymentConfiguration;
  }): Promise<BotVersionRecord | undefined>;
  createDeployment(input: {
    readonly actor: PlatformActor;
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
    readonly botVersionId: string;
    readonly configuration: BotDeploymentConfiguration;
  }): Promise<CreateBotDeploymentOutcome>;
  activateDeployment(input: {
    readonly actor: PlatformActor;
    readonly deploymentId: string;
  }): Promise<BotDeploymentMutationOutcome>;
  deactivateDeployment(input: {
    readonly actor: PlatformActor;
    readonly deploymentId: string;
  }): Promise<BotDeploymentMutationOutcome>;
  changeDeploymentVersion(input: {
    readonly actor: PlatformActor;
    readonly deploymentId: string;
    readonly botVersionId: string;
    readonly configuration?: BotDeploymentConfiguration;
  }): Promise<BotDeploymentMutationOutcome>;
  resolveActiveForTrustedConnection(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
  }): Promise<ResolvedBotRuntimeMetadata | undefined>;
  publicationForTrustedOrganization(input: {
    readonly organizationId: string;
  }): Promise<BotPublicationState | undefined>;
  setPublicationForTrustedOrganization(input: {
    readonly organizationId: string;
    readonly actorUserId: string | null;
    readonly isPublished: boolean;
  }): Promise<BotPublicationState | undefined>;
  setPublicationForPlatformDeployment(input: {
    readonly deploymentId: string;
    readonly actorUserId: string;
    readonly actorPlatformRole: string;
    readonly isPublished: boolean;
  }): Promise<PlatformBotPublicationMutationOutcome>;
  hasBotPublicationSchema(): Promise<boolean>;
  findOrganizationForProvisioning(organizationId: string): Promise<{ readonly id: string; readonly name: string } | undefined>;
  findConnectionForProvisioning(connectionId: string): Promise<{
    readonly id: string;
    readonly organizationId: string;
    readonly connectionStatus: typeof whatsappConnections.$inferSelect['connectionStatus'];
  } | undefined>;
  findDefinitionForProvisioning(definitionKey: string): Promise<BotDefinitionRecord | undefined>;
  findVersionForProvisioning(botDefinitionId: string, version: string): Promise<BotVersionRecord | undefined>;
  findDeploymentsForProvisioning(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
  }): Promise<readonly ProvisioningDeploymentRecord[]>;
}

function definitionFromRow(row: typeof botDefinitions.$inferSelect): BotDefinitionRecord {
  return row;
}

function versionFromRow(row: typeof botVersions.$inferSelect): BotVersionRecord {
  return row;
}

function deploymentFromRow(row: typeof botDeployments.$inferSelect): BotDeploymentRecord {
  return row;
}

@Injectable()
export class DrizzleBotDeploymentRepository implements BotDeploymentRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  async listCatalogue(): Promise<readonly PlatformBotCatalogueDefinition[]> {
    const rows = await this.db.select({
      definitionId: botDefinitions.id,
      definitionName: botDefinitions.name,
      definitionDescription: botDefinitions.description,
      definitionStatus: botDefinitions.status,
      definitionCreatedAt: botDefinitions.createdAt,
      definitionUpdatedAt: botDefinitions.updatedAt,
      versionId: botVersions.id,
      version: botVersions.version,
      versionStatus: botVersions.status,
      implementationKey: botVersions.implementationKey,
      configurationSchema: botVersions.configurationSchema,
      publishedAt: botVersions.publishedAt,
      versionCreatedAt: botVersions.createdAt,
    }).from(botDefinitions)
      .leftJoin(botVersions, eq(botVersions.botDefinitionId, botDefinitions.id))
      .orderBy(asc(botDefinitions.name), asc(botDefinitions.id), desc(botVersions.publishedAt));

    type MutableCatalogueDefinition = Omit<PlatformBotCatalogueDefinition, 'versions'> & {
      versions: PlatformBotCatalogueVersion[];
    };
    const definitions = new Map<string, MutableCatalogueDefinition>();
    for (const row of rows) {
      let definition = definitions.get(row.definitionId);
      if (definition === undefined) {
        definition = {
          id: row.definitionId,
          name: row.definitionName,
          description: row.definitionDescription,
          status: row.definitionStatus,
          createdAt: row.definitionCreatedAt,
          updatedAt: row.definitionUpdatedAt,
          versions: [],
        };
        definitions.set(row.definitionId, definition);
      }
      if (
        row.versionId !== null
        && row.version !== null
        && row.versionStatus !== null
        && row.implementationKey !== null
        && row.publishedAt !== null
        && row.versionCreatedAt !== null
        && isTrustedBotImplementationKey(row.implementationKey)
      ) {
        definition.versions.push({
          id: row.versionId,
          version: row.version,
          status: row.versionStatus,
          implementationKey: row.implementationKey,
          configurationSchema: row.configurationSchema,
          publishedAt: row.publishedAt,
          createdAt: row.versionCreatedAt,
        });
      }
    }
    return [...definitions.values()];
  }

  async listDeployments(input: PlatformBotDeploymentListQuery): Promise<{
    readonly deployments: readonly PlatformBotDeploymentListItem[];
    readonly total: number;
  }> {
    const condition = and(
      input.organizationId === undefined ? undefined : eq(botDeployments.organizationId, input.organizationId),
      input.botDefinitionId === undefined ? undefined : eq(botVersions.botDefinitionId, input.botDefinitionId),
      input.whatsappConnectionId === undefined ? undefined : eq(botDeployments.whatsappConnectionId, input.whatsappConnectionId),
    );
    const baseQuery = this.db.select({
      id: botDeployments.id,
      status: botDeployments.status,
      isPublished: botDeployments.isPublished,
      activatedAt: botDeployments.activatedAt,
      deactivatedAt: botDeployments.deactivatedAt,
      createdAt: botDeployments.createdAt,
      updatedAt: botDeployments.updatedAt,
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationStatus: organizations.status,
      whatsappConnectionId: whatsappConnections.id,
      displayPhoneNumber: whatsappConnections.displayPhoneNumber,
      provider: whatsappConnections.provider,
      connectionStatus: whatsappConnections.connectionStatus,
      verificationStatus: whatsappConnections.verificationStatus,
      botDefinitionId: botDefinitions.id,
      botName: botDefinitions.name,
      botVersionId: botVersions.id,
      version: botVersions.version,
      implementationKey: botVersions.implementationKey,
    }).from(botDeployments)
      .innerJoin(organizations, eq(botDeployments.organizationId, organizations.id))
      .innerJoin(whatsappConnections, and(
        eq(botDeployments.organizationId, whatsappConnections.organizationId),
        eq(botDeployments.whatsappConnectionId, whatsappConnections.id),
      ))
      .innerJoin(botVersions, eq(botDeployments.botVersionId, botVersions.id))
      .innerJoin(botDefinitions, eq(botVersions.botDefinitionId, botDefinitions.id));
    const rows = await baseQuery
      .where(condition)
      .orderBy(desc(botDeployments.updatedAt), asc(botDeployments.id))
      .limit(input.pageSize)
      .offset(input.offset);
    const [totalRow] = await this.db.select({ count: sql<number>`count(*)::int` })
      .from(botDeployments)
      .innerJoin(organizations, eq(botDeployments.organizationId, organizations.id))
      .innerJoin(whatsappConnections, and(
        eq(botDeployments.organizationId, whatsappConnections.organizationId),
        eq(botDeployments.whatsappConnectionId, whatsappConnections.id),
      ))
      .innerJoin(botVersions, eq(botDeployments.botVersionId, botVersions.id))
      .innerJoin(botDefinitions, eq(botVersions.botDefinitionId, botDefinitions.id))
      .where(condition);

    return {
      deployments: rows.map((row) => ({
        id: row.id,
        status: row.status,
        activatedAt: row.activatedAt,
        deactivatedAt: row.deactivatedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        business: {
          id: row.organizationId,
          name: row.organizationName,
          status: row.organizationStatus,
        },
        whatsappConnection: {
          id: row.whatsappConnectionId,
          organizationId: row.organizationId,
          displayPhoneNumber: row.displayPhoneNumber,
          provider: row.provider,
          status: row.connectionStatus,
          verificationStatus: row.verificationStatus,
        },
        bot: {
          definitionId: row.botDefinitionId,
          name: row.botName,
        },
        version: {
          id: row.botVersionId,
          version: row.version,
          implementationKey: row.implementationKey,
        },
        publication: {
          status: row.isPublished ? 'PUBLISHED' : 'UNPUBLISHED',
        },
      })),
      total: totalRow?.count ?? 0,
    };
  }

  async hasBotPublicationSchema(): Promise<boolean> {
    const rows = await this.db.execute(sql<{ readonly available: boolean }>`
      select exists(
        select 1
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'bot_deployments'
          and column_name = 'is_published'
      ) as available
    `);
    return rows[0]?.available === true;
  }

  async findOrganizationForProvisioning(organizationId: string): Promise<{ readonly id: string; readonly name: string } | undefined> {
    const [organization] = await this.db.select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    return organization;
  }

  async findConnectionForProvisioning(connectionId: string): Promise<{
    readonly id: string;
    readonly organizationId: string;
    readonly connectionStatus: typeof whatsappConnections.$inferSelect['connectionStatus'];
  } | undefined> {
    const [connection] = await this.db.select({
      id: whatsappConnections.id,
      organizationId: whatsappConnections.organizationId,
      connectionStatus: whatsappConnections.connectionStatus,
    }).from(whatsappConnections).where(eq(whatsappConnections.id, connectionId));
    return connection;
  }

  async findDefinitionForProvisioning(definitionKey: string): Promise<BotDefinitionRecord | undefined> {
    const [definition] = await this.db.select().from(botDefinitions)
      .where(eq(botDefinitions.definitionKey, definitionKey));
    return definition;
  }

  async findVersionForProvisioning(botDefinitionId: string, version: string): Promise<BotVersionRecord | undefined> {
    const [botVersion] = await this.db.select().from(botVersions).where(and(
      eq(botVersions.botDefinitionId, botDefinitionId),
      eq(botVersions.version, version),
    ));
    return botVersion;
  }

  async findDeploymentsForProvisioning(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
  }): Promise<readonly ProvisioningDeploymentRecord[]> {
    return this.db.select({ deployment: botDeployments, definition: botDefinitions, version: botVersions })
      .from(botDeployments)
      .innerJoin(botVersions, eq(botDeployments.botVersionId, botVersions.id))
      .innerJoin(botDefinitions, eq(botVersions.botDefinitionId, botDefinitions.id))
      .where(and(
        eq(botDeployments.organizationId, input.organizationId),
        eq(botDeployments.whatsappConnectionId, input.whatsappConnectionId),
      ));
  }

  async createDefinition(input: {
    readonly actor: PlatformActor;
    readonly definitionKey: string;
    readonly name: string;
    readonly description: string | null;
  }): Promise<BotDefinitionRecord> {
    return this.db.transaction(async (tx) => {
      const [created] = await tx.insert(botDefinitions).values({
        definitionKey: input.definitionKey,
        name: input.name,
        description: input.description,
      }).returning();
      if (created === undefined) throw new Error('Bot definition creation failed.');
      await tx.insert(auditLogs).values({
        actorUserId: input.actor?.userId ?? null,
        action: 'bot_definition.created',
        targetType: 'bot_definition',
        targetId: created.id,
        metadata: { actorPlatformRole: input.actor?.role ?? 'DEVELOPMENT_PROVISIONING', definitionKey: created.definitionKey },
      });
      return definitionFromRow(created);
    });
  }

  async createPublishedVersion(input: {
    readonly actor: PlatformActor;
    readonly botDefinitionId: string;
    readonly version: string;
    readonly implementationKey: string;
    readonly configurationSchema: BotDeploymentConfiguration;
  }): Promise<BotVersionRecord | undefined> {
    return this.db.transaction(async (tx) => {
      const [definition] = await tx.select().from(botDefinitions).where(and(
        eq(botDefinitions.id, input.botDefinitionId),
        eq(botDefinitions.status, 'ACTIVE'),
      )).for('update');
      if (definition === undefined) return undefined;
      const [created] = await tx.insert(botVersions).values({
        botDefinitionId: definition.id,
        version: input.version,
        implementationKey: input.implementationKey,
        configurationSchema: input.configurationSchema,
        publishedAt: new Date(),
      }).returning();
      if (created === undefined) throw new Error('Bot version creation failed.');
      await tx.insert(auditLogs).values({
        actorUserId: input.actor?.userId ?? null,
        action: 'bot_version.published',
        targetType: 'bot_version',
        targetId: created.id,
        metadata: {
          actorPlatformRole: input.actor?.role ?? 'DEVELOPMENT_PROVISIONING',
          botDefinitionId: created.botDefinitionId,
          version: created.version,
          implementationKey: created.implementationKey,
        },
      });
      return versionFromRow(created);
    });
  }

  async createDeployment(input: {
    readonly actor: PlatformActor;
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
    readonly botVersionId: string;
    readonly configuration: BotDeploymentConfiguration;
  }): Promise<CreateBotDeploymentOutcome> {
    return this.db.transaction(async (tx) => {
      const [connection] = await tx.select({ id: whatsappConnections.id }).from(whatsappConnections).where(and(
        eq(whatsappConnections.id, input.whatsappConnectionId),
        eq(whatsappConnections.organizationId, input.organizationId),
      )).for('update');
      if (connection === undefined) return { outcome: 'connection_not_found' };
      const version = await this.findDeployableVersion(tx, input.botVersionId);
      if (version === undefined) return { outcome: 'version_not_deployable' };
      const [created] = await tx.insert(botDeployments).values({
        organizationId: input.organizationId,
        whatsappConnectionId: connection.id,
        botVersionId: version.id,
        configuration: input.configuration,
      }).returning();
      if (created === undefined) throw new Error('Bot deployment creation failed.');
      await this.insertDeploymentAudit(tx, input.actor, 'bot_deployment.created', created, { botVersionId: created.botVersionId });
      return { outcome: 'created', deployment: deploymentFromRow(created) };
    });
  }

  async activateDeployment(input: { readonly actor: PlatformActor; readonly deploymentId: string }): Promise<BotDeploymentMutationOutcome> {
    return this.db.transaction(async (tx) => {
      const [deployment] = await tx.select().from(botDeployments).where(eq(botDeployments.id, input.deploymentId)).for('update');
      if (deployment === undefined) return { outcome: 'not_found' };
      const [connection] = await tx.select().from(whatsappConnections).where(and(
        eq(whatsappConnections.id, deployment.whatsappConnectionId),
        eq(whatsappConnections.organizationId, deployment.organizationId),
      )).for('update');
      if (connection === undefined || connection.connectionStatus !== 'CONNECTED') return { outcome: 'connection_unavailable' };
      if (await this.findDeployableVersion(tx, deployment.botVersionId) === undefined) return { outcome: 'version_not_deployable' };
      if (deployment.status === 'ACTIVE') return { outcome: 'updated', deployment: deploymentFromRow(deployment) };

      const now = new Date();
      const active = await tx.select().from(botDeployments).where(and(
        eq(botDeployments.organizationId, deployment.organizationId),
        eq(botDeployments.whatsappConnectionId, deployment.whatsappConnectionId),
        eq(botDeployments.status, 'ACTIVE'),
      )).for('update');
      for (const prior of active) {
        const [deactivated] = await tx.update(botDeployments).set({
          status: 'INACTIVE', deactivatedAt: now, updatedAt: now,
        }).where(eq(botDeployments.id, prior.id)).returning();
        if (deactivated !== undefined) {
          await this.insertDeploymentAudit(tx, input.actor, 'bot_deployment.deactivated', deactivated, { reason: 'superseded' });
        }
      }
      const [updated] = await tx.update(botDeployments).set({
        status: 'ACTIVE', activatedAt: now, deactivatedAt: null, updatedAt: now,
      }).where(and(eq(botDeployments.id, deployment.id), eq(botDeployments.status, 'INACTIVE'))).returning();
      if (updated === undefined) throw new Error('Bot deployment activation failed.');
      await this.insertDeploymentAudit(tx, input.actor, 'bot_deployment.activated', updated, {});
      return { outcome: 'updated', deployment: deploymentFromRow(updated) };
    });
  }

  async deactivateDeployment(input: { readonly actor: PlatformActor; readonly deploymentId: string }): Promise<BotDeploymentMutationOutcome> {
    return this.db.transaction(async (tx) => {
      const [deployment] = await tx.select().from(botDeployments).where(eq(botDeployments.id, input.deploymentId)).for('update');
      if (deployment === undefined) return { outcome: 'not_found' };
      const [connection] = await tx.select({ id: whatsappConnections.id }).from(whatsappConnections).where(and(
        eq(whatsappConnections.id, deployment.whatsappConnectionId),
        eq(whatsappConnections.organizationId, deployment.organizationId),
      )).for('update');
      if (connection === undefined) return { outcome: 'not_found' };
      if (deployment.status === 'INACTIVE') return { outcome: 'updated', deployment: deploymentFromRow(deployment) };
      const now = new Date();
      const [updated] = await tx.update(botDeployments).set({
        status: 'INACTIVE', deactivatedAt: now, updatedAt: now,
      }).where(and(eq(botDeployments.id, deployment.id), eq(botDeployments.status, 'ACTIVE'))).returning();
      if (updated === undefined) throw new Error('Bot deployment deactivation failed.');
      await this.insertDeploymentAudit(tx, input.actor, 'bot_deployment.deactivated', updated, { reason: 'manual' });
      return { outcome: 'updated', deployment: deploymentFromRow(updated) };
    });
  }

  async changeDeploymentVersion(input: {
    readonly actor: PlatformActor;
    readonly deploymentId: string;
    readonly botVersionId: string;
    readonly configuration?: BotDeploymentConfiguration;
  }): Promise<BotDeploymentMutationOutcome> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(botDeployments).where(eq(botDeployments.id, input.deploymentId)).for('update');
      if (current === undefined) return { outcome: 'not_found' };
      const [connection] = await tx.select().from(whatsappConnections).where(and(
        eq(whatsappConnections.id, current.whatsappConnectionId),
        eq(whatsappConnections.organizationId, current.organizationId),
      )).for('update');
      if (connection === undefined || (current.status === 'ACTIVE' && connection.connectionStatus !== 'CONNECTED')) {
        return { outcome: 'connection_unavailable' };
      }
      const version = await this.findDeployableVersion(tx, input.botVersionId);
      if (version === undefined) return { outcome: 'version_not_deployable' };
      if (current.botVersionId === version.id && input.configuration === undefined) {
        return { outcome: 'updated', deployment: deploymentFromRow(current) };
      }

      const now = new Date();
      if (current.status === 'ACTIVE') {
        const [deactivated] = await tx.update(botDeployments).set({
          status: 'INACTIVE', deactivatedAt: now, updatedAt: now,
        }).where(and(eq(botDeployments.id, current.id), eq(botDeployments.status, 'ACTIVE'))).returning();
        if (deactivated === undefined) throw new Error('Bot deployment version change could not close the prior deployment.');
        await this.insertDeploymentAudit(tx, input.actor, 'bot_deployment.deactivated', deactivated, { reason: 'version_change' });
      }
      const [successor] = await tx.insert(botDeployments).values({
        organizationId: current.organizationId,
        whatsappConnectionId: current.whatsappConnectionId,
        botVersionId: version.id,
        configuration: input.configuration === undefined ? current.configuration : input.configuration,
        status: current.status,
        activatedAt: current.status === 'ACTIVE' ? now : null,
      }).returning();
      if (successor === undefined) throw new Error('Bot deployment version successor creation failed.');
      await this.insertDeploymentAudit(tx, input.actor, 'bot_deployment.version_changed', successor, {
        previousDeploymentId: current.id,
        previousBotVersionId: current.botVersionId,
      });
      if (successor.status === 'ACTIVE') {
        await this.insertDeploymentAudit(tx, input.actor, 'bot_deployment.activated', successor, { reason: 'version_change' });
      }
      return { outcome: 'updated', deployment: deploymentFromRow(successor) };
    });
  }

  async resolveActiveForTrustedConnection(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
  }): Promise<ResolvedBotRuntimeMetadata | undefined> {
    const [row] = await this.db.select({
      deploymentId: botDeployments.id,
      organizationId: botDeployments.organizationId,
      whatsappConnectionId: botDeployments.whatsappConnectionId,
      botDefinitionId: botDefinitions.id,
      botVersionId: botVersions.id,
      implementationKey: botVersions.implementationKey,
      configuration: botDeployments.configuration,
      isPublished: botDeployments.isPublished,
    }).from(botDeployments)
      .innerJoin(botVersions, eq(botDeployments.botVersionId, botVersions.id))
      .innerJoin(botDefinitions, eq(botVersions.botDefinitionId, botDefinitions.id))
      .innerJoin(whatsappConnections, and(
        eq(botDeployments.organizationId, whatsappConnections.organizationId),
        eq(botDeployments.whatsappConnectionId, whatsappConnections.id),
      ))
      .where(and(
        eq(botDeployments.organizationId, input.organizationId),
        eq(botDeployments.whatsappConnectionId, input.whatsappConnectionId),
        eq(botDeployments.status, 'ACTIVE'),
        eq(botVersions.status, 'PUBLISHED'),
        eq(botDefinitions.status, 'ACTIVE'),
        eq(whatsappConnections.connectionStatus, 'CONNECTED'),
      ));
    return row;
  }

  async publicationForTrustedOrganization(input: {
    readonly organizationId: string;
  }): Promise<BotPublicationState | undefined> {
    const [deployment] = await this.db.select({ isPublished: botDeployments.isPublished })
      .from(botDeployments)
      .where(and(
        eq(botDeployments.organizationId, input.organizationId),
        eq(botDeployments.status, 'ACTIVE'),
      ));
    return deployment;
  }

  async setPublicationForTrustedOrganization(input: {
    readonly organizationId: string;
    readonly actorUserId: string | null;
    readonly isPublished: boolean;
  }): Promise<BotPublicationState | undefined> {
    const result = await this.setPublication({
      scope: 'organization',
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      isPublished: input.isPublished,
    });
    return result.outcome === 'updated' ? result.publication : undefined;
  }

  setPublicationForPlatformDeployment(input: {
    readonly deploymentId: string;
    readonly actorUserId: string;
    readonly actorPlatformRole: string;
    readonly isPublished: boolean;
  }): Promise<PlatformBotPublicationMutationOutcome> {
    return this.setPublication({
      scope: 'deployment',
      deploymentId: input.deploymentId,
      actorUserId: input.actorUserId,
      actorPlatformRole: input.actorPlatformRole,
      isPublished: input.isPublished,
    });
  }

  private setPublication(input: {
    readonly scope: 'organization';
    readonly organizationId: string;
    readonly actorUserId: string | null;
    readonly isPublished: boolean;
  } | {
    readonly scope: 'deployment';
    readonly deploymentId: string;
    readonly actorUserId: string;
    readonly actorPlatformRole: string;
    readonly isPublished: boolean;
  }): Promise<PlatformBotPublicationMutationOutcome> {
    return this.db.transaction(async (tx) => {
      const [deployment] = await tx.select().from(botDeployments).where(
        input.scope === 'organization'
          ? and(
            eq(botDeployments.organizationId, input.organizationId),
            eq(botDeployments.status, 'ACTIVE'),
          )
          : eq(botDeployments.id, input.deploymentId),
      ).for('update');
      if (deployment === undefined) return { outcome: 'not_found' };
      if (deployment.status !== 'ACTIVE') return { outcome: 'deployment_inactive' };
      if (deployment.isPublished === input.isPublished) {
        return { outcome: 'updated', publication: { isPublished: deployment.isPublished } };
      }

      const now = new Date();
      const [updated] = await tx.update(botDeployments).set({
        isPublished: input.isPublished,
        updatedAt: now,
      }).where(and(
        eq(botDeployments.id, deployment.id),
        eq(botDeployments.organizationId, deployment.organizationId),
        eq(botDeployments.status, 'ACTIVE'),
      )).returning();
      if (updated === undefined) throw new Error('Bot publication update failed.');
      await tx.insert(auditLogs).values({
        organizationId: updated.organizationId,
        actorUserId: input.actorUserId,
        action: updated.isPublished ? 'bot_published' : 'bot_unpublished',
        targetType: 'bot_deployment',
        targetId: updated.id,
        metadata: {
          ...(input.scope === 'deployment' ? { actorPlatformRole: input.actorPlatformRole } : {}),
          whatsappConnectionId: updated.whatsappConnectionId,
          botVersionId: updated.botVersionId,
        },
      });
      return { outcome: 'updated', publication: { isPublished: updated.isPublished } };
    });
  }

  private async findDeployableVersion(tx: DatabaseTransaction, botVersionId: string): Promise<{ readonly id: string } | undefined> {
    const [version] = await tx.select({
      id: botVersions.id,
      implementationKey: botVersions.implementationKey,
    }).from(botVersions)
      .innerJoin(botDefinitions, eq(botVersions.botDefinitionId, botDefinitions.id))
      .where(and(
        eq(botVersions.id, botVersionId),
        eq(botVersions.status, 'PUBLISHED'),
        eq(botDefinitions.status, 'ACTIVE'),
      ));
    return version !== undefined && isTrustedBotImplementationKey(version.implementationKey)
      ? { id: version.id }
      : undefined;
  }

  private async insertDeploymentAudit(
    tx: DatabaseTransaction,
    actor: PlatformActor,
    action: string,
    deployment: typeof botDeployments.$inferSelect,
    extra: Record<string, string>,
  ): Promise<void> {
    await tx.insert(auditLogs).values({
      organizationId: deployment.organizationId,
      actorUserId: actor?.userId ?? null,
      action,
      targetType: 'bot_deployment',
      targetId: deployment.id,
      metadata: {
        actorPlatformRole: actor?.role ?? 'DEVELOPMENT_PROVISIONING',
        whatsappConnectionId: deployment.whatsappConnectionId,
        botVersionId: deployment.botVersionId,
        ...extra,
      },
    });
  }
}
