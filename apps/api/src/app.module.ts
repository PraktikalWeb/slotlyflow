import { DynamicModule, Module } from '@nestjs/common';
import type { AuthenticationConfig, MetaWhatsAppConfig } from '@slotlyflow/config';
import type { DatabaseConnection } from '@slotlyflow/database';

import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AUTH_CONFIG, AUTH_DATABASE, EMAIL_PROVIDER, OIDC_IDENTITY_PROVIDER } from './auth/auth.tokens.js';
import { PasswordService } from './auth/password.service.js';
import { CsrfService } from './auth/csrf.service.js';
import { AuthRateLimiter } from './auth/rate-limiter.service.js';
import { GoogleOidcIdentityProvider } from './auth/oidc/google-oidc.provider.js';
import type { OidcIdentityProvider } from './auth/oidc/oidc-identity-provider.js';
import { OidcAuthenticationService } from './auth/oidc/oidc-authentication.service.js';
import { createEmailProvider } from './email/email-provider.factory.js';
import type { EmailProvider } from './email/email-provider.js';
import { HealthController } from './health.controller.js';
import { ReadinessService } from './readiness.service.js';
import { OrganizationController } from './organizations/organization.controller.js';
import { OrganizationContextService } from './organizations/organization-context.service.js';
import { DrizzleOrganizationRepository } from './organizations/organization.repository.js';
import { OrganizationService } from './organizations/organization.service.js';
import { ORGANIZATION_REPOSITORY } from './organizations/organization.tokens.js';
import { WhatsAppConnectionController } from './whatsapp/whatsapp-connection.controller.js';
import { DrizzleWhatsAppConnectionRepository } from './whatsapp/whatsapp-connection.repository.js';
import { WhatsAppConnectionService } from './whatsapp/whatsapp-connection.service.js';
import { WHATSAPP_CONNECTION_REPOSITORY } from './whatsapp/whatsapp-connection.tokens.js';
import { WhatsAppOnboardingController } from './whatsapp/whatsapp-onboarding.controller.js';
import { WhatsAppOnboardingHandoffController } from './whatsapp/whatsapp-onboarding-handoff.controller.js';
import { DrizzleWhatsAppOnboardingTransactionRepository } from './whatsapp/whatsapp-onboarding.repository.js';
import { WhatsAppOnboardingService } from './whatsapp/whatsapp-onboarding.service.js';
import { META_WHATSAPP_CONFIG, WHATSAPP_ONBOARDING_TRANSACTION_REPOSITORY } from './whatsapp/whatsapp-onboarding.tokens.js';
import { WHATSAPP_CONNECTION_PROVIDER } from './whatsapp/whatsapp-onboarding.tokens.js';
import { DrizzleWhatsAppOnboardingCompletionRepository } from './whatsapp/whatsapp-onboarding-completion.repository.js';
import { MetaWhatsAppConnectionProvider } from './whatsapp/meta-whatsapp-connection.provider.js';
import type { WhatsAppConnectionProvider } from './whatsapp/whatsapp-provider.js';
import { MetaWhatsAppWebhookController } from './whatsapp/meta-whatsapp-webhook.controller.js';
import { InboundWhatsAppMessageService } from './whatsapp/inbound-whatsapp-message.service.js';
import { DrizzleInboundWhatsAppMessageRepository } from './whatsapp/inbound-whatsapp-message.repository.js';
import { WHATSAPP_INBOUND_MESSAGE_REPOSITORY } from './whatsapp/whatsapp-inbound-message.tokens.js';
import { WHATSAPP_CREDENTIAL_STORE, WHATSAPP_MESSAGING_PROVIDER, WHATSAPP_OUTBOUND_MESSAGE_REPOSITORY } from './whatsapp/whatsapp-inbound-message.tokens.js';
import { DrizzleCredentialStore, type CredentialStore } from './whatsapp/credential-store.js';
import { MetaWhatsAppMessagingProvider } from './whatsapp/meta-whatsapp-messaging.provider.js';
import type { WhatsAppMessagingProvider } from './whatsapp/whatsapp-messaging-provider.js';
import { DrizzleOutboundWhatsAppMessageRepository } from './whatsapp/outbound-whatsapp-message.repository.js';
import { OutboundWhatsAppMessageService } from './whatsapp/outbound-whatsapp-message.service.js';
import { ConversationMessageController } from './whatsapp/conversation-message.controller.js';
import { WhatsAppConnectionTestController } from './whatsapp/whatsapp-connection-test.controller.js';
import { WhatsAppConnectionTestService } from './whatsapp/whatsapp-connection-test.service.js';
import { DrizzleWhatsAppConnectionTestRepository } from './whatsapp/whatsapp-connection-test.repository.js';
import { PlatformAdminModule } from './platform-admin/platform-admin.module.js';
import { ContactService } from './contacts/contact.service.js';
import { DrizzleContactRepository } from './contacts/contact.repository.js';
import { NotificationController } from './notifications/notification.controller.js';
import { NotificationPreferencesController } from './notifications/notification-preferences.controller.js';
import { DrizzleNotificationRepository } from './notifications/notification.repository.js';
import { NotificationService } from './notifications/notification.service.js';
import { NotificationDeliveryScheduler, NotificationDeliveryService } from './notifications/notification-delivery.service.js';
import { BuiltInBotRuntime } from './bots/built-in-bot-runtime.service.js';
import { BotPublicationController } from './bots/bot-publication.controller.js';
import { BotPreviewController } from './bots/bot-preview.controller.js';
import { BotPreviewService } from './bots/bot-preview.service.js';
import { DrizzleBotConversationStateRepository } from './bots/bot-conversation-state.repository.js';
import { BOT_CONVERSATION_STATE_REPOSITORY } from './bots/bot-conversation-state.tokens.js';
import { BotPreviewSessionStore } from './bots/bot-preview-session.store.js';

@Module({})
export class AppModule {
  static register(
    database: DatabaseConnection,
    authConfig: AuthenticationConfig,
    oidcProvider?: OidcIdentityProvider,
    emailProvider?: EmailProvider,
    metaWhatsAppConfig?: MetaWhatsAppConfig,
    whatsappConnectionProvider?: WhatsAppConnectionProvider,
    whatsappMessagingProvider?: WhatsAppMessagingProvider,
    credentialStore?: CredentialStore,
  ): DynamicModule {
    const resolvedCredentialStore = credentialStore ?? (metaWhatsAppConfig === undefined
      ? undefined
      : new DrizzleCredentialStore(database.db, metaWhatsAppConfig.credentialEncryptionKey));
    return {
      module: AppModule,
      imports: [PlatformAdminModule.register(database, authConfig)],
      controllers: [HealthController, AuthController, OrganizationController, WhatsAppConnectionController, WhatsAppOnboardingController, WhatsAppOnboardingHandoffController, MetaWhatsAppWebhookController, ConversationMessageController, WhatsAppConnectionTestController, NotificationController, NotificationPreferencesController, BotPublicationController, BotPreviewController],
      providers: [
        ReadinessService,
        PasswordService,
        CsrfService,
        AuthRateLimiter,
        AuthService,
        OidcAuthenticationService,
        OrganizationService,
        OrganizationContextService,
        DrizzleOrganizationRepository,
        WhatsAppConnectionService,
        DrizzleWhatsAppConnectionRepository,
        WhatsAppOnboardingService,
        DrizzleWhatsAppOnboardingTransactionRepository,
        DrizzleWhatsAppOnboardingCompletionRepository,
        InboundWhatsAppMessageService,
        DrizzleInboundWhatsAppMessageRepository,
        OutboundWhatsAppMessageService,
        DrizzleOutboundWhatsAppMessageRepository,
        WhatsAppConnectionTestService,
        DrizzleWhatsAppConnectionTestRepository,
        ContactService,
        DrizzleContactRepository,
        NotificationService,
        DrizzleNotificationRepository,
        NotificationDeliveryService,
        NotificationDeliveryScheduler,
        BuiltInBotRuntime,
        BotPreviewService,
        BotPreviewSessionStore,
        DrizzleBotConversationStateRepository,
        { provide: ORGANIZATION_REPOSITORY, useExisting: DrizzleOrganizationRepository },
        { provide: WHATSAPP_CONNECTION_REPOSITORY, useExisting: DrizzleWhatsAppConnectionRepository },
        { provide: WHATSAPP_ONBOARDING_TRANSACTION_REPOSITORY, useExisting: DrizzleWhatsAppOnboardingTransactionRepository },
        { provide: WHATSAPP_INBOUND_MESSAGE_REPOSITORY, useExisting: DrizzleInboundWhatsAppMessageRepository },
        { provide: WHATSAPP_OUTBOUND_MESSAGE_REPOSITORY, useExisting: DrizzleOutboundWhatsAppMessageRepository },
        { provide: BOT_CONVERSATION_STATE_REPOSITORY, useExisting: DrizzleBotConversationStateRepository },
        { provide: WHATSAPP_CREDENTIAL_STORE, useValue: resolvedCredentialStore },
        {
          provide: WHATSAPP_MESSAGING_PROVIDER,
          useValue: whatsappMessagingProvider ?? (metaWhatsAppConfig === undefined || resolvedCredentialStore === undefined
            ? undefined
            : new MetaWhatsAppMessagingProvider(metaWhatsAppConfig, resolvedCredentialStore)),
        },
        { provide: META_WHATSAPP_CONFIG, useValue: metaWhatsAppConfig },
        {
          provide: WHATSAPP_CONNECTION_PROVIDER,
          useValue: whatsappConnectionProvider ?? (
            metaWhatsAppConfig === undefined || resolvedCredentialStore === undefined
              ? undefined
              : new MetaWhatsAppConnectionProvider(metaWhatsAppConfig, resolvedCredentialStore)
          ),
        },
        { provide: AUTH_DATABASE, useValue: database.db },
        { provide: AUTH_CONFIG, useValue: authConfig },
        { provide: EMAIL_PROVIDER, useValue: emailProvider ?? createEmailProvider(authConfig.email) },
        { provide: OIDC_IDENTITY_PROVIDER, useValue: oidcProvider ?? new GoogleOidcIdentityProvider(authConfig.googleOidc) },
      ],
    };
  }
}
