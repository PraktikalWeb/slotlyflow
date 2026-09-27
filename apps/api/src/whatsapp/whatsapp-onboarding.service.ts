import { BadRequestException, ConflictException, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { MetaWhatsAppConfig } from '@slotlyflow/config';
import type {
  CompleteWhatsAppOnboardingHandoffRequest,
  CompleteWhatsAppOnboardingRequest,
  CompleteWhatsAppOnboardingResponse,
  ResolveWhatsAppOnboardingHandoffResponse,
  StartWhatsAppOnboardingResponse,
} from '@slotlyflow/contracts';

import { OrganizationContextService } from '../organizations/organization-context.service.js';
import type { TrustedOrganizationContext } from '../organizations/organization.types.js';
import { META_WHATSAPP_CONFIG, WHATSAPP_CONNECTION_PROVIDER, WHATSAPP_ONBOARDING_TRANSACTION_REPOSITORY } from './whatsapp-onboarding.tokens.js';
import {
  WhatsAppOnboardingAuditPersistenceError,
  type WhatsAppOnboardingTransactionRepository,
} from './whatsapp-onboarding.repository.js';
import { DrizzleWhatsAppOnboardingCompletionRepository, OnboardingCompletionDeniedError, OnboardingCompletionPersistenceError } from './whatsapp-onboarding-completion.repository.js';
import { WhatsAppConnectionService } from './whatsapp-connection.service.js';
import { CoexistenceContactSyncError, CoexistenceHistorySyncError, type WhatsAppConnectionProvider } from './whatsapp-provider.js';
import { MetaProviderOperationError } from './meta-whatsapp-connection.provider.js';
import {
  openWhatsAppOnboardingHandoff,
  sealWhatsAppOnboardingHandoff,
  WhatsAppOnboardingHandoffError,
} from './whatsapp-onboarding-handoff.js';
import {
  noWabaSubscriptionDiagnostics,
  type WabaSubscriptionDiagnosticReporter,
} from './waba-subscription-diagnostics.js';
import {
  noCoexistenceContactSyncDiagnostics,
  type CoexistenceContactSyncDiagnosticReporter,
} from './coexistence-contact-sync-diagnostics.js';
import {
  noCoexistenceHistorySyncDiagnostics,
  type CoexistenceHistorySyncDiagnosticReporter,
} from './coexistence-history-sync-diagnostics.js';

const onboardingLifetimeMs = 10 * 60 * 1000;

@Injectable()
export class WhatsAppOnboardingService {
  constructor(
    @Inject(WHATSAPP_ONBOARDING_TRANSACTION_REPOSITORY) private readonly repository: WhatsAppOnboardingTransactionRepository,
    @Inject(META_WHATSAPP_CONFIG) private readonly metaConfig: MetaWhatsAppConfig | undefined,
    @Inject(WHATSAPP_CONNECTION_PROVIDER) private readonly provider: WhatsAppConnectionProvider | undefined,
    @Inject(DrizzleWhatsAppOnboardingCompletionRepository)
    private readonly completions: DrizzleWhatsAppOnboardingCompletionRepository,
    @Optional() @Inject(OrganizationContextService)
    private readonly organizationContexts?: OrganizationContextService,
    @Optional() @Inject(WhatsAppConnectionService)
    private readonly connections?: WhatsAppConnectionService,
  ) {}

  async startConnectionOnboarding(
    context: TrustedOrganizationContext,
    source: unknown,
  ): Promise<StartWhatsAppOnboardingResponse> {
    if (source !== 'EXISTING_BUSINESS_APP') {
      throw new BadRequestException({ code: 'WHATSAPP_ONBOARDING_SOURCE_INVALID' });
    }
    const meta = this.publicMetaConfig();
    const now = new Date();
    let result;
    try {
      result = await this.repository.startForOrganization({
        actorUserId: context.userId,
        organizationId: context.organizationId,
        now,
        expiresAt: new Date(now.getTime() + onboardingLifetimeMs),
      });
    } catch (error) {
      if (error instanceof WhatsAppOnboardingAuditPersistenceError) {
        throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
      }
      throw error;
    }
    if (result.outcome === 'connection_exists') {
      const code = result.connectionStatus === 'CONNECTED'
        ? 'WHATSAPP_CONNECTION_ALREADY_CONNECTED'
        : 'WHATSAPP_CONNECTION_ONBOARDING_UNAVAILABLE';
      throw new ConflictException({ code });
    }
    if (result.outcome === 'started_by_other_actor') {
      throw new ConflictException({ code: 'WHATSAPP_CONNECTION_ONBOARDING_IN_PROGRESS' });
    }
    return {
      onboarding: {
        transactionId: result.transaction.id,
        handoffToken: sealWhatsAppOnboardingHandoff({
          transactionId: result.transaction.id,
          organizationId: result.transaction.organizationId,
          actorUserId: result.transaction.actorUserId,
          expiresAt: result.transaction.expiresAt,
        }, this.requireMetaConfig().credentialEncryptionKey),
        provider: 'META',
        source: 'EXISTING_BUSINESS_APP',
        expiresAt: result.transaction.expiresAt.toISOString(),
      },
      meta,
    };
  }

  async resolveConnectionOnboardingHandoff(
    handoffToken: unknown,
  ): Promise<ResolveWhatsAppOnboardingHandoffResponse> {
    const handoff = this.openHandoff(handoffToken);
    await this.resolveHandoffContext(handoff);
    try {
      const existing = await this.completions.getForCompletion({
        transactionId: handoff.transactionId,
        organizationId: handoff.organizationId,
        actorUserId: handoff.actorUserId,
        now: new Date(),
      });
      if (existing.connection !== undefined) {
        throw new OnboardingCompletionDeniedError();
      }
    } catch (error) {
      this.mapCompletionError(error);
    }
    return { meta: this.publicMetaConfig() };
  }

  async completeConnectionOnboardingHandoff(
    body: CompleteWhatsAppOnboardingHandoffRequest,
    diagnostics: WabaSubscriptionDiagnosticReporter = noWabaSubscriptionDiagnostics,
    contactSyncDiagnostics: CoexistenceContactSyncDiagnosticReporter = noCoexistenceContactSyncDiagnostics,
    historySyncDiagnostics: CoexistenceHistorySyncDiagnosticReporter = noCoexistenceHistorySyncDiagnostics,
  ): Promise<CompleteWhatsAppOnboardingResponse> {
    const handoff = this.openHandoff(body?.handoffToken);
    const context = await this.resolveHandoffContext(handoff);
    return this.completeConnectionOnboarding(context, handoff.transactionId, body, diagnostics, contactSyncDiagnostics, historySyncDiagnostics);
  }

  async completeConnectionOnboarding(
    context: TrustedOrganizationContext,
    transactionId: string,
    body: CompleteWhatsAppOnboardingRequest,
    diagnostics: WabaSubscriptionDiagnosticReporter = noWabaSubscriptionDiagnostics,
    contactSyncDiagnostics: CoexistenceContactSyncDiagnosticReporter = noCoexistenceContactSyncDiagnostics,
    historySyncDiagnostics: CoexistenceHistorySyncDiagnosticReporter = noCoexistenceHistorySyncDiagnostics,
  ): Promise<CompleteWhatsAppOnboardingResponse> {
    if (!isUuid(transactionId) || !isCompletionInput(body)) throw new BadRequestException({ code: 'WHATSAPP_ONBOARDING_COMPLETION_INPUT_INVALID' });
    if (this.provider === undefined || this.metaConfig === undefined) throw new ServiceUnavailableException({ code: 'META_ONBOARDING_NOT_CONFIGURED' });
    const now = new Date();
    let prior;
    try {
      prior = await this.completions.getForCompletion({ transactionId, organizationId: context.organizationId, actorUserId: context.userId, now });
    } catch (error) { this.mapCompletionError(error); }
    if (prior.connection !== undefined) {
      try {
        return await this.validateEnsureAndFinalize(context, transactionId, diagnostics, contactSyncDiagnostics, historySyncDiagnostics);
      } catch (error) {
        this.mapCompletionError(error);
      }
    }
    try {
      const remote = await this.provider.completeExistingBusinessAppConnection({
        authorizationCode: body.authorizationCode,
        phoneNumberIdHint: body.phoneNumberId,
        whatsappBusinessAccountIdHint: body.whatsappBusinessAccountId,
      });
      await this.completions.persistVerifiedCompletion({
        transactionId, organizationId: context.organizationId, actorUserId: context.userId, now: new Date(),
        verified: remote.connection, credential: remote.credential,
      });
      return this.validateEnsureAndFinalize(context, transactionId, diagnostics, contactSyncDiagnostics, historySyncDiagnostics);
    } catch (error) { this.mapCompletionError(error); }
  }

  private async validateEnsureAndFinalize(
    context: TrustedOrganizationContext,
    transactionId: string,
    diagnostics: WabaSubscriptionDiagnosticReporter,
    contactSyncDiagnostics: CoexistenceContactSyncDiagnosticReporter,
    historySyncDiagnostics: CoexistenceHistorySyncDiagnosticReporter,
  ): Promise<CompleteWhatsAppOnboardingResponse> {
    if (this.connections === undefined) {
      throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
    }
    const response = await this.connections.validateForContext(context);
    await this.connections.ensureWabaSubscriptionForContext(context, diagnostics);
    await this.requestCoexistenceContactSync(context, transactionId, contactSyncDiagnostics);
    await this.requestCoexistenceHistorySync(context, transactionId, historySyncDiagnostics);
    await this.completions.markCompletionSucceeded({
      transactionId,
      organizationId: context.organizationId,
      actorUserId: context.userId,
      connectionId: response.connection.id,
      now: new Date(),
    });
    return response;
  }

  async recordCoexistenceHistoryWebhookOutcome(
    externalPhoneNumberId: string,
    outcome: 'DECLINED' | 'PROCESSED',
    diagnostics: CoexistenceHistorySyncDiagnosticReporter = noCoexistenceHistorySyncDiagnostics,
  ): Promise<void> {
    const result = await this.completions.recordCoexistenceHistoryWebhookOutcome({
      externalPhoneNumberId,
      outcome,
      now: new Date(),
    });
    if (result.outcome !== 'UPDATED') return;
    diagnostics({
      event: outcome === 'DECLINED'
        ? 'coexistence_history_sync_request_declined'
        : 'coexistence_history_sync_webhook_processed',
      organizationId: result.organizationId,
      connectionId: result.connectionId,
      onboardingId: result.onboardingId,
      ...(outcome === 'DECLINED' ? { providerErrorCode: 'META_HISTORY_SHARING_DECLINED' } : {}),
    });
  }

  private async requestCoexistenceContactSync(
    context: TrustedOrganizationContext,
    transactionId: string,
    diagnostics: CoexistenceContactSyncDiagnosticReporter,
  ): Promise<void> {
    const connections = this.connections;
    if (connections === undefined) {
      throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
    }
    const claim = await this.completions.claimCoexistenceContactSync({
      transactionId,
      organizationId: context.organizationId,
      actorUserId: context.userId,
      now: new Date(),
    });
    const connectionId = claim.outcome === 'CLAIMED' ? claim.connection.id : claim.connectionId;
    const scopedDiagnostics: CoexistenceContactSyncDiagnosticReporter = (event) => diagnostics({
      ...event,
      organizationId: context.organizationId,
      connectionId,
      onboardingId: transactionId,
    });

    if (claim.outcome === 'ALREADY_ATTEMPTED') {
      scopedDiagnostics({ event: 'coexistence_contact_sync_request_already_attempted' });
      return;
    }

    const provider = this.provider;
    if (provider?.requestCoexistenceContactSync === undefined) {
      const failure = new CoexistenceContactSyncError('CONFIGURATION', 'META_CONTACT_SYNC_UNAVAILABLE');
      scopedDiagnostics({
        event: 'coexistence_contact_sync_request_failed',
        failureCategory: failure.category,
        providerErrorCode: failure.providerErrorCode,
      });
      await this.completions.recordCoexistenceContactSyncFailed({
        transactionId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        error: failure,
        now: new Date(),
      });
      return;
    }

    try {
      const result = await provider.requestCoexistenceContactSync({
        credentialReference: claim.connection.credentialReference!,
        expectedPhoneNumberId: claim.connection.externalPhoneNumberId!,
      }, scopedDiagnostics);
      await this.completions.recordCoexistenceContactSyncAccepted({
        transactionId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        providerRequestId: result.providerRequestId,
        now: new Date(),
      });
    } catch (error) {
      if (!(error instanceof CoexistenceContactSyncError)) throw error;
      await this.completions.recordCoexistenceContactSyncFailed({
        transactionId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        error,
        now: new Date(),
      });
      if (error.category === 'AUTHORIZATION') {
        await connections.reconcileProviderAuthorizationFailureForContext(
          context,
          error.providerErrorCode,
          error.reauthenticationCode ?? 'META_AUTHORIZATION_REJECTED',
        );
        throw new ServiceUnavailableException({ code: 'WHATSAPP_CONTACT_SYNC_AUTHORIZATION_FAILED' });
      }
      // Contact migration is separate from connection health. The durable
      // FAILED state preserves attention/recovery data without disconnecting a
      // provider-verified, webhook-subscribed WhatsApp connection.
    }
  }

  private async requestCoexistenceHistorySync(
    context: TrustedOrganizationContext,
    transactionId: string,
    diagnostics: CoexistenceHistorySyncDiagnosticReporter,
  ): Promise<void> {
    const claim = await this.completions.claimCoexistenceHistorySync({
      transactionId,
      organizationId: context.organizationId,
      actorUserId: context.userId,
      now: new Date(),
    });
    const connectionId = claim.outcome === 'CLAIMED' ? claim.connection.id : claim.connectionId;
    const scopedDiagnostics: CoexistenceHistorySyncDiagnosticReporter = (event) => diagnostics({
      ...event,
      organizationId: context.organizationId,
      connectionId,
      onboardingId: transactionId,
    });

    if (claim.outcome === 'ALREADY_ATTEMPTED') {
      scopedDiagnostics({ event: 'coexistence_history_sync_request_already_attempted' });
      return;
    }

    const provider = this.provider;
    if (provider?.requestCoexistenceHistorySync === undefined) {
      const failure = new CoexistenceHistorySyncError('CONFIGURATION', 'META_HISTORY_SYNC_UNAVAILABLE');
      scopedDiagnostics({
        event: 'coexistence_history_sync_request_failed',
        failureCategory: failure.category,
        providerErrorCode: failure.providerErrorCode,
      });
      await this.completions.recordCoexistenceHistorySyncFailed({
        transactionId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        error: failure,
        now: new Date(),
      });
      return;
    }

    try {
      const result = await provider.requestCoexistenceHistorySync({
        credentialReference: claim.connection.credentialReference!,
        expectedPhoneNumberId: claim.connection.externalPhoneNumberId!,
      }, scopedDiagnostics);
      await this.completions.recordCoexistenceHistorySyncAccepted({
        transactionId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        providerRequestId: result.providerRequestId,
        now: new Date(),
      });
    } catch (error) {
      const failure = error instanceof CoexistenceHistorySyncError
        ? error
        : new CoexistenceHistorySyncError('TRANSIENT', 'META_UNAVAILABLE');
      await this.completions.recordCoexistenceHistorySyncFailed({
        transactionId,
        organizationId: context.organizationId,
        actorUserId: context.userId,
        error: failure,
        now: new Date(),
      });
      // History sharing is optional. Its durable FAILED state must not undo a
      // provider-verified connection or fail the surrounding onboarding flow.
    }
  }

  private publicMetaConfig(): StartWhatsAppOnboardingResponse['meta'] {
    const config = this.requireMetaConfig();
    return {
      appId: config.appId,
      embeddedSignupConfigurationId: config.embeddedSignupConfigurationId,
      graphApiVersion: config.graphApiVersion,
    };
  }

  private requireMetaConfig(): MetaWhatsAppConfig {
    if (this.metaConfig === undefined) throw new ServiceUnavailableException({ code: 'META_ONBOARDING_NOT_CONFIGURED' });
    return this.metaConfig;
  }

  private openHandoff(handoffToken: unknown) {
    try {
      return openWhatsAppOnboardingHandoff(
        handoffToken,
        this.requireMetaConfig().credentialEncryptionKey,
        new Date(),
      );
    } catch (error) {
      if (error instanceof WhatsAppOnboardingHandoffError) {
        throw new ConflictException({ code: 'WHATSAPP_ONBOARDING_COMPLETION_UNAVAILABLE' });
      }
      throw error;
    }
  }

  private async resolveHandoffContext(handoff: {
    readonly actorUserId: string;
    readonly organizationId: string;
  }): Promise<TrustedOrganizationContext> {
    if (this.organizationContexts === undefined) {
      throw new ServiceUnavailableException({ code: 'DEPENDENCY_UNAVAILABLE' });
    }
    try {
      return await this.organizationContexts.resolveForPermission(
        handoff.actorUserId,
        handoff.organizationId,
        'whatsapp.manage',
      );
    } catch {
      throw new ConflictException({ code: 'WHATSAPP_ONBOARDING_COMPLETION_UNAVAILABLE' });
    }
  }

  private mapCompletionError(error: unknown): never {
    if (error instanceof OnboardingCompletionDeniedError) throw new ConflictException({ code: 'WHATSAPP_ONBOARDING_COMPLETION_UNAVAILABLE' });
    if (error instanceof MetaProviderOperationError) {
      throw new ServiceUnavailableException({
        code: error.stage === 'AUTHORIZATION_CODE_EXCHANGE'
          ? 'META_AUTHORIZATION_CODE_EXCHANGE_FAILED'
          : 'META_PHONE_OWNERSHIP_VERIFICATION_FAILED',
      });
    }
    if (error instanceof OnboardingCompletionPersistenceError) {
      throw new ServiceUnavailableException({ code: 'WHATSAPP_CONNECTION_PERSISTENCE_FAILED' });
    }
    throw error;
  }
}

function isUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function isCompletionInput(value: unknown): value is CompleteWhatsAppOnboardingRequest {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return typeof input.authorizationCode === 'string' && input.authorizationCode.length > 0 && input.authorizationCode.length <= 4096 && !/[\r\n]/.test(input.authorizationCode)
    && typeof input.phoneNumberId === 'string' && /^\d{1,32}$/.test(input.phoneNumberId)
    && typeof input.whatsappBusinessAccountId === 'string' && /^\d{1,32}$/.test(input.whatsappBusinessAccountId);
}
