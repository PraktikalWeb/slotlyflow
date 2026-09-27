import type { RegistrationDiagnosticReporter } from '../observability/registration-diagnostics.js';

export interface VerificationEmailMessage {
  readonly to: string;
  readonly firstName?: string | null;
  readonly verificationUrl: string;
  readonly expiresAt: Date;
}

export interface PasswordResetEmailMessage {
  readonly to: string;
  readonly passwordResetUrl: string;
  readonly expiresAt: Date;
}

export interface NotificationEmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly businessName: string;
  readonly customerDisplayName: string;
  readonly conversationUrl: string;
}

/** SlotlyFlow-owned boundary for transactional authentication email delivery. */
export interface EmailProvider {
  assertAvailable(): Promise<void>;
  sendVerificationEmail(message: VerificationEmailMessage, diagnostics?: RegistrationDiagnosticReporter): Promise<void>;
  sendPasswordResetEmail(message: PasswordResetEmailMessage): Promise<void>;
  sendNotificationEmail(message: NotificationEmailMessage): Promise<{ readonly providerMessageId: string | undefined }>;
}

export class UnavailableEmailProvider implements EmailProvider {
  async assertAvailable(): Promise<void> {
    throw new Error('Email delivery is not configured.');
  }

  async sendVerificationEmail(): Promise<void> {
    throw new Error('Email delivery is not configured.');
  }

  async sendPasswordResetEmail(): Promise<void> {
    throw new Error('Email delivery is not configured.');
  }

  async sendNotificationEmail(): Promise<{ readonly providerMessageId: string | undefined }> {
    throw new Error('Email delivery is not configured.');
  }
}
