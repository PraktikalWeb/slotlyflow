import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { auditLogs, platformStaff, users, type SlotlyFlowDatabase } from '@slotlyflow/database';

import { AUTH_DATABASE } from '../auth/auth.tokens.js';
import type {
  PlatformPagination,
  PlatformStaffRecord,
  PlatformStaffRole,
  PlatformStaffStatus,
} from './platform-admin.types.js';

export type GrantPlatformStaffResult =
  | { readonly outcome: 'created'; readonly staff: PlatformStaffRecord }
  | { readonly outcome: 'user_not_found' }
  | { readonly outcome: 'already_staff' };

export type UpdatePlatformStaffResult =
  | { readonly outcome: 'updated'; readonly staff: PlatformStaffRecord }
  | { readonly outcome: 'not_found' }
  | { readonly outcome: 'last_active_super_admin' };

export type BootstrapPlatformStaffResult =
  | { readonly outcome: 'created'; readonly staff: PlatformStaffRecord; readonly idempotent: boolean }
  | { readonly outcome: 'user_not_found' }
  | { readonly outcome: 'already_bootstrapped' };

export interface PlatformStaffRepository {
  findByUserId(userId: string): Promise<PlatformStaffRecord | undefined>;
  list(pagination: PlatformPagination): Promise<{ readonly staff: readonly PlatformStaffRecord[]; readonly total: number }>;
  grantExistingUser(input: {
    readonly actorUserId: string;
    readonly actorRole: PlatformStaffRole;
    readonly email: string;
    readonly role: PlatformStaffRole;
  }): Promise<GrantPlatformStaffResult>;
  updateStaff(input: {
    readonly actorUserId: string;
    readonly actorRole: PlatformStaffRole;
    readonly staffId: string;
    readonly role?: PlatformStaffRole;
    readonly status?: PlatformStaffStatus;
  }): Promise<UpdatePlatformStaffResult>;
  bootstrapInitialSuperAdmin(email: string): Promise<BootstrapPlatformStaffResult>;
}

function staffFromRow(row: {
  id: string;
  userId: string;
  email: string;
  role: PlatformStaffRole;
  status: PlatformStaffStatus;
  createdAt: Date;
  updatedAt: Date;
}): PlatformStaffRecord {
  return row;
}

const staffSelection = {
  id: platformStaff.id,
  userId: platformStaff.userId,
  email: users.emailNormalized,
  role: platformStaff.role,
  status: platformStaff.status,
  createdAt: platformStaff.createdAt,
  updatedAt: platformStaff.updatedAt,
};

@Injectable()
export class DrizzlePlatformStaffRepository implements PlatformStaffRepository {
  constructor(@Inject(AUTH_DATABASE) private readonly db: SlotlyFlowDatabase) {}

  async findByUserId(userId: string): Promise<PlatformStaffRecord | undefined> {
    const [row] = await this.db
      .select(staffSelection)
      .from(platformStaff)
      .innerJoin(users, eq(platformStaff.userId, users.id))
      .where(eq(platformStaff.userId, userId));
    return row === undefined ? undefined : staffFromRow(row);
  }

  async list(pagination: PlatformPagination): Promise<{ readonly staff: readonly PlatformStaffRecord[]; readonly total: number }> {
    const rows = await this.db
      .select(staffSelection)
      .from(platformStaff)
      .innerJoin(users, eq(platformStaff.userId, users.id))
      .orderBy(asc(platformStaff.createdAt), asc(platformStaff.id))
      .limit(pagination.pageSize)
      .offset(pagination.offset);
    const [totalRow] = await this.db.select({ count: sql<number>`count(*)::int` }).from(platformStaff);
    return { staff: rows.map(staffFromRow), total: totalRow?.count ?? 0 };
  }

  async grantExistingUser(input: {
    readonly actorUserId: string;
    readonly actorRole: PlatformStaffRole;
    readonly email: string;
    readonly role: PlatformStaffRole;
  }): Promise<GrantPlatformStaffResult> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('slotlyflow.platform_staff.administration'))`);
      const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.emailNormalized, input.email));
      if (user === undefined) return { outcome: 'user_not_found' };
      const [existing] = await tx.select({ id: platformStaff.id }).from(platformStaff).where(eq(platformStaff.userId, user.id));
      if (existing !== undefined) return { outcome: 'already_staff' };

      const [created] = await tx.insert(platformStaff).values({ userId: user.id, role: input.role }).returning();
      if (created === undefined) throw new Error('Platform staff creation failed.');
      await tx.insert(auditLogs).values({
        actorUserId: input.actorUserId,
        action: 'platform_staff.granted',
        targetType: 'platform_staff',
        targetId: created.id,
        metadata: {
          actorPlatformRole: input.actorRole,
          targetUserId: user.id,
          resultingRole: created.role,
          resultingStatus: created.status,
        },
      });
      return {
        outcome: 'created',
        staff: staffFromRow({ ...created, email: input.email }),
      };
    });
  }

  async updateStaff(input: {
    readonly actorUserId: string;
    readonly actorRole: PlatformStaffRole;
    readonly staffId: string;
    readonly role?: PlatformStaffRole;
    readonly status?: PlatformStaffStatus;
  }): Promise<UpdatePlatformStaffResult> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('slotlyflow.platform_staff.administration'))`);
      const [current] = await tx
        .select(staffSelection)
        .from(platformStaff)
        .innerJoin(users, eq(platformStaff.userId, users.id))
        .where(eq(platformStaff.id, input.staffId));
      if (current === undefined) return { outcome: 'not_found' };

      const nextRole = input.role ?? current.role;
      const nextStatus = input.status ?? current.status;
      const removesActiveSuperAdmin = current.role === 'SUPER_ADMIN'
        && current.status === 'ACTIVE'
        && (nextRole !== 'SUPER_ADMIN' || nextStatus !== 'ACTIVE');
      if (removesActiveSuperAdmin) {
        const [countRow] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(platformStaff)
          .where(and(eq(platformStaff.role, 'SUPER_ADMIN'), eq(platformStaff.status, 'ACTIVE')));
        if ((countRow?.count ?? 0) <= 1) return { outcome: 'last_active_super_admin' };
      }

      const updatedAt = new Date();
      const [updated] = await tx
        .update(platformStaff)
        .set({ role: nextRole, status: nextStatus, updatedAt })
        .where(eq(platformStaff.id, current.id))
        .returning();
      if (updated === undefined) throw new Error('Platform staff update failed.');

      if (current.role !== nextRole) {
        await tx.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          action: 'platform_staff.role_changed',
          targetType: 'platform_staff',
          targetId: current.id,
          metadata: {
            actorPlatformRole: input.actorRole,
            targetUserId: current.userId,
            previousRole: current.role,
            resultingRole: nextRole,
          },
        });
      }
      if (current.status !== nextStatus) {
        await tx.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          action: nextStatus === 'ACTIVE' ? 'platform_staff.reactivated' : 'platform_staff.suspended',
          targetType: 'platform_staff',
          targetId: current.id,
          metadata: {
            actorPlatformRole: input.actorRole,
            targetUserId: current.userId,
            previousStatus: current.status,
            resultingStatus: nextStatus,
          },
        });
      }
      return {
        outcome: 'updated',
        staff: staffFromRow({ ...updated, email: current.email }),
      };
    });
  }

  async bootstrapInitialSuperAdmin(email: string): Promise<BootstrapPlatformStaffResult> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('slotlyflow.platform_staff.administration'))`);
      const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.emailNormalized, email));
      if (user === undefined) return { outcome: 'user_not_found' };
      const [existing] = await tx.select().from(platformStaff).where(eq(platformStaff.userId, user.id));
      const [activeSuperAdmin] = await tx
        .select({ id: platformStaff.id })
        .from(platformStaff)
        .where(and(eq(platformStaff.role, 'SUPER_ADMIN'), eq(platformStaff.status, 'ACTIVE')))
        .limit(1);
      if (activeSuperAdmin !== undefined) {
        if (existing?.role === 'SUPER_ADMIN' && existing.status === 'ACTIVE') {
          return {
            outcome: 'created',
            idempotent: true,
            staff: staffFromRow({ ...existing, email }),
          };
        }
        return { outcome: 'already_bootstrapped' };
      }

      const now = new Date();
      const [record] = existing === undefined
        ? await tx.insert(platformStaff).values({ userId: user.id, role: 'SUPER_ADMIN', status: 'ACTIVE' }).returning()
        : await tx.update(platformStaff).set({ role: 'SUPER_ADMIN', status: 'ACTIVE', updatedAt: now }).where(eq(platformStaff.id, existing.id)).returning();
      if (record === undefined) throw new Error('Initial platform administrator creation failed.');
      await tx.insert(auditLogs).values({
        actorUserId: user.id,
        action: 'platform_staff.granted',
        targetType: 'platform_staff',
        targetId: record.id,
        metadata: {
          bootstrap: true,
          targetUserId: user.id,
          resultingRole: record.role,
          resultingStatus: record.status,
        },
      });
      return {
        outcome: 'created',
        idempotent: false,
        staff: staffFromRow({ ...record, email }),
      };
    });
  }
}
