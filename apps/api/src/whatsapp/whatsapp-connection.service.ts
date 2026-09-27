import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { WhatsAppConnectionResponse } from '@slotlyflow/contracts';

import type { TrustedOrganizationContext } from '../organizations/organization.types.js';
import { WHATSAPP_CONNECTION_REPOSITORY } from './whatsapp-connection.tokens.js';
import {
  WhatsAppConnectionAuditPersistenceError,
  WhatsAppConnectionInvalidStatusTransitionError,
  WhatsAppOrganizationConnectionAlreadyExistsError,
  WhatsAppConnectionValidationTargetNotFoundError,
  type WhatsAppConnectionRepository,
} from './whatsapp-connection.repository.js';
import {
  isWhatsAppConnectionSource,
  type VerifiedWhatsAppConnectionResult,
  type WhatsAppConnection,
} from './whatsapp-connection.types.js';
import { WHATSAPP_CONNECTION_PROVIDER } from './whatsapp-onboarding.tokens.js';
import {
  WhatsAppWebhookSubscriptionError,
  type WabaSubscriptionResult,
  type WhatsAppConnectionProvider,
  type WhatsAppConnectionValidationResult,
} from './whatsapp-provider.js';
import {
  noWabaSubscriptionDiagnostics,
  type WabaSubscriptionDiagnosticReporter,
} from './waba-subscription-diagnostics.js';

const externalIdentifierPattern = /^[A-Za-z0-9._:-]{1,255}$/;

@Injectable()
export class WhatsAppConnectionService {
  constructor(
    @Inject(WHATSAPP_CONNECTION_REPOSITORY) private readonly repository: WhatsAppConnectionRepository,
    @Optional() @Inject(WHATSAPP_CONNECTION_PROVIDER) private readonly provider?: WhatsAppConnectionProvider,
  ) {}

  async getForContext(context: TrustedOrganizationContext): Promise<WhatsAppConnectionResponse> {
    const connection = await this.repository.findForOrganization(context.organizationId);
    if (connection === undefined) this.notFound();
    return { connection: this.toSafeResponse(connection) };
  }

  async validateForContext(context: TrustedOrganizationContext): Promise<WhatsAppConnectionResponse> {
    const connection = await this.repository.findForOrganization(context.organizationId);
    if (connection === undefined) this.notFound();

    let result: WhatsAppConnectionValidationResult;
    if (
      this.provider === undefined
      || connection.credentialReference === null
      || connection.externalWabaId === null
      || connection.externalPhoneNumberId === null
    ) {
      result = { outcome: 'CHECK_FAILED', code: 'CREDENTIAL_UNAVAILABLE' };
    } else {
      result = await this.provider.validateExistingConnection({
        credentialReference: connection.credentialReference,
        expectedWabaId: connection.externalWabaId,
        expectedPhoneNumberId: connection.externalPhoneNumberId,
      });
    }

    try {
      const reconciled = await this.repository.reconcileValidationForOrganization({
        actorUserId: context.userId,
        organizationId: context.organizationId,
        connectionId: connection.id,
        result,
        now: new Date(),
      });
      return { connection: this.toSafeResponse(reconciled) };
    } catch (error) {
      if (error instanceof WhatsAppConnectionAuditPersistenceError) {
        throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
      }
      if (error instanceof WhatsAppConnectionInvalidStatusTransitionError) {
        throw new ConflictException({ code: 'WHATSAPP_CONNECTION_STATUS_TRANSITION_INVALID' });
      }
      if (error instanceof WhatsAppConnectionValidationTargetNotFoundError) this.notFound();
      throw error;
    }
  }

  async ensureWabaSubscriptionForContext(
    context: TrustedOrganizationContext,
    diagnostics: WabaSubscriptionDiagnosticReporter = noWabaSubscriptionDiagnostics,
  ): Promise<WabaSubscriptionResult> {
    const connection = await this.repository.findForOrganization(context.organizationId);
    if (connection === undefined) this.notFound();
    const provider = this.provider;
    if (
      connection.organizationId !== context.organizationId
      || connection.connectionStatus !== 'CONNECTED'
      || connection.verificationStatus !== 'VERIFIED'
      || connection.credentialReference === null
      || connection.externalWabaId === null
      || provider?.ensureWabaSubscribedToApp === undefined
    ) {
      throw new ServiceUnavailableException({ code: 'WHATSAPP_WEBHOOK_SUBSCRIPTION_FAILED' });
    }

    const scopedDiagnostics: WabaSubscriptionDiagnosticReporter = (event) => diagnostics({
      ...event,
      organizationId: context.organizationId,
      connectionId: connection.id,
    });

    try {
      return await provider.ensureWabaSubscribedToApp({
        credentialReference: connection.credentialReference,
        expectedWabaId: connection.externalWabaId,
      }, scopedDiagnostics);
    } catch (error) {
      if (error instanceof WhatsAppWebhookSubscriptionError && error.category === 'AUTHORIZATION') {
        await this.reconcileSubscriptionAuthorizationFailure(context, connection, error);
      }
      throw new ServiceUnavailableException({ code: 'WHATSAPP_WEBHOOK_SUBSCRIPTION_FAILED' });
    }
  }

  /** Internal provider-failure reconciliation; never accepts browser-supplied state. */
  async reconcileProviderAuthorizationFailureForContext(
    context: TrustedOrganizationContext,
    providerErrorCode: string,
    reauthenticationCode: 'META_AUTHORIZATION_REJECTED' | 'META_CREDENTIAL_EXPIRED' = 'META_AUTHORIZATION_REJECTED',
  ): Promise<void> {
    const connection = await this.repository.findForOrganization(context.organizationId);
    if (connection === undefined) this.notFound();
    await this.reconcileSubscriptionAuthorizationFailure(
      context,
      connection,
      new WhatsAppWebhookSubscriptionError('AUTHORIZATION', providerErrorCode, reauthenticationCode),
    );
  }

  /**
   * Internal application boundary for an already verified provider result.
   * No HTTP controller accepts this data; M2's adapter will be its only caller.
   */
  async recordVerifiedProviderConnection(
    context: TrustedOrganizationContext,
    result: VerifiedWhatsAppConnectionResult,
  ): Promise<WhatsAppConnection> {
    this.assertVerifiedResult(result);
    try {
      return (await this.repository.recordVerifiedForOrganization(context.userId, context.organizationId, result)).connection;
    } catch (error) {
      if (error instanceof WhatsAppConnectionAuditPersistenceError) {
        throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
      }
      if (error instanceof WhatsAppConnectionInvalidStatusTransitionError) {
        throw new BadRequestException({ code: 'WHATSAPP_CONNECTION_STATUS_TRANSITION_INVALID' });
      }
      if (error instanceof WhatsAppOrganizationConnectionAlreadyExistsError || this.isExternalPhoneUniqueViolation(error)) {
        throw new ConflictException({ code: 'WHATSAPP_CONNECTION_CONFLICT' });
      }
      throw error;
    }
  }

  private toSafeResponse(connection: WhatsAppConnection): WhatsAppConnectionResponse['connection'] {
    return {
      id: connection.id,
      provider: connection.provider,
      connectionSource: connection.connectionSource,
      connectionStatus: connection.connectionStatus,
      displayPhoneNumber: connection.displayPhoneNumber,
      verificationStatus: connection.verificationStatus,
      lastVerifiedAt: connection.lastVerifiedAt?.toISOString() ?? null,
    };
  }

  private assertVerifiedResult(result: VerifiedWhatsAppConnectionResult): void {
    if (
      result === null ||
      typeof result !== 'object' ||
      result.provider !== 'META' ||
      !isWhatsAppConnectionSource(result.source) ||
      result.source !== 'EXISTING_BUSINESS_APP' ||
      !this.isExternalIdentifier(result.externalWabaId) ||
      !this.isExternalIdentifier(result.externalPhoneNumberId) ||
      typeof result.credentialReference !== 'string' ||
      result.credentialReference.trim().length === 0 ||
      result.credentialReference.length > 255 ||
      (result.displayPhoneNumber !== null && (typeof result.displayPhoneNumber !== 'string' || result.displayPhoneNumber.trim().length === 0 || result.displayPhoneNumber.length > 64))
    ) {
      throw new BadRequestException({ code: 'WHATSAPP_CONNECTION_INPUT_INVALID' });
    }
  }

  private isExternalIdentifier(value: unknown): value is string {
    return typeof value === 'string' && externalIdentifierPattern.test(value);
  }

  private isExternalPhoneUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    if ('constraint_name' in error && error.constraint_name === 'whatsapp_connections_provider_phone_number_unique') return true;
    if ('constraint' in error && error.constraint === 'whatsapp_connections_provider_phone_number_unique') return true;
    return 'cause' in error && this.isExternalPhoneUniqueViolation(error.cause);
  }

  private async reconcileSubscriptionAuthorizationFailure(
    context: TrustedOrganizationContext,
    connection: WhatsAppConnection,
    error: WhatsAppWebhookSubscriptionError,
  ): Promise<void> {
    const code = error.reauthenticationCode ?? 'META_AUTHORIZATION_REJECTED';
    try {
      await this.repository.reconcileValidationForOrganization({
        actorUserId: context.userId,
        organizationId: context.organizationId,
        connectionId: connection.id,
        result: { outcome: 'NEEDS_REAUTH', code },
        now: new Date(),
      });
    } catch (reconciliationError) {
      if (reconciliationError instanceof WhatsAppConnectionAuditPersistenceError) {
        throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
      }
      if (reconciliationError instanceof WhatsAppConnectionInvalidStatusTransitionError) {
        throw new ConflictException({ code: 'WHATSAPP_CONNECTION_STATUS_TRANSITION_INVALID' });
      }
      if (reconciliationError instanceof WhatsAppConnectionValidationTargetNotFoundError) this.notFound();
      throw reconciliationError;
    }
  }

  /** Matches trusted-context denial so a connection cannot be used for tenant discovery. */
  private notFound(): never {
    throw new NotFoundException({ code: 'ORGANIZATION_ACCESS_NOT_FOUND' });
  }
}
