import 'reflect-metadata';

import { loadApiConfig, loadDatabaseConfig } from '@slotlyflow/config';
import { createDatabaseConnection } from '@slotlyflow/database';

import { DrizzleBotDeploymentRepository } from '../bot-deployment.repository.js';
import { BotDeploymentService } from '../bot-deployment.service.js';
import { BotPublicationService } from '../bot-publication.service.js';
import {
  HandoverTestBotProvisioningService,
  HandoverTestProvisioningError,
} from '../handover-test-bot-provisioning.service.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main(): Promise<void> {
  const organizationId = argumentValue('--organization-id');
  const connectionId = argumentValue('--connection-id');
  if (!isUuid(organizationId) || !isUuid(connectionId)) {
    throw new CliError('INVALID_ARGUMENTS', 'Both --organization-id and --connection-id must be UUIDs.');
  }

  const apiConfig = loadApiConfig();
  if (apiConfig.environment !== 'development') {
    throw new CliError('UNSAFE_ENVIRONMENT', 'This command runs only when NODE_ENV is development.');
  }

  const database = createDatabaseConnection(loadDatabaseConfig());
  try {
    const repository = new DrizzleBotDeploymentRepository(database.db);
    const service = new HandoverTestBotProvisioningService(
      repository,
      new BotDeploymentService(repository),
      new BotPublicationService(repository),
    );
    const result = await service.provision({ organizationId, whatsappConnectionId: connectionId });
    process.stdout.write(`${JSON.stringify({
      level: 'info',
      code: 'READY',
      business: result.organizationName,
      organization_id: result.organizationId,
      whatsapp_connection_id: result.whatsappConnectionId,
      connection_status: result.connectionStatus,
      bot: result.definition.name,
      version: result.version.version,
      implementation: result.version.implementationKey,
      bot_deployment_id: result.deployment.id,
      deployment_status: result.deployment.status,
      publication: 'PUBLISHED',
      ready_for_inbound_whatsapp_test: true,
    })}\n`);
  } finally {
    await database.close();
  }
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return undefined;
  const value = process.argv[index + 1];
  return value === undefined || value.startsWith('--') ? undefined : value;
}

function isUuid(value: string | undefined): value is string {
  return value !== undefined && uuidPattern.test(value);
}

class CliError extends Error {
  constructor(readonly code: 'INVALID_ARGUMENTS' | 'UNSAFE_ENVIRONMENT', message: string) {
    super(message);
    this.name = 'CliError';
  }
}

void main().catch((error: unknown) => {
  const failure = safeFailure(error);
  process.stderr.write(`${JSON.stringify({ level: 'error', ...failure })}\n`);
  process.exitCode = 1;
});

function safeFailure(error: unknown): { readonly code: string; readonly message: string; readonly details?: Record<string, string> } {
  if (error instanceof HandoverTestProvisioningError) {
    return {
      code: error.code,
      message: error.code === 'MISSING_MIGRATION'
        ? 'The Bot publication migration must be applied first. Run pnpm --filter @slotlyflow/database db:migrate.'
        : 'Handover Test Bot provisioning could not safely continue.',
      ...(Object.keys(error.details).length === 0 ? {} : { details: error.details }),
    };
  }
  if (error instanceof CliError) return { code: error.code, message: error.message };
  return { code: 'PROVISIONING_FAILED', message: 'Handover Test Bot provisioning failed without exposing internal details.' };
}
