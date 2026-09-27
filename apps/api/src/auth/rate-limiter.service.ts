import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

export type AuthRateLimitPolicy = 'register' | 'login' | 'forgotPassword' | 'resetPassword' | 'verifyEmail' | 'resendVerification' | 'profileUpdate' | 'changePassword' | 'googleInitiate' | 'googleCallback';

const policies: Record<AuthRateLimitPolicy, { limit: number; windowMs: number }> = {
  register: { limit: 5, windowMs: 60_000 },
  login: { limit: 10, windowMs: 60_000 },
  forgotPassword: { limit: 5, windowMs: 60_000 },
  resetPassword: { limit: 5, windowMs: 60_000 },
  verifyEmail: { limit: 10, windowMs: 60_000 },
  resendVerification: { limit: 5, windowMs: 60_000 },
  profileUpdate: { limit: 20, windowMs: 60_000 },
  changePassword: { limit: 5, windowMs: 60_000 },
  googleInitiate: { limit: 10, windowMs: 60_000 },
  googleCallback: { limit: 10, windowMs: 60_000 },
};

/** Process-local adapter only. Replace with a shared Valkey adapter before horizontal deployment. */
@Injectable()
export class AuthRateLimiter {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  enforce(policy: AuthRateLimitPolicy, key: string): void {
    const definition = policies[policy];
    const now = Date.now();
    const mapKey = `${policy}:${key}`;
    const previous = this.attempts.get(mapKey);
    const current = previous === undefined || previous.resetAt <= now ? { count: 0, resetAt: now + definition.windowMs } : previous;
    current.count += 1;
    this.attempts.set(mapKey, current);
    if (current.count > definition.limit) throw new HttpException('Too many requests.', HttpStatus.TOO_MANY_REQUESTS);
  }

  /** Clears only ephemeral process-local counters; used to isolate integration tests. */
  reset(): void {
    this.attempts.clear();
  }
}
