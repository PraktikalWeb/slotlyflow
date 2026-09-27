import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { defaultPostAuthenticationPath, safePostAuthenticationPath, type AuthenticationAcceptedResponse, type AuthenticationPendingVerificationResponse, type AuthenticationResponse, type ChangeCurrentUserPasswordRequest, type EmailAddressRequest, type LoginRequest, type PasswordResetRequest, type RegisterRequest, type TokenRequest, type UpdateCurrentUserProfileRequest } from '@slotlyflow/contracts';
import type { AuthenticationConfig } from '@slotlyflow/config';

import { AuthService } from './auth.service.js';
import { AUTH_CONFIG } from './auth.tokens.js';
import { CsrfService } from './csrf.service.js';
import { AuthRateLimiter, type AuthRateLimitPolicy } from './rate-limiter.service.js';
import { OidcAuthenticationService } from './oidc/oidc-authentication.service.js';
import { createOidcDiagnosticReporter, safeExceptionType } from './oidc/oidc-diagnostics.js';
import {
  createRegistrationDiagnosticReporter,
  safeRegistrationExceptionType,
} from '../observability/registration-diagnostics.js';

const googleNonceCookieName = 'slotlyflow_google_oidc_nonce';
const googleVerifierCookieName = 'slotlyflow_google_oidc_verifier';
const googleReturnPathCookieName = 'slotlyflow_google_oidc_return_path';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthenticationConfig,
    @Inject(CsrfService) private readonly csrf: CsrfService,
    @Inject(AuthRateLimiter) private readonly limiter: AuthRateLimiter,
    @Inject(OidcAuthenticationService) private readonly oidc: OidcAuthenticationService,
  ) {}

  @Get('csrf')
  csrfToken(@Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply): { csrfToken: string } {
    const csrfToken = this.csrf.createToken();
    response.setCookie(this.csrf.cookieName, csrfToken, this.csrfCookieOptions(request));
    return { csrfToken };
  }

  @Post('register')
  async register(@Body() body: RegisterRequest, @Req() request: FastifyRequest): Promise<AuthenticationPendingVerificationResponse> {
    const diagnostics = createRegistrationDiagnosticReporter(request.id, request.log);
    diagnostics({ stage: 'register_request_received', outcome: 'success' });
    try {
      this.csrf.assert(request);
    } catch (error) {
      diagnostics({ stage: 'csrf_validation', outcome: 'failure', exceptionType: safeRegistrationExceptionType(error) });
      throw error;
    }
    diagnostics({ stage: 'csrf_validation', outcome: 'success' });
    this.limiter.enforce('register', request.ip);
    await this.auth.register(body.email, body.password, diagnostics, {
      firstName: body.firstName,
      lastName: body.lastName,
    });
    diagnostics({ stage: 'controller_service_returned', outcome: 'success' });
    return { status: 'EMAIL_VERIFICATION_REQUIRED' };
  }

  @Post('login')
  async login(@Body() body: LoginRequest, @Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply): Promise<AuthenticationResponse> {
    this.protect(request, 'login');
    const result = await this.auth.login(body.email, body.password);
    this.setSessionCookie(response, result.token, request);
    return { user: result.user };
  }

  @Get('me')
  async me(@Req() request: FastifyRequest): Promise<AuthenticationResponse> { return { user: await this.auth.current(request.cookies[this.config.session.cookieName]) }; }

  @Patch('me')
  async updateMe(@Body() body: UpdateCurrentUserProfileRequest, @Req() request: FastifyRequest): Promise<AuthenticationResponse> {
    this.protect(request, 'profileUpdate');
    return {
      user: await this.auth.updateProfile(
        request.cookies[this.config.session.cookieName],
        body?.firstName,
        body?.lastName,
      ),
    };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply): Promise<void> { this.csrf.assert(request); await this.auth.logout(request.cookies[this.config.session.cookieName]); response.clearCookie(this.config.session.cookieName, this.sessionCookieOptions(request)); }

  @Post('email/verify')
  async verify(@Body() body: TokenRequest, @Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply): Promise<AuthenticationResponse> { this.protect(request, 'verifyEmail'); const result = await this.auth.verifyEmail(body.token); this.setSessionCookie(response, result.sessionToken, request); return { user: result.user }; }

  @Post('email/resend')
  async resendVerification(@Body() body: EmailAddressRequest, @Req() request: FastifyRequest): Promise<AuthenticationAcceptedResponse> {
    this.protect(request, 'resendVerification');
    const emailForRateLimit = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    this.limiter.enforce('resendVerification', `email:${createHash('sha256').update(emailForRateLimit).digest('base64url')}`);
    await this.auth.resendVerification(body.email);
    return { status: 'ACCEPTED' };
  }

  @Post('password/forgot')
  async forgot(@Body() body: Pick<RegisterRequest, 'email'>, @Req() request: FastifyRequest): Promise<AuthenticationAcceptedResponse> {
    this.protect(request, 'forgotPassword');
    await this.auth.forgotPassword(typeof body?.email === 'string' ? body.email : '');
    return { status: 'ACCEPTED' };
  }

  @Post('password/reset')
  @HttpCode(204)
  async reset(@Body() body: PasswordResetRequest, @Req() request: FastifyRequest): Promise<void> { this.protect(request, 'resetPassword'); await this.auth.resetPassword(body.token, body.password); }

  @Post('password/change')
  async changePassword(
    @Body() body: ChangeCurrentUserPasswordRequest,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ): Promise<AuthenticationResponse> {
    this.protect(request, 'changePassword');
    const result = await this.auth.changePassword(
      request.cookies[this.config.session.cookieName],
      body?.currentPassword,
      body?.newPassword,
    );
    this.setSessionCookie(response, result.token, request);
    return { user: result.user };
  }

  /** OAuth callbacks use validated state, nonce, PKCE and exact redirect URI instead of the browser CSRF double-submit proof. */
  @Get('google')
  async beginGoogle(@Req() request: FastifyRequest, @Res() response: FastifyReply): Promise<void> {
    this.limiter.enforce('googleInitiate', request.ip);
    const result = await this.oidc.beginGoogleAuthorization();
    this.setGoogleTransactionCookie(response, googleNonceCookieName, result.cookies.nonce, request);
    this.setGoogleTransactionCookie(response, googleVerifierCookieName, result.cookies.codeVerifier, request);
    this.setGoogleTransactionCookie(response, googleReturnPathCookieName, safePostAuthenticationPath(queryValue(request.query, 'returnTo')), request);
    response.status(302).header('location', result.authorizationUrl).send();
  }

  @Get('google/callback')
  async completeGoogle(@Req() request: FastifyRequest, @Res() response: FastifyReply): Promise<void> {
    this.limiter.enforce('googleCallback', request.ip);
    const diagnostics = createOidcDiagnosticReporter(request.id, request.log);
    let sessionToken: string;
    const returnPath = safePostAuthenticationPath(request.cookies[googleReturnPathCookieName]);
    try {
      sessionToken = (await this.oidc.completeGoogleAuthorization(request.query, {
        nonce: request.cookies[googleNonceCookieName],
        codeVerifier: request.cookies[googleVerifierCookieName],
      }, diagnostics)).token;
    } finally {
      response.clearCookie(googleNonceCookieName, { path: '/auth/google/callback' });
      response.clearCookie(googleVerifierCookieName, { path: '/auth/google/callback' });
      response.clearCookie(googleReturnPathCookieName, { path: '/auth/google/callback' });
    }
    try {
      this.setSessionCookie(response, sessionToken, request);
      response.status(302).header('location', postAuthenticationLocation(this.config.googleOidc?.webAppUrl, returnPath)).send();
      diagnostics({ stage: 'final_redirect', outcome: 'success' });
    } catch (error) {
      diagnostics({ stage: 'final_redirect', outcome: 'failure', exceptionType: safeExceptionType(error) });
      throw error;
    }
  }

  private setSessionCookie(response: FastifyReply, token: string, request: FastifyRequest): void { response.setCookie(this.config.session.cookieName, token, this.sessionCookieOptions(request)); }
  private setGoogleTransactionCookie(response: FastifyReply, name: string, value: string, request: FastifyRequest): void { response.setCookie(name, value, { httpOnly: true, secure: this.isSecureRequest(request), sameSite: 'lax', path: '/auth/google/callback', maxAge: 600 }); }
  private sessionCookieOptions(request: FastifyRequest) { return { httpOnly: true, secure: this.isSecureRequest(request), sameSite: this.config.session.sameSite, path: '/', maxAge: this.config.session.lifetimeSeconds } as const; }
  private csrfCookieOptions(request: FastifyRequest) { return { httpOnly: false, secure: this.isSecureRequest(request), sameSite: this.config.session.sameSite, path: '/' } as const; }
  private isSecureRequest(request: FastifyRequest): boolean { return this.config.session.secure || forwardedProtocol(request) === 'https'; }
  private protect(request: FastifyRequest, policy: AuthRateLimitPolicy): void { this.csrf.assert(request); this.limiter.enforce(policy, request.ip); }
}

function forwardedProtocol(request: FastifyRequest): string | undefined {
  const value = request.headers['x-forwarded-proto'];
  const protocol = Array.isArray(value) ? value[0] : value;
  return protocol?.split(',', 1)[0]?.trim().toLowerCase();
}

function queryValue(query: unknown, name: string): unknown {
  return typeof query === 'object' && query !== null && name in query
    ? (query as Record<string, unknown>)[name]
    : undefined;
}

function postAuthenticationLocation(webAppUrl: string | undefined, returnPath: string): string {
  if (webAppUrl === undefined) return defaultPostAuthenticationPath;
  return new URL(returnPath, webAppUrl).toString();
}
