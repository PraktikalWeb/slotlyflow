import type { PlatformPermission, PlatformStaffRole } from './platform-admin.types.js';

export const allPlatformPermissions = [
  'platform.businesses.read',
  'platform.businesses.manage',
  'platform.users.read',
  'platform.users.manage',
  'platform.whatsapp.read',
  'platform.whatsapp.manage',
  'platform.billing.read',
  'platform.billing.manage',
  'platform.operations.read',
  'platform.operations.manage',
  'platform.audit.read',
  'platform.staff.read',
  'platform.staff.manage',
] as const satisfies readonly PlatformPermission[];

const platformRolePermissions: Readonly<Record<PlatformStaffRole, ReadonlySet<PlatformPermission>>> = {
  SUPER_ADMIN: new Set(allPlatformPermissions),
  SUPPORT: new Set([
    'platform.businesses.read',
    'platform.users.read',
    'platform.whatsapp.read',
    'platform.operations.read',
  ]),
  BILLING_ADMIN: new Set([
    'platform.businesses.read',
    'platform.users.read',
    'platform.billing.read',
    'platform.billing.manage',
  ]),
  OPERATIONS: new Set([
    'platform.businesses.read',
    'platform.users.read',
    'platform.whatsapp.read',
    'platform.whatsapp.manage',
    'platform.operations.read',
    'platform.operations.manage',
  ]),
};

export function platformPermissionsForRole(role: PlatformStaffRole | string): readonly PlatformPermission[] {
  if (!Object.prototype.hasOwnProperty.call(platformRolePermissions, role)) return [];
  return [...platformRolePermissions[role as PlatformStaffRole]];
}

export function hasPlatformPermission(
  role: PlatformStaffRole | string,
  permission: PlatformPermission | string,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(platformRolePermissions, role)) return false;
  return platformRolePermissions[role as PlatformStaffRole].has(permission as PlatformPermission);
}
