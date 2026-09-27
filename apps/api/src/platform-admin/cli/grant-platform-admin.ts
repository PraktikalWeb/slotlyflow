import 'reflect-metadata';

import { loadDatabaseConfig } from '@slotlyflow/config';
import { createDatabaseConnection } from '@slotlyflow/database';

import { DrizzlePlatformStaffRepository } from '../platform-staff.repository.js';
import { PlatformStaffService } from '../platform-staff.service.js';

async function main(): Promise<void> {
  const email = argumentValue('--email');
  const role = argumentValue('--role');
  if (email === undefined || role === undefined) {
    throw new Error('Usage: pnpm platform-admin:grant --email user@example.com --role SUPER_ADMIN');
  }

  const database = createDatabaseConnection(loadDatabaseConfig());
  try {
    const repository = new DrizzlePlatformStaffRepository(database.db);
    const service = new PlatformStaffService(repository);
    const result = await service.bootstrapInitialSuperAdmin(email, role);
    process.stdout.write(`${JSON.stringify({
      level: 'info',
      code: result.idempotent ? 'PLATFORM_ADMIN_ALREADY_GRANTED' : 'PLATFORM_ADMIN_GRANTED',
      role: result.staff.role,
      status: result.staff.status,
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

void main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({
    level: 'error',
    code: 'PLATFORM_ADMIN_GRANT_FAILED',
    message: safeCliErrorMessage(error),
  })}\n`);
  process.exitCode = 1;
});

function safeCliErrorMessage(error: unknown): string {
  const allowedMessages = new Set([
    'Usage: pnpm platform-admin:grant --email user@example.com --role SUPER_ADMIN',
    'The initial platform administrator role must be SUPER_ADMIN.',
    'The target SlotlyFlow user does not exist.',
    'An ACTIVE SUPER_ADMIN already exists; use the authorized /admin/platform-staff API.',
  ]);
  return error instanceof Error && allowedMessages.has(error.message)
    ? error.message
    : 'Platform administrator grant failed. Review the database and migration state without exposing credentials.';
}
