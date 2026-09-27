import { SetMetadata } from '@nestjs/common';

import type { PlatformPermission } from './platform-admin.types.js';

export const REQUIRED_PLATFORM_PERMISSIONS = 'slotlyflow.required_platform_permissions';

export function RequirePlatformPermission(...permissions: readonly PlatformPermission[]): MethodDecorator & ClassDecorator {
  return SetMetadata(REQUIRED_PLATFORM_PERMISSIONS, permissions);
}
