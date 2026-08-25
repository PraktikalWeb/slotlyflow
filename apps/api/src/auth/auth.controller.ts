import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticationAcceptedResponse, AuthenticationPendingVerificationResponse, AuthenticationResponse, EmailAddressRequest, LoginRequest, PasswordResetRequest, RegisterRequest, TokenRequest } from '@slotlyflow/contracts';
import type { AuthenticationConfig } from '@slotlyflow/config';

import { AuthService } from './auth.service.js';
import { AUTH_CONFIG } from './auth.tokens.js';
import { CsrfService } from './csrf.service.js';
import { AuthRateLimiter, type AuthRateLimitPolicy } from './rate-limiter.service.js';
import { OidcAuthenticationService } from './oidc/oidc-authentication.service.js';

const googleNonceCookieName = 'slotlyflow_google_oidc_nonce';
const googleVerifierCookieName = 'slotlyflow_google_oidc_verifier';

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
  csrfToken(@Res({ passthrough: true }) response: FastifyReply): { csrfToken: string } {
    const csrfToken = this.csrf.createToken();
    response.setCookie(this.csrf.cookieName, csrfToken, { httpOnly: false, secure: this.config.session.secure, sameSite: this.config.session.sameSite, path: '/' });
    return { csrfToken };
  }

  @Post('register')
  async register(@Body() body: RegisterRequest, @Req() request: FastifyRequest): Promise<AuthenticationPendingVerificationResponse> {
    this.protect(request, 'register');
    await this.auth.register(body.email, body.password);
    return { status: 'EMAIL_VERIFICATION_REQUIRED' };
  }

  @Post('login')
  async login(@Body() body: LoginRequest, @Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply): Promise<AuthenticationResponse> {
    this.protect(request, 'login');
    const result = await this.auth.login(body.email, body.password);
    this.setSessionCookie(response, result.token);
    return { user: result.user };
  }

  @Get('me')
  async me(@Req() request: FastifyRequest): Promise<AuthenticationResponse> { return { user: await this.auth.current(request.cookies[this.config.session.cookieName]) }; }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply): Promise<void> { this.csrf.assert(request); await this.auth.logout(request.cookies[this.config.session.cookieName]); response.clearCookie(this.config.session.cookieName, { path: '/' }); }

  @Post('email/verify')
  async verify(@Body() body: TokenRequest, @Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply): Promise<AuthenticationResponse> { this.protect(request, 'verifyEmail'); const result = await this.auth.verifyEmail(body.token); this.setSessionCookie(response, result.sessionToken); return { user: result.user }; }

  @Post('email/resend')
  async resendVerification(@Body() body: EmailAddressRequest, @Req() request: FastifyRequest): Promise<AuthenticationAcceptedResponse> {
    this.protect(request, 'resendVerification');
    const emailForRateLimit = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    this.limiter.enforce('resendVerification', `email:${createHash('sha256').update(emailForRateLimit).digest('base64url')}`);
    await this.auth.resendVerification(body.email);
    return { status: 'ACCEPTED' };
  }

  @Post('password/forgot')
  async forgot(@Body() body: Pick<RegisterRequest, 'email'>, @Req() request: FastifyRequest): Promise<AuthenticationAcceptedResponse> { this.protect(request, 'forgotPassword'); await this.auth.forgotPassword(body.email); return { status: 'ACCEPTED' }; }

  @Post('password/reset')
  @HttpCode(204)
  async reset(@Body() body: PasswordResetRequest, @Req() request: FastifyRequest): Promise<void> { this.protect(request, 'resetPassword'); await this.auth.resetPassword(body.token, body.password); }

  /** OAuth callbacks use validated state, nonce, PKCE and exact redirect URI instead of the browser CSRF double-submit proof. */
  @Get('google')
  async beginGoogle(@Req() request: FastifyRequest, @Res() response: FastifyReply): Promise<void> {
    this.limiter.enforce('googleInitiate', request.ip);
    const result = await this.oidc.beginGoogleAuthorization();
    this.setGoogleTransactionCookie(response, googleNonceCookieName, result.cookies.nonce);
    this.setGoogleTransactionCookie(response, googleVerifierCookieName, result.cookies.codeVerifier);
    response.status(302).header('location', result.authorizationUrl).send();
  }

  @Get('google/callback')
  async completeGoogle(@Req() request: FastifyRequest, @Res() response: FastifyReply): Promise<void> {
    this.limiter.enforce('googleCallback', request.ip);
    let sessionToken: string;
    try {
      sessionToken = (await this.oidc.completeGoogleAuthorization(request.query, {
        nonce: request.cookies[googleNonceCookieName],
        codeVerifier: request.cookies[googleVerifierCookieName],
      })).token;
    } finally {
      response.clearCookie(googleNonceCookieName, { path: '/auth/google/callback' });
      response.clearCookie(googleVerifierCookieName, { path: '/auth/google/callback' });
    }
    this.setSessionCookie(response, sessionToken);
    response.status(302).header('location', this.config.googleOidc?.webAppUrl ?? '/').send();
  }

  private setSessionCookie(response: FastifyReply, token: string): void { response.setCookie(this.config.session.cookieName, token, { httpOnly: true, secure: this.config.session.secure, sameSite: this.config.session.sameSite, path: '/', maxAge: this.config.session.lifetimeSeconds }); }
  private setGoogleTransactionCookie(response: FastifyReply, name: string, value: string): void { response.setCookie(name, value, { httpOnly: true, secure: this.config.session.secure, sameSite: 'lax', path: '/auth/google/callback', maxAge: 600 }); }
  private protect(request: FastifyRequest, policy: AuthRateLimitPolicy): void { this.csrf.assert(request); this.limiter.enforce(policy, request.ip); }
}
