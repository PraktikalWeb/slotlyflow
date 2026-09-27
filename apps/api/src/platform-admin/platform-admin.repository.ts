import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import {
  auditLogs,
  conversations,
  messages,
  organizationMembers,
  organizations,
  platformStaff,
  users,
  whatsappConnections,
  type SlotlyFlowDatabase,
} from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type {
  OrganizationLifecycleStatus,
  PlatformPagination,
  PlatformStaffRole,
} from './platform-admin.types.js';

interface AdminOrganizationListItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: OrganizationLifecycleStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly ownerSummary: readonly { readonly userId: string; readonly email: string; readonly status: string }[];
  readonly membershipCount: number;
  readonly whatsappConnection: undefined | {
    readonly status: string;
    readonly source: string;
    readonly displayPhoneNumber: string | null;
  };
}

interface AdminUserListItem {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly memberships: readonly {
    readonly organizationId: string;
    readonly businessName: string;
    readonly role: string;
    readonly status: string;
  }[];
  readonly platformStaff: undefined | { readonly role: string; readonly status: string };
}

export interface PlatformAdminRepository {
  listBusinesses(input: PlatformPagination & { readonly search?: string }): Promise<{ readonly businesses: readonly AdminOrganizationListItem[]; readonly total: number }>;
  findBusiness(organizationId: string): Promise<unknown | undefined>;
  updateBusinessStatus(input: {
    readonly actorUserId: string;
    readonly actorRole: PlatformStaffRole;
    readonly organizationId: string;
    readonly status: OrganizationLifecycleStatus;
  }): Promise<AdminOrganizationListItem | undefined>;
  listUsers(input: PlatformPagination & { readonly search?: string }): Promise<{ readonly users: readonly AdminUserListItem[]; readonly total: number }>;
  findUser(userId: string): Promise<AdminUserListItem | undefined>;
}

@Injectable()
export class DrizzlePlatformAdminRepository implements PlatformAdminRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  async listBusinesses(input: PlatformPagination & { readonly search?: string }): Promise<{ readonly businesses: readonly AdminOrganizationListItem[]; readonly total: number }> {
    const condition = input.search === undefined
      ? undefined
      : or(ilike(organizations.name, `%${input.search}%`), ilike(organizations.slug, `%${input.search}%`));
    const rows = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        status: organizations.status,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .where(condition)
      .orderBy(desc(organizations.createdAt), asc(organizations.id))
      .limit(input.pageSize)
      .offset(input.offset);
    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizations)
      .where(condition);
    if (rows.length === 0) return { businesses: [], total: totalRow?.count ?? 0 };

    const ids = rows.map((row) => row.id);
    const [ownerRows, membershipCountRows, connectionRows] = await Promise.all([
      this.db
        .select({
          organizationId: organizationMembers.organizationId,
          userId: users.id,
          email: users.emailNormalized,
          status: organizationMembers.status,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(and(inArray(organizationMembers.organizationId, ids), eq(organizationMembers.role, 'OWNER')))
        .orderBy(asc(organizationMembers.createdAt)),
      this.db
        .select({ organizationId: organizationMembers.organizationId, count: sql<number>`count(*)::int` })
        .from(organizationMembers)
        .where(inArray(organizationMembers.organizationId, ids))
        .groupBy(organizationMembers.organizationId),
      this.db
        .select({
          organizationId: whatsappConnections.organizationId,
          status: whatsappConnections.connectionStatus,
          source: whatsappConnections.connectionSource,
          displayPhoneNumber: whatsappConnections.displayPhoneNumber,
        })
        .from(whatsappConnections)
        .where(inArray(whatsappConnections.organizationId, ids)),
    ]);

    return {
      businesses: rows.map((row) => ({
        ...row,
        ownerSummary: ownerRows
          .filter((owner) => owner.organizationId === row.id)
          .map(({ userId, email, status }) => ({ userId, email, status })),
        membershipCount: membershipCountRows.find((item) => item.organizationId === row.id)?.count ?? 0,
        whatsappConnection: connectionRows.find((connection) => connection.organizationId === row.id),
      })),
      total: totalRow?.count ?? 0,
    };
  }

  async findBusiness(organizationId: string): Promise<unknown | undefined> {
    const [organization] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    if (organization === undefined) return undefined;

    const [memberships, connectionRows, conversationCountRows, messageCountRows] = await Promise.all([
      this.db
        .select({
          membershipId: organizationMembers.id,
          userId: users.id,
          email: users.emailNormalized,
          role: organizationMembers.role,
          status: organizationMembers.status,
          createdAt: organizationMembers.createdAt,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(eq(organizationMembers.organizationId, organizationId))
        .orderBy(asc(organizationMembers.createdAt)),
      this.db
        .select({
          id: whatsappConnections.id,
          provider: whatsappConnections.provider,
          source: whatsappConnections.connectionSource,
          status: whatsappConnections.connectionStatus,
          displayPhoneNumber: whatsappConnections.displayPhoneNumber,
          externalWabaId: whatsappConnections.externalWabaId,
          externalPhoneNumberId: whatsappConnections.externalPhoneNumberId,
          verificationStatus: whatsappConnections.verificationStatus,
          lastVerifiedAt: whatsappConnections.lastVerifiedAt,
          createdAt: whatsappConnections.createdAt,
          updatedAt: whatsappConnections.updatedAt,
        })
        .from(whatsappConnections)
        .where(eq(whatsappConnections.organizationId, organizationId)),
      this.db.select({ count: sql<number>`count(*)::int` }).from(conversations).where(eq(conversations.organizationId, organizationId)),
      this.db.select({ count: sql<number>`count(*)::int` }).from(messages).where(eq(messages.organizationId, organizationId)),
    ]);

    return {
      business: organization,
      membershipSummary: {
        total: memberships.length,
        active: memberships.filter((membership) => membership.status === 'active').length,
        members: memberships,
      },
      // M1's database constraint permits only one connection per Organization.
      whatsappConnection: connectionRows[0],
      operationalCounts: {
        conversations: conversationCountRows[0]?.count ?? 0,
        messages: messageCountRows[0]?.count ?? 0,
      },
    };
  }

  async updateBusinessStatus(input: {
    readonly actorUserId: string;
    readonly actorRole: PlatformStaffRole;
    readonly organizationId: string;
    readonly status: OrganizationLifecycleStatus;
  }): Promise<AdminOrganizationListItem | undefined> {
    const updated = await this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(organizations).where(eq(organizations.id, input.organizationId)).for('update');
      if (current === undefined) return undefined;
      if (current.status !== input.status) {
        const now = new Date();
        await tx.update(organizations).set({ status: input.status, updatedAt: now }).where(eq(organizations.id, input.organizationId));
        await tx.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          action: input.status === 'ACTIVE' ? 'organization.reactivated' : 'organization.suspended',
          targetType: 'organization',
          targetId: input.organizationId,
          metadata: {
            actorPlatformRole: input.actorRole,
            previousStatus: current.status,
            resultingStatus: input.status,
          },
        });
      }
      return true;
    });
    if (updated === undefined) return undefined;
    const [row] = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        status: organizations.status,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId));
    if (row === undefined) return undefined;
    const [ownerRows, membershipCountRows, connectionRows] = await Promise.all([
      this.db
        .select({ userId: users.id, email: users.emailNormalized, status: organizationMembers.status })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(and(eq(organizationMembers.organizationId, input.organizationId), eq(organizationMembers.role, 'OWNER')))
        .orderBy(asc(organizationMembers.createdAt)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, input.organizationId)),
      this.db
        .select({
          status: whatsappConnections.connectionStatus,
          source: whatsappConnections.connectionSource,
          displayPhoneNumber: whatsappConnections.displayPhoneNumber,
        })
        .from(whatsappConnections)
        .where(eq(whatsappConnections.organizationId, input.organizationId)),
    ]);
    return {
      ...row,
      ownerSummary: ownerRows,
      membershipCount: membershipCountRows[0]?.count ?? 0,
      whatsappConnection: connectionRows[0],
    };
  }

  async listUsers(input: PlatformPagination & { readonly search?: string }): Promise<{ readonly users: readonly AdminUserListItem[]; readonly total: number }> {
    const condition = input.search === undefined ? undefined : ilike(users.emailNormalized, `%${input.search}%`);
    const rows = await this.db
      .select({
        id: users.id,
        email: users.emailNormalized,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(condition)
      .orderBy(desc(users.createdAt), asc(users.id))
      .limit(input.pageSize)
      .offset(input.offset);
    const [totalRow] = await this.db.select({ count: sql<number>`count(*)::int` }).from(users).where(condition);
    if (rows.length === 0) return { users: [], total: totalRow?.count ?? 0 };
    const ids = rows.map((row) => row.id);
    const [membershipRows, staffRows] = await Promise.all([
      this.db
        .select({
          userId: organizationMembers.userId,
          organizationId: organizations.id,
          businessName: organizations.name,
          role: organizationMembers.role,
          status: organizationMembers.status,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
        .where(inArray(organizationMembers.userId, ids))
        .orderBy(asc(organizations.name)),
      this.db
        .select({ userId: platformStaff.userId, role: platformStaff.role, status: platformStaff.status })
        .from(platformStaff)
        .where(inArray(platformStaff.userId, ids)),
    ]);
    return {
      users: rows.map(({ emailVerifiedAt, ...row }) => ({
        ...row,
        emailVerified: emailVerifiedAt !== null,
        memberships: membershipRows
          .filter((membership) => membership.userId === row.id)
          .map(({ userId: _userId, ...membership }) => membership),
        platformStaff: staffRows.find((staff) => staff.userId === row.id),
      })),
      total: totalRow?.count ?? 0,
    };
  }

  async findUser(userId: string): Promise<AdminUserListItem | undefined> {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.emailNormalized,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (user === undefined) return undefined;
    const [memberships, staffRows] = await Promise.all([
      this.db
        .select({
          organizationId: organizations.id,
          businessName: organizations.name,
          role: organizationMembers.role,
          status: organizationMembers.status,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
        .where(eq(organizationMembers.userId, userId))
        .orderBy(asc(organizations.name)),
      this.db
        .select({ role: platformStaff.role, status: platformStaff.status })
        .from(platformStaff)
        .where(eq(platformStaff.userId, userId)),
    ]);
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      memberships,
      platformStaff: staffRows[0],
    };
  }
}
