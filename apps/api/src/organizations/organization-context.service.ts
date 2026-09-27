import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { hasOrganizationPermission, type OrganizationPermission } from './organization-permissions.js';
import { ORGANIZATION_REPOSITORY } from './organization.tokens.js';
import type { OrganizationRepository } from './organization.repository.js';
import type { TrustedOrganizationContext } from './organization.types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OrganizationContextService {
  constructor(@Inject(ORGANIZATION_REPOSITORY) private readonly repository: OrganizationRepository) {}

  async resolveForPermission(
    userId: string,
    requestedOrganizationId: string,
    permission: OrganizationPermission,
  ): Promise<TrustedOrganizationContext> {
    if (!uuidPattern.test(requestedOrganizationId)) this.notFound();
    const context = await this.repository.findActiveContextForUserAndOrganization(userId, requestedOrganizationId);
    if (context === undefined) this.notFound();
    if (!hasOrganizationPermission(context.role, permission)) {
      throw new ForbiddenException({ code: 'ORGANIZATION_PERMISSION_DENIED' });
    }
    return context;
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'ORGANIZATION_ACCESS_NOT_FOUND' });
  }
}
