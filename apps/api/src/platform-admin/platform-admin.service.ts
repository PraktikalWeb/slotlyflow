import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PLATFORM_ADMIN_REPOSITORY } from './platform-admin.tokens.js';
import type { PlatformAdminRepository } from './platform-admin.repository.js';
import type {
  OrganizationLifecycleStatus,
  PlatformAuthorizationContext,
  PlatformPagination,
} from './platform-admin.types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PlatformAdminService {
  constructor(@Inject(PLATFORM_ADMIN_REPOSITORY) private readonly repository: PlatformAdminRepository) {}

  async listBusinesses(pageValue: unknown, pageSizeValue: unknown, searchValue: unknown): Promise<unknown> {
    const pagination = parsePagination(pageValue, pageSizeValue);
    const result = await this.repository.listBusinesses({ ...pagination, ...parseSearch(searchValue) });
    return { ...result, page: pagination.page, pageSize: pagination.pageSize };
  }

  async getBusiness(organizationId: string): Promise<unknown> {
    assertUuid(organizationId, 'PLATFORM_BUSINESS_NOT_FOUND');
    const result = await this.repository.findBusiness(organizationId);
    if (result === undefined) throw new NotFoundException({ code: 'PLATFORM_BUSINESS_NOT_FOUND' });
    return result;
  }

  async updateBusinessStatus(
    actor: PlatformAuthorizationContext,
    organizationId: string,
    body: unknown,
  ): Promise<unknown> {
    assertUuid(organizationId, 'PLATFORM_BUSINESS_NOT_FOUND');
    const status = parseBusinessStatusBody(body);
    const result = await this.repository.updateBusinessStatus({
      actorUserId: actor.user.id,
      actorRole: actor.staff.role,
      organizationId,
      status,
    });
    if (result === undefined) throw new NotFoundException({ code: 'PLATFORM_BUSINESS_NOT_FOUND' });
    return result;
  }

  async listUsers(pageValue: unknown, pageSizeValue: unknown, searchValue: unknown): Promise<unknown> {
    const pagination = parsePagination(pageValue, pageSizeValue);
    const result = await this.repository.listUsers({ ...pagination, ...parseSearch(searchValue) });
    return { ...result, page: pagination.page, pageSize: pagination.pageSize };
  }

  async getUser(userId: string): Promise<unknown> {
    assertUuid(userId, 'PLATFORM_USER_NOT_FOUND');
    const result = await this.repository.findUser(userId);
    if (result === undefined) throw new NotFoundException({ code: 'PLATFORM_USER_NOT_FOUND' });
    return result;
  }
}

export function parsePagination(pageValue: unknown, pageSizeValue: unknown): PlatformPagination {
  const page = parsePositiveInteger(pageValue, 1, 10_000);
  const pageSize = parsePositiveInteger(pageSizeValue, 25, 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function parsePositiveInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) invalid();
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) invalid();
  return number;
}

function parseSearch(value: unknown): { readonly search?: string } {
  if (value === undefined) return {};
  if (typeof value !== 'string') invalid();
  const search = value.trim();
  if (search.length === 0) return {};
  if (search.length > 120) invalid();
  return { search };
}

function parseBusinessStatusBody(value: unknown): OrganizationLifecycleStatus {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !('status' in value)) invalid();
  if (value.status !== 'ACTIVE' && value.status !== 'SUSPENDED') invalid();
  return value.status;
}

function assertUuid(value: string, code: string): void {
  if (!uuidPattern.test(value)) throw new NotFoundException({ code });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(): never {
  throw new BadRequestException({ code: 'PLATFORM_REQUEST_INVALID' });
}
