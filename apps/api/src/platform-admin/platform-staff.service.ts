import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PLATFORM_STAFF_REPOSITORY } from './platform-admin.tokens.js';
import type { PlatformStaffRepository } from './platform-staff.repository.js';
import type {
  PlatformAuthorizationContext,
  PlatformPagination,
  PlatformStaffRecord,
  PlatformStaffRole,
  PlatformStaffStatus,
} from './platform-admin.types.js';

const roles = new Set<PlatformStaffRole>(['SUPER_ADMIN', 'SUPPORT', 'BILLING_ADMIN', 'OPERATIONS']);
const statuses = new Set<PlatformStaffStatus>(['ACTIVE', 'SUSPENDED']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PlatformStaffService {
  constructor(@Inject(PLATFORM_STAFF_REPOSITORY) private readonly repository: PlatformStaffRepository) {}

  list(pagination: PlatformPagination): Promise<{ readonly staff: readonly PlatformStaffRecord[]; readonly total: number }> {
    return this.repository.list(pagination);
  }

  async grant(
    actor: PlatformAuthorizationContext,
    body: unknown,
  ): Promise<PlatformStaffRecord> {
    const input = parseGrantBody(body);
    const result = await this.repository.grantExistingUser({
      actorUserId: actor.user.id,
      actorRole: actor.staff.role,
      email: input.email,
      role: input.role,
    });
    if (result.outcome === 'user_not_found') throw new NotFoundException({ code: 'PLATFORM_USER_NOT_FOUND' });
    if (result.outcome === 'already_staff') throw new ConflictException({ code: 'PLATFORM_STAFF_EXISTS' });
    return result.staff;
  }

  async update(
    actor: PlatformAuthorizationContext,
    staffId: string,
    body: unknown,
  ): Promise<PlatformStaffRecord> {
    if (!uuidPattern.test(staffId)) throw new NotFoundException({ code: 'PLATFORM_STAFF_NOT_FOUND' });
    const input = parseUpdateBody(body);
    const result = await this.repository.updateStaff({
      actorUserId: actor.user.id,
      actorRole: actor.staff.role,
      staffId,
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.status === undefined ? {} : { status: input.status }),
    });
    if (result.outcome === 'not_found') throw new NotFoundException({ code: 'PLATFORM_STAFF_NOT_FOUND' });
    if (result.outcome === 'last_active_super_admin') {
      throw new ConflictException({ code: 'FINAL_ACTIVE_SUPER_ADMIN_REQUIRED' });
    }
    return result.staff;
  }

  async bootstrapInitialSuperAdmin(emailValue: string, roleValue: string): Promise<{ readonly staff: PlatformStaffRecord; readonly idempotent: boolean }> {
    const email = normalizeEmail(emailValue);
    const role = parseRole(roleValue);
    if (role !== 'SUPER_ADMIN') throw new Error('The initial platform administrator role must be SUPER_ADMIN.');
    const result = await this.repository.bootstrapInitialSuperAdmin(email);
    if (result.outcome === 'user_not_found') throw new Error('The target SlotlyFlow user does not exist.');
    if (result.outcome === 'already_bootstrapped') throw new Error('An ACTIVE SUPER_ADMIN already exists; use the authorized /admin/platform-staff API.');
    return { staff: result.staff, idempotent: result.idempotent };
  }
}

function parseGrantBody(value: unknown): { readonly email: string; readonly role: PlatformStaffRole } {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== 'email' && key !== 'role')) invalid();
  return { email: normalizeEmail(value.email), role: parseRole(value.role) };
}

function parseUpdateBody(value: unknown): { readonly role?: PlatformStaffRole; readonly status?: PlatformStaffStatus } {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== 'role' && key !== 'status')) invalid();
  const role = value.role === undefined ? undefined : parseRole(value.role);
  const status = value.status === undefined ? undefined : parseStatus(value.status);
  if (role === undefined && status === undefined) invalid();
  return {
    ...(role === undefined ? {} : { role }),
    ...(status === undefined ? {} : { status }),
  };
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') invalid();
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 320 || !emailPattern.test(normalized)) invalid();
  return normalized;
}

function parseRole(value: unknown): PlatformStaffRole {
  if (typeof value !== 'string' || !roles.has(value as PlatformStaffRole)) invalid();
  return value as PlatformStaffRole;
}

function parseStatus(value: unknown): PlatformStaffStatus {
  if (typeof value !== 'string' || !statuses.has(value as PlatformStaffStatus)) invalid();
  return value as PlatformStaffStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(): never {
  throw new BadRequestException({ code: 'PLATFORM_REQUEST_INVALID' });
}
