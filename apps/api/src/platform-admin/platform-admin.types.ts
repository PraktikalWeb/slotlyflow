export type PlatformStaffRole = 'SUPER_ADMIN' | 'SUPPORT' | 'BILLING_ADMIN' | 'OPERATIONS';
export type PlatformStaffStatus = 'ACTIVE' | 'SUSPENDED';

export type PlatformPermission =
  | 'platform.businesses.read'
  | 'platform.businesses.manage'
  | 'platform.users.read'
  | 'platform.users.manage'
  | 'platform.whatsapp.read'
  | 'platform.whatsapp.manage'
  | 'platform.billing.read'
  | 'platform.billing.manage'
  | 'platform.operations.read'
  | 'platform.operations.manage'
  | 'platform.audit.read'
  | 'platform.staff.read'
  | 'platform.staff.manage';

export interface PlatformStaffRecord {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly role: PlatformStaffRole;
  readonly status: PlatformStaffStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PlatformAuthorizationContext {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly emailVerified: boolean;
  };
  readonly staff: PlatformStaffRecord;
  readonly permissions: readonly PlatformPermission[];
}

export interface PlatformPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly offset: number;
}

export type OrganizationLifecycleStatus = 'ACTIVE' | 'SUSPENDED';
