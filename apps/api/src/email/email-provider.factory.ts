import type { EmailDeliveryConfig } from '@slotlyflow/config';

import type { EmailProvider } from './email-provider.js';
import { UnavailableEmailProvider } from './email-provider.js';
import { SmtpEmailProvider } from './smtp-email.provider.js';

export function createEmailProvider(config: EmailDeliveryConfig): EmailProvider {
  return config.provider === 'smtp'
    ? new SmtpEmailProvider(config)
    : new UnavailableEmailProvider();
}
