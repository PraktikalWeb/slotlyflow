import type { MembershipMutation, OrganizationMemberRole, OrganizationScopedMembership } from './organization.types.js';

export type OrganizationPermission =
  | 'organization.read'
  | 'organization.update'
  | 'membership.read'
  | 'membership.invite'
  | 'membership.update_role'
  | 'membership.remove'
  | 'billing.read'
  | 'billing.manage'
  | 'whatsapp.read'
  | 'whatsapp.manage'
  | 'automation.read'
  | 'automation.edit'
  | 'automation.publish'
  | 'conversation.read'
  | 'conversation.reply'
  | 'handoff.accept'
  | 'handoff.complete'
  | 'analytics.read';

const grantedPermissions: Readonly<Record<OrganizationMemberRole, ReadonlySet<OrganizationPermission>>> = {
  OWNER: new Set<OrganizationPermission>([
    'organization.read', 'organization.update', 'membership.read', 'membership.invite',
    'membership.update_role', 'membership.remove', 'billing.read', 'billing.manage',
    'whatsapp.read', 'whatsapp.manage', 'automation.read', 'automation.edit',
    'automation.publish', 'conversation.read', 'conversation.reply', 'handoff.accept',
    'handoff.complete', 'analytics.read',
  ]),
  ADMIN: new Set<OrganizationPermission>([
    'organization.read', 'organization.update', 'membership.read', 'membership.invite',
    'membership.update_role', 'membership.remove',
    'whatsapp.read', 'whatsapp.manage', 'automation.read', 'automation.edit',
    'automation.publish', 'conversation.read', 'conversation.reply', 'handoff.accept',
    'handoff.complete', 'analytics.read',
  ]),
  AGENT: new Set<OrganizationPermission>([
    'organization.read', 'conversation.read', 'conversation.reply', 'handoff.accept',
    'handoff.complete',
  ]),
};

/**
 * ADMIN membership changes are limited by the application service: ADMIN cannot
 * mutate an OWNER membership or promote any membership to OWNER. Unknown values
 * fail closed.
 */
export function hasOrganizationPermission(
  role: OrganizationMemberRole | string,
  permission: OrganizationPermission | string,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(grantedPermissions, role)) return false;
  return grantedPermissions[role as OrganizationMemberRole].has(permission as OrganizationPermission);
}

/** Applies the documented limited ADMIN membership-mutation boundary. */
export function mayMutateOrganizationMembership(
  actorRole: OrganizationMemberRole | string,
  target: OrganizationScopedMembership,
  mutation: MembershipMutation,
): boolean {
  const requiredPermission = mutation.kind === 'role' ? 'membership.update_role' : 'membership.remove';
  if (!hasOrganizationPermission(actorRole, requiredPermission)) return false;
  if (actorRole === 'OWNER') return true;
  if (actorRole !== 'ADMIN') return false;
  if (target.role === 'OWNER') return false;
  return mutation.kind !== 'role' || mutation.role !== 'OWNER';
}
