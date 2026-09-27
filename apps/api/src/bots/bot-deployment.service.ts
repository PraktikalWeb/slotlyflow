import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { BOT_DEPLOYMENT_REPOSITORY } from './bot-deployment.tokens.js';
import type { BotDeploymentRepository } from './bot-deployment.repository.js';
import type {
  BotDefinitionRecord,
  BotDeploymentConfiguration,
  BotDeploymentRecord,
  BotVersionRecord,
} from './bot-deployment.types.js';
import type { PlatformAuthorizationContext } from '../platform-admin/platform-admin.types.js';
import { isTrustedBotImplementationKey } from './trusted-bot-implementations.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const definitionKeyPattern = /^[A-Z][A-Z0-9_]{2,119}$/;
const versionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,31}$/;
const implementationKeyPattern = /^[A-Z][A-Z0-9_]{2,159}$/;
const maximumConfigurationBytes = 16_384;
const maximumConfigurationDepth = 8;

type DevelopmentProvisioningActor = { readonly userId: string; readonly role: string } | null;

@Injectable()
export class BotDeploymentService {
  constructor(@Inject(BOT_DEPLOYMENT_REPOSITORY) private readonly repository: BotDeploymentRepository) {}

  async createDefinition(actor: PlatformAuthorizationContext, body: unknown): Promise<BotDefinitionRecord> {
    return this.createDefinitionForActor(actorFromContext(actor), body);
  }

  async createDefinitionForDevelopmentProvisioning(body: unknown): Promise<BotDefinitionRecord> {
    return this.createDefinitionForActor(null, body);
  }

  private async createDefinitionForActor(actor: DevelopmentProvisioningActor, body: unknown): Promise<BotDefinitionRecord> {
    const input = parseDefinitionBody(body);
    try {
      return await this.repository.createDefinition({
        actor,
        ...input,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException({ code: 'BOT_DEFINITION_KEY_EXISTS' });
      throw error;
    }
  }

  async createPublishedVersion(actor: PlatformAuthorizationContext, botDefinitionId: string, body: unknown): Promise<BotVersionRecord> {
    return this.createPublishedVersionForActor(actorFromContext(actor), botDefinitionId, body);
  }

  async createPublishedVersionForDevelopmentProvisioning(botDefinitionId: string, body: unknown): Promise<BotVersionRecord> {
    return this.createPublishedVersionForActor(null, botDefinitionId, body);
  }

  private async createPublishedVersionForActor(
    actor: DevelopmentProvisioningActor,
    botDefinitionId: string,
    body: unknown,
  ): Promise<BotVersionRecord> {
    assertUuid(botDefinitionId, 'BOT_DEFINITION_NOT_FOUND');
    const input = parseVersionBody(body);
    try {
      const created = await this.repository.createPublishedVersion({
        actor,
        botDefinitionId,
        ...input,
      });
      if (created === undefined) throw new NotFoundException({ code: 'BOT_DEFINITION_NOT_FOUND' });
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException({ code: 'BOT_VERSION_EXISTS' });
      throw error;
    }
  }

  async createDeployment(actor: PlatformAuthorizationContext, body: unknown): Promise<BotDeploymentRecord> {
    return this.createDeploymentForActor(actorFromContext(actor), body);
  }

  async createDeploymentForDevelopmentProvisioning(body: unknown): Promise<BotDeploymentRecord> {
    return this.createDeploymentForActor(null, body);
  }

  private async createDeploymentForActor(actor: DevelopmentProvisioningActor, body: unknown): Promise<BotDeploymentRecord> {
    const input = parseCreateDeploymentBody(body);
    const result = await this.repository.createDeployment({ actor, ...input });
    if (result.outcome === 'connection_not_found') throw new NotFoundException({ code: 'WHATSAPP_CONNECTION_NOT_FOUND' });
    if (result.outcome === 'version_not_deployable') throw new ConflictException({ code: 'BOT_VERSION_NOT_DEPLOYABLE' });
    return result.deployment;
  }

  async activateDeployment(actor: PlatformAuthorizationContext, deploymentId: string): Promise<BotDeploymentRecord> {
    return this.activateDeploymentForActor(actorFromContext(actor), deploymentId);
  }

  async activateDeploymentForDevelopmentProvisioning(deploymentId: string): Promise<BotDeploymentRecord> {
    return this.activateDeploymentForActor(null, deploymentId);
  }

  private async activateDeploymentForActor(actor: DevelopmentProvisioningActor, deploymentId: string): Promise<BotDeploymentRecord> {
    assertUuid(deploymentId, 'BOT_DEPLOYMENT_NOT_FOUND');
    const result = await this.repository.activateDeployment({ actor, deploymentId });
    return mutationResult(result);
  }

  async deactivateDeployment(actor: PlatformAuthorizationContext, deploymentId: string): Promise<BotDeploymentRecord> {
    assertUuid(deploymentId, 'BOT_DEPLOYMENT_NOT_FOUND');
    const result = await this.repository.deactivateDeployment({ actor: actorFromContext(actor), deploymentId });
    return mutationResult(result);
  }

  async changeDeploymentVersion(actor: PlatformAuthorizationContext, deploymentId: string, body: unknown): Promise<BotDeploymentRecord> {
    assertUuid(deploymentId, 'BOT_DEPLOYMENT_NOT_FOUND');
    const input = parseChangeDeploymentVersionBody(body);
    const result = await this.repository.changeDeploymentVersion({
      actor: actorFromContext(actor),
      deploymentId,
      ...input,
    });
    return mutationResult(result);
  }
}

function mutationResult(result: Awaited<ReturnType<BotDeploymentRepository['activateDeployment']>>): BotDeploymentRecord {
  if (result.outcome === 'not_found') throw new NotFoundException({ code: 'BOT_DEPLOYMENT_NOT_FOUND' });
  if (result.outcome === 'connection_unavailable') throw new ConflictException({ code: 'WHATSAPP_CONNECTION_UNAVAILABLE' });
  if (result.outcome === 'version_not_deployable') throw new ConflictException({ code: 'BOT_VERSION_NOT_DEPLOYABLE' });
  return result.deployment;
}

function parseDefinitionBody(value: unknown): { readonly definitionKey: string; readonly name: string; readonly description: string | null } {
  if (!isRecord(value) || hasUnknownKeys(value, ['definitionKey', 'name', 'description'])) invalid();
  const definitionKey = parsePattern(value.definitionKey, definitionKeyPattern, 120);
  const name = parseText(value.name, 160);
  const description = value.description === undefined || value.description === null ? null : parseText(value.description, 1_000);
  return { definitionKey, name, description };
}

function parseVersionBody(value: unknown): {
  readonly version: string;
  readonly implementationKey: string;
  readonly configurationSchema: BotDeploymentConfiguration;
} {
  if (!isRecord(value) || hasUnknownKeys(value, ['version', 'implementationKey', 'configurationSchema'])) invalid();
  const implementationKey = parsePattern(value.implementationKey, implementationKeyPattern, 160);
  if (!isTrustedBotImplementationKey(implementationKey)) invalid();
  return {
    version: parsePattern(value.version, versionPattern, 32),
    implementationKey,
    configurationSchema: value.configurationSchema === undefined ? null : parseConfiguration(value.configurationSchema),
  };
}

function parseCreateDeploymentBody(value: unknown): {
  readonly organizationId: string;
  readonly whatsappConnectionId: string;
  readonly botVersionId: string;
  readonly configuration: BotDeploymentConfiguration;
} {
  if (!isRecord(value) || hasUnknownKeys(value, ['organizationId', 'whatsappConnectionId', 'botVersionId', 'configuration'])) invalid();
  const organizationId = parseUuid(value.organizationId);
  const whatsappConnectionId = parseUuid(value.whatsappConnectionId);
  const botVersionId = parseUuid(value.botVersionId);
  return {
    organizationId,
    whatsappConnectionId,
    botVersionId,
    configuration: value.configuration === undefined ? null : parseConfiguration(value.configuration),
  };
}

function parseChangeDeploymentVersionBody(value: unknown): {
  readonly botVersionId: string;
  readonly configuration?: BotDeploymentConfiguration;
} {
  if (!isRecord(value) || hasUnknownKeys(value, ['botVersionId', 'configuration'])) invalid();
  const botVersionId = parseUuid(value.botVersionId);
  return {
    botVersionId,
    ...(value.configuration === undefined ? {} : { configuration: parseConfiguration(value.configuration) }),
  };
}

function parseConfiguration(value: unknown): BotDeploymentConfiguration {
  if (value === null) return null;
  if (!isRecord(value)) invalid();
  validateJsonValue(value, 0);
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    invalid();
  }
  if (serialized.length > maximumConfigurationBytes) invalid();
  return value;
}

function validateJsonValue(value: unknown, depth: number): void {
  if (depth > maximumConfigurationDepth) invalid();
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalid();
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) validateJsonValue(item, depth + 1);
    return;
  }
  if (!isRecord(value)) invalid();
  for (const [key, item] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') invalid();
    validateJsonValue(item, depth + 1);
  }
}

function parseUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) invalid();
  return value;
}

function assertUuid(value: string, code: string): void {
  if (!uuidPattern.test(value)) throw new NotFoundException({ code });
}

function parsePattern(value: unknown, pattern: RegExp, maximumLength: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximumLength || !pattern.test(value)) invalid();
  return value;
}

function parseText(value: unknown, maximumLength: number): string {
  if (typeof value !== 'string') invalid();
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximumLength) invalid();
  return normalized;
}

function actorFromContext(context: PlatformAuthorizationContext): { readonly userId: string; readonly role: string } {
  return { userId: context.user.id, role: context.staff.role };
}

function hasUnknownKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).some((key) => !allowed.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'cause' in error
    && typeof (error as { readonly cause?: unknown }).cause === 'object'
    && (error as { readonly cause: { readonly code?: unknown } }).cause.code === '23505';
}

function invalid(): never {
  throw new BadRequestException({ code: 'BOT_DEPLOYMENT_REQUEST_INVALID' });
}
