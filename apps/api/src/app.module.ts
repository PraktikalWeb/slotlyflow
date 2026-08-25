import { DynamicModule, Module } from '@nestjs/common';
import type { AuthenticationConfig } from '@slotlyflow/config';
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

@Module({})
export class AppModule {
  static register(
    database: DatabaseConnection,
    authConfig: AuthenticationConfig,
    oidcProvider?: OidcIdentityProvider,
    emailProvider?: EmailProvider,
  ): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, AuthController],
      providers: [
        ReadinessService,
        PasswordService,
        CsrfService,
        AuthRateLimiter,
        AuthService,
        OidcAuthenticationService,
        { provide: AUTH_DATABASE, useValue: database.db },
        { provide: AUTH_CONFIG, useValue: authConfig },
        { provide: EMAIL_PROVIDER, useValue: emailProvider ?? createEmailProvider(authConfig.email) },
        { provide: OIDC_IDENTITY_PROVIDER, useValue: oidcProvider ?? new GoogleOidcIdentityProvider(authConfig.googleOidc) },
      ],
    };
  }
}
