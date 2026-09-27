import { HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { OrganizationRepository } from '../src/organizations/organization.repository.js';
import { OrganizationContextService } from '../src/organizations/organization-context.service.js';

const organizationId = '11111111-1111-4111-8111-111111111111';

function repositoryStub(): OrganizationRepository {
  return {
    createWithInitialOwner: vi.fn(),
    findMembershipsForUser: vi.fn(),
    findActiveContextForUserAndOrganization: vi.fn(async () => ({
      userId: 'user-id',
      organizationId,
      membershipId: 'membership-id',
      role: 'AGENT' as const,
      status: 'active' as const,
      organization: { id: organizationId, name: 'Example', slug: 'example' },
    })),
    findMembershipsForOrganization: vi.fn(),
    findMembershipForOrganization: vi.fn(),
    mutateMembershipWithOwnerLock: vi.fn(),
  };
}

describe('OrganizationContextService', () => {
  it('returns only persisted active membership values and evaluates the required permission centrally', async () => {
    const repository = repositoryStub();
    const service = new OrganizationContextService(repository);

    await expect(service.resolveForPermission('user-id', organizationId, 'organization.read')).resolves.toMatchObject({
      userId: 'user-id', organizationId, membershipId: 'membership-id', role: 'AGENT', status: 'active',
    });
    expect(repository.findActiveContextForUserAndOrganization).toHaveBeenCalledWith('user-id', organizationId);
  });

  it('returns non-disclosing not-found errors for malformed, absent, and inactive/non-member contexts', async () => {
    const repository = repositoryStub();
    vi.mocked(repository.findActiveContextForUserAndOrganization).mockResolvedValue(undefined);
    const service = new OrganizationContextService(repository);

    await expect(service.resolveForPermission('user-id', 'not-a-uuid', 'organization.read')).rejects.toMatchObject({
      status: 404, response: { code: 'ORGANIZATION_ACCESS_NOT_FOUND' },
    });
    await expect(service.resolveForPermission('user-id', organizationId, 'organization.read')).rejects.toMatchObject({
      status: 404, response: { code: 'ORGANIZATION_ACCESS_NOT_FOUND' },
    });
  });

  it('denies permissions that the verified role does not hold', async () => {
    const service = new OrganizationContextService(repositoryStub());

    await expect(service.resolveForPermission('user-id', organizationId, 'organization.update')).rejects.toBeInstanceOf(HttpException);
    await expect(service.resolveForPermission('user-id', organizationId, 'organization.update')).rejects.toMatchObject({
      status: 403, response: { code: 'ORGANIZATION_PERMISSION_DENIED' },
    });
  });
});
