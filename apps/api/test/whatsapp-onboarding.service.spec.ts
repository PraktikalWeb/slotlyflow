import { describe, expect, it, vi } from 'vitest';

import { WhatsAppOnboardingService } from '../src/whatsapp/whatsapp-onboarding.service.js';
import type { WhatsAppOnboardingTransactionRepository } from '../src/whatsapp/whatsapp-onboarding.repository.js';
import type { TrustedOrganizationContext } from '../src/organizations/organization.types.js';

const context: TrustedOrganizationContext = {
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  membershipId: '33333333-3333-4333-8333-333333333333',
  role: 'OWNER',
  status: 'active',
  organization: { id: '22222222-2222-4222-8222-222222222222', name: 'Business', slug: 'business' },
};

describe('WhatsAppOnboardingService', () => {
  it('fails closed before persistence when the optional Meta configuration is absent', async () => {
    const repository: WhatsAppOnboardingTransactionRepository = {
      startForOrganization: vi.fn(),
    };
    const service = new WhatsAppOnboardingService(repository, undefined, undefined, {} as never);

    await expect(service.startConnectionOnboarding(context, 'EXISTING_BUSINESS_APP')).rejects.toMatchObject({
      status: 503,
      response: { code: 'META_ONBOARDING_NOT_CONFIGURED' },
    });
    expect(repository.startForOrganization).not.toHaveBeenCalled();
  });

  it('rejects unsupported browser sources before any provider/onboarding operation', async () => {
    const repository: WhatsAppOnboardingTransactionRepository = {
      startForOrganization: vi.fn(),
    };
    const service = new WhatsAppOnboardingService(repository, {
      appId: '1234567890',
      appSecret: 'server-only-test-secret',
      embeddedSignupConfigurationId: '9876543210',
      graphApiVersion: 'v25.0',
      webhookVerifyToken: 'meta-webhook-verify-token-fixture',
      credentialEncryptionKey: Buffer.alloc(32, 1),
    }, undefined, {} as never);

    await expect(service.startConnectionOnboarding(context, 'NEW_NUMBER')).rejects.toMatchObject({
      status: 400,
      response: { code: 'WHATSAPP_ONBOARDING_SOURCE_INVALID' },
    });
    expect(repository.startForOrganization).not.toHaveBeenCalled();
  });
});
