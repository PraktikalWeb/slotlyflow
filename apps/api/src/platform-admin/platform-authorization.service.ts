import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import { hasPlatformPermission, platformPermissionsForRole } from './platform-permissions.js';
import { PLATFORM_STAFF_REPOSITORY } from './platform-admin.tokens.js';
import type { PlatformStaffRepository } from './platform-staff.repository.js';
import type {
  PlatformAuthorizationContext,
  PlatformPermission,
} from './platform-admin.types.js';
import type { AuthenticatedSessionUser } from '../auth/session-authentication.js';

@Injectable()
export class PlatformAuthorizationService {
  constructor(@Inject(PLATFORM_STAFF_REPOSITORY) private readonly repository: PlatformStaffRepository) {}

  async resolve(user: AuthenticatedSessionUser): Promise<PlatformAuthorizationContext> {
    const staff = await this.repository.findByUserId(user.id);
    if (staff === undefined || staff.status !== 'ACTIVE') this.deny();
    return {
      user: {
        id: user.id,
        email: user.emailNormalized,
        emailVerified: user.emailVerifiedAt !== null,
      },
      staff,
      permissions: platformPermissionsForRole(staff.role),
    };
  }

  requirePermission(context: PlatformAuthorizationContext, permission: PlatformPermission): void {
    if (!hasPlatformPermission(context.staff.role, permission)) this.deny();
  }

  private deny(): never {
    throw new ForbiddenException({ code: 'PLATFORM_ACCESS_DENIED' });
  }
}
