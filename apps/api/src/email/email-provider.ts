export interface VerificationEmailMessage {
  readonly to: string;
  readonly verificationUrl: string;
  readonly expiresAt: Date;
}

/** SlotlyFlow-owned boundary for transactional authentication email delivery. */
export interface EmailProvider {
  assertAvailable(): Promise<void>;
  sendVerificationEmail(message: VerificationEmailMessage): Promise<void>;
}

export class UnavailableEmailProvider implements EmailProvider {
  async assertAvailable(): Promise<void> {
    throw new Error('Email delivery is not configured.');
  }

  async sendVerificationEmail(): Promise<void> {
    throw new Error('Email delivery is not configured.');
  }
}
