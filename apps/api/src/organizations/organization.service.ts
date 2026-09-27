import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type {
  CreateOrganizationRequest,
  OrganizationMemberResponse,
  OrganizationSettingsResponse,
  UpdateOrganizationMembershipRoleRequest,
  UpdateOrganizationSettingsRequest,
} from '@slotlyflow/contracts';

import { ORGANIZATION_REPOSITORY } from './organization.tokens.js';
import { mayMutateOrganizationMembership } from './organization-permissions.js';
import {
  MembershipMutationAuditPersistenceError,
  OrganizationSettingsAuditPersistenceError,
  type OrganizationRepository,
} from './organization.repository.js';
import type {
  CreatedOrganization,
  CreateOrganizationCommand,
  MembershipMutation,
  MembershipMutationResult,
  OrganizationMemberRole,
  OrganizationBusinessDay,
  ResolvedOrganizationMembership,
  TrustedOrganizationContext,
  UpdateOrganizationSettingsCommand,
} from './organization.types.js';

const organizationNameMaximumLength = 255;
const organizationSlugMaximumLength = 120;
const organizationSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const businessDays: readonly OrganizationBusinessDay[] = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
];
const organizationSettingsKeys = new Set([
  'name', 'businessEmail', 'contactNumber', 'website', 'timezone', 'businessHours',
]);
const businessHoursKeys = new Set(['day', 'enabled', 'opensAt', 'closesAt']);

@Injectable()
export class OrganizationService {
  constructor(@Inject(ORGANIZATION_REPOSITORY) private readonly repository: OrganizationRepository) {}

  async createForAuthenticatedUser(actorUserId: string, request: CreateOrganizationRequest): Promise<CreatedOrganization> {
    const command = this.normalizeCreationRequest(request);
    try {
      return await this.repository.createWithInitialOwner(actorUserId, command);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({ code: 'ORGANIZATION_SLUG_UNAVAILABLE' });
      }
      throw error;
    }
  }

  resolveMembershipsForAuthenticatedUser(actorUserId: string): Promise<readonly ResolvedOrganizationMembership[]> {
    return this.repository.findMembershipsForUser(actorUserId);
  }

  async getOrganizationForContext(context: TrustedOrganizationContext): Promise<{
    readonly organization: OrganizationSettingsResponse;
    readonly membership: { readonly role: TrustedOrganizationContext['role']; readonly status: TrustedOrganizationContext['status'] };
  }> {
    if (this.repository.findSettingsForOrganization === undefined) {
      throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
    }
    const organization = await this.repository.findSettingsForOrganization(context.organizationId);
    if (organization === undefined) throw new NotFoundException({ code: 'ORGANIZATION_ACCESS_NOT_FOUND' });
    return {
      organization,
      membership: { role: context.role, status: context.status },
    };
  }

  async updateOrganizationSettings(
    context: TrustedOrganizationContext,
    request: UpdateOrganizationSettingsRequest,
  ): Promise<OrganizationSettingsResponse> {
    const command = this.normalizeSettingsRequest(request);
    if (this.repository.updateSettingsWithAudit === undefined) {
      throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
    }
    try {
      return await this.repository.updateSettingsWithAudit(context.userId, context.organizationId, command);
    } catch (error) {
      if (error instanceof OrganizationSettingsAuditPersistenceError) {
        throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
      }
      throw error;
    }
  }

  async listMemberships(context: TrustedOrganizationContext): Promise<readonly OrganizationMemberResponse[]> {
    const memberships = await this.repository.findMembershipsForOrganization(context.organizationId);
    return memberships.map((membership) => ({
      id: membership.id,
      user: membership.user,
      role: membership.role,
      status: membership.status,
    }));
  }

  async changeMembershipRole(
    context: TrustedOrganizationContext,
    membershipId: string,
    request: UpdateOrganizationMembershipRoleRequest,
  ): Promise<OrganizationMemberResponse> {
    if (!uuidPattern.test(membershipId) || !this.isOrganizationMemberRole(request?.role)) {
      throw new BadRequestException({ code: 'ORGANIZATION_MEMBERSHIP_INPUT_INVALID' });
    }
    return this.mutateMembership(context, membershipId, { kind: 'role', role: request.role });
  }

  deactivateMembership(context: TrustedOrganizationContext, membershipId: string): Promise<OrganizationMemberResponse> {
    if (!uuidPattern.test(membershipId)) this.membershipNotFound();
    return this.mutateMembership(context, membershipId, { kind: 'deactivate' });
  }

  private async mutateMembership(
    context: TrustedOrganizationContext,
    membershipId: string,
    mutation: MembershipMutation,
  ): Promise<OrganizationMemberResponse> {
    let result: MembershipMutationResult;
    try {
      result = await this.repository.mutateMembershipWithOwnerLock(
        context.userId,
        context.organizationId,
        membershipId,
        mutation,
        (target) => mayMutateOrganizationMembership(context.role, target, mutation),
      );
    } catch (error) {
      if (error instanceof MembershipMutationAuditPersistenceError) {
        throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
      }
      throw error;
    }
    if (result.outcome === 'not_found') this.membershipNotFound();
    if (result.outcome === 'forbidden') throw new ForbiddenException({ code: 'ORGANIZATION_PERMISSION_DENIED' });
    if (result.outcome === 'last_active_owner') {
      throw new ConflictException({ code: 'ORGANIZATION_LAST_ACTIVE_OWNER_REQUIRED' });
    }
    return {
      id: result.membership.id,
      user: result.membership.user,
      role: result.membership.role,
      status: result.membership.status,
    };
  }

  private isOrganizationMemberRole(value: unknown): value is OrganizationMemberRole {
    return value === 'OWNER' || value === 'ADMIN' || value === 'AGENT';
  }

  private membershipNotFound(): never {
    throw new NotFoundException({ code: 'ORGANIZATION_MEMBERSHIP_ACCESS_NOT_FOUND' });
  }

  private normalizeCreationRequest(request: CreateOrganizationRequest): CreateOrganizationCommand {
    if (typeof request?.name !== 'string' || typeof request?.slug !== 'string') {
      throw new BadRequestException({ code: 'ORGANIZATION_INPUT_INVALID' });
    }

    const name = request.name.trim();
    const slug = request.slug.trim().toLowerCase();
    if (
      name.length === 0 ||
      name.length > organizationNameMaximumLength ||
      slug.length === 0 ||
      slug.length > organizationSlugMaximumLength ||
      !organizationSlugPattern.test(slug)
    ) {
      throw new BadRequestException({ code: 'ORGANIZATION_INPUT_INVALID' });
    }
    return { name, slug };
  }

  private normalizeSettingsRequest(request: UpdateOrganizationSettingsRequest): UpdateOrganizationSettingsCommand {
    if (typeof request !== 'object' || request === null || Array.isArray(request)) this.settingsInputInvalid();
    const keys = Object.keys(request);
    if (keys.length !== organizationSettingsKeys.size || keys.some((key) => !organizationSettingsKeys.has(key))) {
      this.settingsInputInvalid();
    }

    if (typeof request.name !== 'string' || typeof request.timezone !== 'string' || !Array.isArray(request.businessHours)) {
      this.settingsInputInvalid();
    }
    const name = request.name.trim();
    const timezone = request.timezone.trim();
    if (name.length === 0 || name.length > organizationNameMaximumLength || timezone.length === 0 || timezone.length > 100) {
      this.settingsInputInvalid();
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
    } catch {
      this.settingsInputInvalid();
    }

    const businessEmail = this.normalizeOptionalString(request.businessEmail, 320);
    if (businessEmail !== null && !emailPattern.test(businessEmail)) this.settingsInputInvalid();
    const contactNumber = this.normalizeOptionalString(request.contactNumber, 40);
    const website = this.normalizeOptionalString(request.website, 2048);
    if (website !== null && !this.isHttpUrl(website)) this.settingsInputInvalid();

    if (request.businessHours.length !== businessDays.length) this.settingsInputInvalid();
    const seenDays = new Set<OrganizationBusinessDay>();
    const businessHours = request.businessHours.map((entry) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) this.settingsInputInvalid();
      const entryKeys = Object.keys(entry);
      if (entryKeys.length !== businessHoursKeys.size || entryKeys.some((key) => !businessHoursKeys.has(key))) {
        this.settingsInputInvalid();
      }
      if (!businessDays.includes(entry.day) || seenDays.has(entry.day) || typeof entry.enabled !== 'boolean') {
        this.settingsInputInvalid();
      }
      seenDays.add(entry.day);
      if (!entry.enabled) {
        if (entry.opensAt !== null || entry.closesAt !== null) this.settingsInputInvalid();
        return { day: entry.day, enabled: false, opensAt: null, closesAt: null } as const;
      }
      if (
        typeof entry.opensAt !== 'string' ||
        typeof entry.closesAt !== 'string' ||
        !timePattern.test(entry.opensAt) ||
        !timePattern.test(entry.closesAt) ||
        entry.opensAt >= entry.closesAt
      ) {
        this.settingsInputInvalid();
      }
      return { day: entry.day, enabled: true, opensAt: entry.opensAt, closesAt: entry.closesAt } as const;
    });

    return { name, businessEmail, contactNumber, website, timezone, businessHours };
  }

  private normalizeOptionalString(value: unknown, maximumLength: number): string | null {
    if (value === null) return null;
    if (typeof value !== 'string') this.settingsInputInvalid();
    const normalized = value.trim();
    if (normalized.length > maximumLength) this.settingsInputInvalid();
    return normalized === '' ? null : normalized;
  }

  private isHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '' && url.username === '' && url.password === '';
    } catch {
      return false;
    }
  }

  private settingsInputInvalid(): never {
    throw new BadRequestException({ code: 'ORGANIZATION_SETTINGS_INPUT_INVALID' });
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    if ('code' in error && error.code === '23505') return true;
    return 'cause' in error && this.isUniqueViolation(error.cause);
  }
}
