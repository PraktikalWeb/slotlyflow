import { describe, expect, it } from 'vitest';

import {
  hasOrganizationPermission,
  mayMutateOrganizationMembership,
  type OrganizationPermission,
} from '../src/organizations/organization-permissions.js';

const allPermissions: readonly OrganizationPermission[] = [
  'organization.read', 'organization.update', 'membership.read', 'membership.invite',
  'membership.update_role', 'membership.remove', 'billing.read', 'billing.manage',
  'whatsapp.read', 'whatsapp.manage', 'automation.read', 'automation.edit',
  'automation.publish', 'conversation.read', 'conversation.reply', 'handoff.accept',
  'handoff.complete', 'analytics.read',
];

describe('organization permission policy', () => {
  it('grants every documented OWNER permission', () => {
    for (const permission of allPermissions) expect(hasOrganizationPermission('OWNER', permission)).toBe(true);
  });

  it('grants documented ADMIN permissions, including limited member changes, and denies billing', () => {
    for (const permission of [
      'organization.read', 'organization.update', 'membership.read', 'membership.invite',
      'membership.update_role', 'membership.remove',
      'whatsapp.read', 'whatsapp.manage', 'automation.read', 'automation.edit',
      'automation.publish', 'conversation.read', 'conversation.reply', 'handoff.accept',
      'handoff.complete', 'analytics.read',
    ] as const) expect(hasOrganizationPermission('ADMIN', permission)).toBe(true);
    for (const permission of ['billing.read', 'billing.manage'] as const) {
      expect(hasOrganizationPermission('ADMIN', permission)).toBe(false);
    }
  });

  it('grants AGENT only its documented read/reply/handoff permissions and denies unknown role or permission values', () => {
    for (const permission of ['organization.read', 'conversation.read', 'conversation.reply', 'handoff.accept', 'handoff.complete'] as const) {
      expect(hasOrganizationPermission('AGENT', permission)).toBe(true);
    }
    expect(hasOrganizationPermission('AGENT', 'organization.update')).toBe(false);
    expect(hasOrganizationPermission('UNKNOWN', 'organization.read')).toBe(false);
    expect(hasOrganizationPermission('toString', 'organization.read')).toBe(false);
    expect(hasOrganizationPermission('OWNER', 'unknown.permission')).toBe(false);
  });

  it('applies ADMIN member-mutation permissions only to non-OWNER targets', () => {
    const ownerTarget = {
      id: 'owner-membership', organizationId: 'organization-id', user: { id: 'owner-id', email: 'owner@example.test' }, role: 'OWNER' as const, status: 'active' as const,
    };
    const agentTarget = {
      id: 'agent-membership', organizationId: 'organization-id', user: { id: 'agent-id', email: 'agent@example.test' }, role: 'AGENT' as const, status: 'active' as const,
    };

    expect(mayMutateOrganizationMembership('ADMIN', ownerTarget, { kind: 'deactivate' })).toBe(false);
    expect(mayMutateOrganizationMembership('ADMIN', agentTarget, { kind: 'role', role: 'OWNER' })).toBe(false);
    expect(mayMutateOrganizationMembership('ADMIN', agentTarget, { kind: 'role', role: 'ADMIN' })).toBe(true);
    expect(mayMutateOrganizationMembership('OWNER', ownerTarget, { kind: 'deactivate' })).toBe(true);
    expect(mayMutateOrganizationMembership('AGENT', agentTarget, { kind: 'deactivate' })).toBe(false);
  });
});
