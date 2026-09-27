import { HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { MembershipMutationAuditPersistenceError, type OrganizationRepository } from '../src/organizations/organization.repository.js';
import { OrganizationService } from '../src/organizations/organization.service.js';

function repositoryStub(): OrganizationRepository {
  return {
    createWithInitialOwner: vi.fn(async (_actorUserId, command) => ({
      organization: { id: 'organization-id', name: command.name, slug: command.slug },
      membership: {
        organization: { id: 'organization-id', name: command.name, slug: command.slug },
        role: 'OWNER' as const,
        status: 'active' as const,
      },
    })),
    findMembershipsForUser: vi.fn(async () => []),
    findActiveContextForUserAndOrganization: vi.fn(async () => undefined),
    findMembershipsForOrganization: vi.fn(async () => []),
    findMembershipForOrganization: vi.fn(async () => undefined),
    mutateMembershipWithOwnerLock: vi.fn(async () => ({ outcome: 'not_found' as const })),
  };
}

describe('OrganizationService', () => {
  it('normalizes only the approved name and slug inputs before creation', async () => {
    const repository = repositoryStub();
    const service = new OrganizationService(repository);

    await expect(service.createForAuthenticatedUser('actor-id', { name: '  Example Studio  ', slug: '  EXAMPLE-STUDIO  ' }))
      .resolves.toMatchObject({ organization: { name: 'Example Studio', slug: 'example-studio' } });
    expect(repository.createWithInitialOwner).toHaveBeenCalledWith('actor-id', {
      name: 'Example Studio',
      slug: 'example-studio',
    });
  });

  it('rejects malformed organization input before the repository boundary', async () => {
    const repository = repositoryStub();
    const service = new OrganizationService(repository);

    await expect(service.createForAuthenticatedUser('actor-id', { name: 'Example Studio', slug: 'not a slug' }))
      .rejects.toBeInstanceOf(HttpException);
    expect(repository.createWithInitialOwner).not.toHaveBeenCalled();
  });

  it('maps a database uniqueness violation to a safe slug conflict', async () => {
    const repository = repositoryStub();
    vi.mocked(repository.createWithInitialOwner).mockRejectedValue({ cause: { code: '23505' } });
    const service = new OrganizationService(repository);

    await expect(service.createForAuthenticatedUser('actor-id', { name: 'Example Studio', slug: 'example-studio' }))
      .rejects.toMatchObject({ status: 409, response: { code: 'ORGANIZATION_SLUG_UNAVAILABLE' } });
  });

  it('lists memberships only from a trusted organization context', async () => {
    const repository = repositoryStub();
    vi.mocked(repository.findMembershipsForOrganization).mockResolvedValue([{
      id: 'membership-id',
      organizationId: 'organization-id',
      user: { id: 'member-id', email: 'member@example.test' },
      role: 'ADMIN',
      status: 'active',
    }]);
    const service = new OrganizationService(repository);

    await expect(service.listMemberships({
      userId: 'actor-id',
      organizationId: 'organization-id',
      membershipId: 'actor-membership-id',
      role: 'OWNER',
      status: 'active',
      organization: { id: 'organization-id', name: 'Example', slug: 'example' },
    })).resolves.toEqual([{
      id: 'membership-id',
      user: { id: 'member-id', email: 'member@example.test' },
      role: 'ADMIN',
      status: 'active',
    }]);
    expect(repository.findMembershipsForOrganization).toHaveBeenCalledWith('organization-id');
  });

  it('maps a protected final-owner mutation to a safe conflict', async () => {
    const repository = repositoryStub();
    vi.mocked(repository.mutateMembershipWithOwnerLock).mockResolvedValue({ outcome: 'last_active_owner' });
    const service = new OrganizationService(repository);

    await expect(service.changeMembershipRole({
      userId: 'actor-id',
      organizationId: '11111111-1111-4111-8111-111111111111',
      membershipId: 'actor-membership-id',
      role: 'OWNER',
      status: 'active',
      organization: { id: '11111111-1111-4111-8111-111111111111', name: 'Example', slug: 'example' },
    }, '22222222-2222-4222-8222-222222222222', { role: 'ADMIN' }))
      .rejects.toMatchObject({ status: 409, response: { code: 'ORGANIZATION_LAST_ACTIVE_OWNER_REQUIRED' } });
  });

  it('maps required audit persistence failure to a safe dependency response', async () => {
    const repository = repositoryStub();
    vi.mocked(repository.mutateMembershipWithOwnerLock).mockRejectedValue(new MembershipMutationAuditPersistenceError());
    const service = new OrganizationService(repository);

    await expect(service.changeMembershipRole({
      userId: 'actor-id',
      organizationId: '11111111-1111-4111-8111-111111111111',
      membershipId: 'actor-membership-id',
      role: 'OWNER',
      status: 'active',
      organization: { id: '11111111-1111-4111-8111-111111111111', name: 'Example', slug: 'example' },
    }, '22222222-2222-4222-8222-222222222222', { role: 'ADMIN' }))
      .rejects.toMatchObject({ status: 503, response: { code: 'DEPENDENCY_UNAVAILABLE' } });
  });
});
