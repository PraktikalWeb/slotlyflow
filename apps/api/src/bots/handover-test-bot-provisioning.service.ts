import type { BotDeploymentRecord, BotDefinitionRecord, BotVersionRecord } from './bot-deployment.types.js';
import type { ProvisioningDeploymentRecord, BotDeploymentRepository } from './bot-deployment.repository.js';
import { BotDeploymentService } from './bot-deployment.service.js';
import { BotPublicationService } from './bot-publication.service.js';

const definitionKey = 'HANDOVER_TEST';
const definitionName = 'Handover Test Bot';
const definitionDescription = 'Trusted built-in human handover test bot';
const version = '1';
const implementationKey = 'HANDOVER_TEST_V1';

export type HandoverTestProvisioningFailureCode =
  | 'MISSING_MIGRATION'
  | 'INVALID_ORGANIZATION'
  | 'INVALID_CONNECTION'
  | 'CONNECTION_ORGANIZATION_MISMATCH'
  | 'CONNECTION_NOT_USABLE'
  | 'DEFINITION_CONFLICT'
  | 'VERSION_CONFLICT'
  | 'ACTIVE_DEPLOYMENT_CONFLICT';

export class HandoverTestProvisioningError extends Error {
  constructor(
    readonly code: HandoverTestProvisioningFailureCode,
    readonly details: Record<string, string> = {},
  ) {
    super(code);
    this.name = 'HandoverTestProvisioningError';
  }
}

export interface HandoverTestProvisioningResult {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly whatsappConnectionId: string;
  readonly connectionStatus: 'CONNECTED';
  readonly definition: BotDefinitionRecord;
  readonly version: BotVersionRecord;
  readonly deployment: BotDeploymentRecord;
}

/**
 * Development-only setup orchestration. It creates configuration records only;
 * it never calls a Bot, webhook, provider, conversation, or handover path.
 */
export class HandoverTestBotProvisioningService {
  constructor(
    private readonly repository: BotDeploymentRepository,
    private readonly deployments: BotDeploymentService,
    private readonly publications: BotPublicationService,
  ) {}

  async provision(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
  }): Promise<HandoverTestProvisioningResult> {
    if (!(await this.repository.hasBotPublicationSchema())) {
      throw new HandoverTestProvisioningError('MISSING_MIGRATION');
    }

    const organization = await this.repository.findOrganizationForProvisioning(input.organizationId);
    if (organization === undefined) throw new HandoverTestProvisioningError('INVALID_ORGANIZATION');

    const connection = await this.repository.findConnectionForProvisioning(input.whatsappConnectionId);
    if (connection === undefined) throw new HandoverTestProvisioningError('INVALID_CONNECTION');
    if (connection.organizationId !== organization.id) {
      throw new HandoverTestProvisioningError('CONNECTION_ORGANIZATION_MISMATCH');
    }
    if (connection.connectionStatus !== 'CONNECTED') {
      throw new HandoverTestProvisioningError('CONNECTION_NOT_USABLE', { connection_status: connection.connectionStatus });
    }

    const definition = await this.ensureDefinition();
    const botVersion = await this.ensureVersion(definition);
    const deployment = await this.ensureDeployment({
      organizationId: organization.id,
      whatsappConnectionId: connection.id,
      botVersion,
    });

    const activeDeployment = deployment.status === 'ACTIVE'
      ? deployment
      : await this.deployments.activateDeploymentForDevelopmentProvisioning(deployment.id);
    const publication = await this.publications.publishForDevelopmentProvisioning(organization.id);
    if (publication.status !== 'PUBLISHED') throw new Error('Publication was not enabled.');

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      whatsappConnectionId: connection.id,
      connectionStatus: 'CONNECTED',
      definition,
      version: botVersion,
      deployment: activeDeployment,
    };
  }

  private async ensureDefinition(): Promise<BotDefinitionRecord> {
    const existing = await this.repository.findDefinitionForProvisioning(definitionKey);
    if (existing !== undefined) {
      if (
        existing.name !== definitionName
        || existing.description !== definitionDescription
        || existing.status !== 'ACTIVE'
      ) {
        throw new HandoverTestProvisioningError('DEFINITION_CONFLICT', { bot_definition_id: existing.id });
      }
      return existing;
    }
    return this.deployments.createDefinitionForDevelopmentProvisioning({
      definitionKey,
      name: definitionName,
      description: definitionDescription,
    });
  }

  private async ensureVersion(definition: BotDefinitionRecord): Promise<BotVersionRecord> {
    const existing = await this.repository.findVersionForProvisioning(definition.id, version);
    if (existing !== undefined) {
      if (
        existing.implementationKey !== implementationKey
        || existing.configurationSchema !== null
        || existing.status !== 'PUBLISHED'
      ) {
        throw new HandoverTestProvisioningError('VERSION_CONFLICT', { bot_version_id: existing.id });
      }
      return existing;
    }
    return this.deployments.createPublishedVersionForDevelopmentProvisioning(definition.id, {
      version,
      implementationKey,
      configurationSchema: null,
    });
  }

  private async ensureDeployment(input: {
    readonly organizationId: string;
    readonly whatsappConnectionId: string;
    readonly botVersion: BotVersionRecord;
  }): Promise<BotDeploymentRecord> {
    const existing = await this.repository.findDeploymentsForProvisioning({
      organizationId: input.organizationId,
      whatsappConnectionId: input.whatsappConnectionId,
    });
    const active = existing.find((record) => record.deployment.status === 'ACTIVE');
    if (active !== undefined && !isExpectedDeployment(active, input.botVersion.id)) {
      throw new HandoverTestProvisioningError('ACTIVE_DEPLOYMENT_CONFLICT', activeDeploymentDetails(active));
    }

    const reusable = existing
      .filter((record) => isExpectedDeployment(record, input.botVersion.id))
      .sort((left, right) => right.deployment.createdAt.getTime() - left.deployment.createdAt.getTime())[0];
    if (reusable !== undefined) return reusable.deployment;

    return this.deployments.createDeploymentForDevelopmentProvisioning({
      organizationId: input.organizationId,
      whatsappConnectionId: input.whatsappConnectionId,
      botVersionId: input.botVersion.id,
      configuration: null,
    });
  }
}

function isExpectedDeployment(record: ProvisioningDeploymentRecord, botVersionId: string): boolean {
  return record.deployment.botVersionId === botVersionId && record.deployment.configuration === null;
}

function activeDeploymentDetails(record: ProvisioningDeploymentRecord): Record<string, string> {
  return {
    active_deployment_id: record.deployment.id,
    active_definition_key: record.definition.definitionKey,
    active_definition_name: record.definition.name,
    active_version: record.version.version,
  };
}
