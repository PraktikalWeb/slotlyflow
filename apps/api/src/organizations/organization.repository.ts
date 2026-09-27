import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  organizationBusinessHours,
  organizationMembers,
  organizations,
  users,
  type SlotlyFlowDatabase,
} from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type {
  CreatedOrganization,
  CreateOrganizationCommand,
  MembershipMutation,
  MembershipMutationResult,
  OrganizationScopedMembership,
  OrganizationSettings,
  ResolvedOrganizationMembership,
  TrustedOrganizationContext,
  UpdateOrganizationSettingsCommand,
} from './organization.types.js';

/** Persistence boundary for organization creation and a user's own membership resolution. */
export interface OrganizationRepository {
  createWithInitialOwner(actorUserId: string, command: CreateOrganizationCommand): Promise<CreatedOrganization>;
  findMembershipsForUser(userId: string): Promise<readonly ResolvedOrganizationMembership[]>;
  findActiveContextForUserAndOrganization(userId: string, organizationId: string): Promise<TrustedOrganizationContext | undefined>;
  findSettingsForOrganization?(organizationId: string): Promise<OrganizationSettings | undefined>;
  updateSettingsWithAudit?(actorUserId: string, organizationId: string, command: UpdateOrganizationSettingsCommand): Promise<OrganizationSettings>;
  findMembershipsForOrganization(organizationId: string): Promise<readonly OrganizationScopedMembership[]>;
  findMembershipForOrganization(organizationId: string, membershipId: string): Promise<OrganizationScopedMembership | undefined>;
  mutateMembershipWithOwnerLock(
    actorUserId: string,
    organizationId: string,
    membershipId: string,
    mutation: MembershipMutation,
    mayMutateTarget: (target: OrganizationScopedMembership) => boolean,
  ): Promise<MembershipMutationResult>;
}

/**
 * A required membership audit record could not be persisted. The transaction
 * has been rolled back before this reaches the application service.
 */
export class MembershipMutationAuditPersistenceError extends Error {
  constructor() {
    super('Membership mutation audit persistence failed.');
    this.name = 'MembershipMutationAuditPersistenceError';
  }
}

export class OrganizationSettingsAuditPersistenceError extends Error {
  constructor() {
    super('Organization settings audit persistence failed.');
    this.name = 'OrganizationSettingsAuditPersistenceError';
  }
}

const businessDayOrder = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

function membershipFromRow(row: {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT';
  status: 'active' | 'invited' | 'disabled';
}): ResolvedOrganizationMembership {
  return {
    organization: {
      id: row.organizationId,
      name: row.organizationName,
      slug: row.organizationSlug,
    },
    role: row.role,
    status: row.status,
  };
}

function scopedMembershipFromRow(row: {
  membershipId: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  role: 'OWNER' | 'ADMIN' | 'AGENT';
  status: 'active' | 'invited' | 'disabled';
}): OrganizationScopedMembership {
  return {
    id: row.membershipId,
    organizationId: row.organizationId,
    user: { id: row.userId, email: row.userEmail },
    role: row.role,
    status: row.status,
  };
}

@Injectable()
export class DrizzleOrganizationRepository implements OrganizationRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  async createWithInitialOwner(actorUserId: string, command: CreateOrganizationCommand): Promise<CreatedOrganization> {
    return this.db.transaction(async (tx) => {
      const [organization] = await tx
        .insert(organizations)
        .values({ name: command.name, slug: command.slug })
        .returning();
      if (organization === undefined) throw new Error('Organization creation failed.');

      const [member] = await tx
        .insert(organizationMembers)
        .values({
          organizationId: organization.id,
          userId: actorUserId,
          role: 'OWNER',
          status: 'active',
        })
        .returning();
      if (member === undefined) throw new Error('Initial owner membership creation failed.');

      await tx.insert(auditLogs).values({
        organizationId: organization.id,
        actorUserId,
        action: 'organization.created',
        targetType: 'organization',
        targetId: organization.id,
        metadata: {},
      });

      const membership = membershipFromRow({
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        role: member.role,
        status: member.status,
      });
      return { organization: membership.organization, membership };
    });
  }

  async findMembershipsForUser(userId: string): Promise<readonly ResolvedOrganizationMembership[]> {
    const rows = await this.db
      .select({
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        role: organizationMembers.role,
        status: organizationMembers.status,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(and(
        eq(organizationMembers.userId, userId),
        eq(organizations.status, 'ACTIVE'),
      ))
      .orderBy(asc(organizations.createdAt), asc(organizations.id));

    return rows.map(membershipFromRow);
  }

  async findActiveContextForUserAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<TrustedOrganizationContext | undefined> {
    const [row] = await this.db
      .select({
        membershipId: organizationMembers.id,
        userId: organizationMembers.userId,
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, 'active'),
        eq(organizations.status, 'ACTIVE'),
      ));
    if (row === undefined) return undefined;
    return {
      userId: row.userId,
      organizationId: row.organizationId,
      membershipId: row.membershipId,
      role: row.role,
      status: 'active',
      organization: {
        id: row.organizationId,
        name: row.organizationName,
        slug: row.organizationSlug,
      },
    };
  }

  async findSettingsForOrganization(organizationId: string): Promise<OrganizationSettings | undefined> {
    const [organization] = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        businessEmail: organizations.businessEmail,
        contactNumber: organizations.contactNumber,
        website: organizations.website,
        timezone: organizations.timezone,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    if (organization === undefined) return undefined;

    const hours = await this.db
      .select({
        day: organizationBusinessHours.day,
        enabled: organizationBusinessHours.enabled,
        opensAt: organizationBusinessHours.opensAt,
        closesAt: organizationBusinessHours.closesAt,
      })
      .from(organizationBusinessHours)
      .where(eq(organizationBusinessHours.organizationId, organizationId));

    const byDay = new Map(hours.map((entry) => [entry.day, entry]));
    return {
      ...organization,
      businessHours: businessDayOrder.map((day) => {
        const entry = byDay.get(day);
        return entry === undefined
          ? { day, enabled: false, opensAt: null, closesAt: null }
          : {
              day,
              enabled: entry.enabled,
              opensAt: entry.opensAt?.slice(0, 5) ?? null,
              closesAt: entry.closesAt?.slice(0, 5) ?? null,
            };
      }),
    };
  }

  async updateSettingsWithAudit(
    actorUserId: string,
    organizationId: string,
    command: UpdateOrganizationSettingsCommand,
  ): Promise<OrganizationSettings> {
    return this.db.transaction(async (tx) => {
      const [organization] = await tx
        .update(organizations)
        .set({
          name: command.name,
          businessEmail: command.businessEmail,
          contactNumber: command.contactNumber,
          website: command.website,
          timezone: command.timezone,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId))
        .returning({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          businessEmail: organizations.businessEmail,
          contactNumber: organizations.contactNumber,
          website: organizations.website,
          timezone: organizations.timezone,
        });
      if (organization === undefined) throw new Error('Organization settings update failed.');

      await tx.delete(organizationBusinessHours).where(eq(organizationBusinessHours.organizationId, organizationId));
      await tx.insert(organizationBusinessHours).values(command.businessHours.map((entry) => ({
        organizationId,
        day: entry.day,
        enabled: entry.enabled,
        opensAt: entry.opensAt,
        closesAt: entry.closesAt,
      })));

      try {
        await tx.insert(auditLogs).values({
          organizationId,
          actorUserId,
          action: 'organization.settings_updated',
          targetType: 'organization',
          targetId: organizationId,
          metadata: {
            changedFields: ['name', 'businessEmail', 'contactNumber', 'website', 'timezone', 'businessHours'],
          },
        });
      } catch {
        throw new OrganizationSettingsAuditPersistenceError();
      }

      return { ...organization, businessHours: command.businessHours };
    });
  }

  async findMembershipsForOrganization(organizationId: string): Promise<readonly OrganizationScopedMembership[]> {
    const rows = await this.db
      .select({
        membershipId: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        userId: users.id,
        userEmail: users.emailNormalized,
        role: organizationMembers.role,
        status: organizationMembers.status,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, organizationId))
      .orderBy(asc(organizationMembers.createdAt), asc(organizationMembers.id));

    return rows.map(scopedMembershipFromRow);
  }

  async findMembershipForOrganization(
    organizationId: string,
    membershipId: string,
  ): Promise<OrganizationScopedMembership | undefined> {
    const [row] = await this.db
      .select({
        membershipId: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        userId: users.id,
        userEmail: users.emailNormalized,
        role: organizationMembers.role,
        status: organizationMembers.status,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.id, membershipId),
      ));

    return row === undefined ? undefined : scopedMembershipFromRow(row);
  }

  async mutateMembershipWithOwnerLock(
    actorUserId: string,
    organizationId: string,
    membershipId: string,
    mutation: MembershipMutation,
    mayMutateTarget: (target: OrganizationScopedMembership) => boolean,
  ): Promise<MembershipMutationResult> {
    return this.db.transaction(async (tx) => {
      // This row lock serializes every owner-sensitive mutation in an Organization.
      await tx.execute(sql`select ${organizations.id} from ${organizations} where ${organizations.id} = ${organizationId} for update`);

      const [targetRow] = await tx
        .select({
          membershipId: organizationMembers.id,
          organizationId: organizationMembers.organizationId,
          userId: users.id,
          userEmail: users.emailNormalized,
          role: organizationMembers.role,
          status: organizationMembers.status,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.id, membershipId),
        ));
      if (targetRow === undefined) return { outcome: 'not_found' };

      const target = scopedMembershipFromRow(targetRow);
      if (!mayMutateTarget(target)) return { outcome: 'forbidden' };

      const leavesActiveOwner = target.role === 'OWNER' && target.status === 'active' && (
        mutation.kind === 'deactivate' || (mutation.kind === 'role' && mutation.role !== 'OWNER')
      );
      if (leavesActiveOwner) {
        const activeOwners = await tx
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.role, 'OWNER'),
            eq(organizationMembers.status, 'active'),
          ));
        if (activeOwners.length <= 1) return { outcome: 'last_active_owner' };
      }

      const values = mutation.kind === 'role'
        ? { role: mutation.role, updatedAt: new Date() }
        : { status: 'disabled' as const, updatedAt: new Date() };
      await tx
        .update(organizationMembers)
        .set(values)
        .where(and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.id, membershipId),
        ));

      const resultingMembership: OrganizationScopedMembership = {
        ...target,
        role: mutation.kind === 'role' ? mutation.role : target.role,
        status: mutation.kind === 'deactivate' ? 'disabled' : target.status,
      };
      const auditAction = mutation.kind === 'role' ? 'membership.role_changed' : 'membership.deactivated';
      try {
        await tx.insert(auditLogs).values({
          organizationId,
          actorUserId,
          action: auditAction,
          targetType: 'organization_membership',
          targetId: target.id,
          metadata: {
            action: auditAction,
            organizationId,
            actorUserId,
            targetMembershipId: target.id,
            targetUserId: target.user.id,
            previous: { role: target.role, status: target.status },
            resulting: { role: resultingMembership.role, status: resultingMembership.status },
          },
        });
      } catch {
        throw new MembershipMutationAuditPersistenceError();
      }

      return {
        outcome: 'updated',
        membership: resultingMembership,
      };
    });
  }
}
