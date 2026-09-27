'use client';

import Link from 'next/link';
import React from 'react';

import {
  configuredApiBaseUrl,
  googleAuthorizationUrl,
  resolveBrowserPlatformAdminSession,
  resolveBrowserSession,
  safeAdminPostAuthenticationPath,
  safePostAuthenticationPath,
  submitSignIn,
  type SignInIssue,
} from '@/src/auth/auth-client';
import { GoogleMark } from '@/components/GoogleMark';
import { SemanticIcon } from '@/src/icons/semantic-icon';
import { Alert } from '@/components/feedback/Alert';

const messages: Record<SignInIssue, string> = {
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  EMAIL_VERIFICATION_REQUIRED: 'Verify your email before signing in.',
  RATE_LIMITED: 'Too many sign-in attempts. Please wait a moment before trying again.',
  UNAVAILABLE: 'SlotlyFlow is temporarily unavailable. Please try again shortly.',
  UNEXPECTED: 'We could not sign you in. Please try again.',
};

export function SignInScreen({ isAdmin = false }: { isAdmin?: boolean } = {}) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<'email' | 'password', string>>>({});
  const [issue, setIssue] = React.useState<SignInIssue>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const returnPath = React.useRef(isAdmin ? '/admin' : '/dashboard');

  React.useEffect(() => {
    const requestedPath = isAdmin
      ? safeAdminPostAuthenticationPath(new URLSearchParams(window.location.search).get('returnTo'))
      : safePostAuthenticationPath(new URLSearchParams(window.location.search).get('returnTo'));
    returnPath.current = requestedPath;

    const resolveSession = isAdmin ? resolveBrowserPlatformAdminSession : resolveBrowserSession;
    void resolveSession()
      .then((status) => {
        if (status === 'authenticated') window.location.replace(requestedPath);
      })
      .catch(() => {
        // An unavailable session probe never grants access.
      });
  }, [isAdmin]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validateFields(email, password);
    setFieldErrors(errors);
    setIssue(undefined);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    const result = await submitSignIn({ email, password });
    if (result.ok === false) {
      setIsSubmitting(false);
      setIssue(result.issue);
      return;
    }
      window.location.assign(returnPath.current);
  }

  function beginGoogle(): void {
    if (isSubmitting) return;

    try {
      setIssue(undefined);
      setIsSubmitting(true);
      window.location.assign(googleAuthorizationUrl(configuredApiBaseUrl(), returnPath.current));
    } catch {
      setIsSubmitting(false);
      setIssue('UNAVAILABLE');
    }
  }

  return (
    <div className="relative min-h-screen bg-[var(--canvas)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] flex justify-center mb-8">
        <img
          src="/slotlyflow-official-full-logo.png"
          alt="SlotlyFlow"
          className="w-[180px] h-auto object-contain"
          onError={(event) => {
            event.currentTarget.src = '/slotlyflow-logo-transparent.png';
          }}
        />
      </div>

      <div className="w-full max-w-[400px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-8 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-[24px] font-semibold text-[var(--ink)] tracking-tight mb-1">
            {isAdmin ? 'Platform Admin' : 'Welcome back'}
          </h1>
          <p className="text-[14px] text-[var(--ink-secondary)]">
            {isAdmin ? 'Sign in to manage the SlotlyFlow platform.' : 'Sign in to your account'}
          </p>
        </div>

        {issue !== undefined && (
          <Alert id="sign-in-feedback" kind="error" className="mb-4">
            {messages[issue]}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-describedby={issue === undefined ? undefined : 'sign-in-feedback'}>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[14px] font-medium text-[var(--ink)] block text-left">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldErrors.email !== undefined) setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
              placeholder="name@company.com"
              aria-invalid={fieldErrors.email === undefined ? undefined : true}
              aria-describedby={fieldErrors.email === undefined ? undefined : 'email-error'}
              className={`w-full h-[44px] px-3.5 rounded-[var(--radius-md)] border ${fieldErrors.email === undefined ? 'border-[var(--border-strong)]' : 'border-[#FF7A66]'} text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] bg-[var(--surface)] outline-none transition-all duration-150 focus:border-[var(--brand-green)] focus:ring-[3px] focus:ring-[var(--brand-green)]/10`}
            />
            {fieldErrors.email !== undefined && <p id="email-error" className="text-[13px] text-[#C85040]">{fieldErrors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <div className={`flex items-center ${isAdmin ? '' : 'justify-between'}`}>
              <label htmlFor="password" className="text-[14px] font-medium text-[var(--ink)]">Password</label>
              {!isAdmin && (
                <Link href="/forgot-password" className="text-[13px] font-medium text-[var(--brand-green)] hover:underline focus:outline-none">Forgot password?</Link>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (fieldErrors.password !== undefined) setFieldErrors((current) => ({ ...current, password: undefined }));
                }}
                placeholder="••••••••"
                aria-invalid={fieldErrors.password === undefined ? undefined : true}
                aria-describedby={fieldErrors.password === undefined ? undefined : 'password-error'}
                className={`w-full h-[44px] px-3.5 pr-10 rounded-[var(--radius-md)] border ${fieldErrors.password === undefined ? 'border-[var(--border-strong)]' : 'border-[#FF7A66]'} text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] bg-[var(--surface)] outline-none transition-all duration-150 focus:border-[var(--brand-green)] focus:ring-[3px] focus:ring-[var(--brand-green)]/10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors focus:outline-none"
              >
                {showPassword ? <SemanticIcon concept="passwordHidden" className="w-4 h-4" /> : <SemanticIcon concept="passwordVisible" className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password !== undefined && <p id="password-error" className="text-[13px] text-[#C85040]">{fieldErrors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 h-[44px] bg-[var(--brand-green)] hover:bg-[#002B21] text-white text-[14px] font-medium rounded-[var(--radius-md)] transition-colors duration-150 active:scale-[0.99] flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {!isAdmin && (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[12px] text-[var(--ink-tertiary)] uppercase font-medium tracking-wider bg-[var(--surface)] px-1">Or</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={beginGoogle}
              className="w-full h-[44px] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] border border-[var(--border-strong)] text-[var(--ink)] text-[14px] font-medium rounded-[var(--radius-md)] flex items-center justify-center gap-2.5 transition-colors duration-150 active:scale-[0.99] shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <GoogleMark className="w-4 h-4 shrink-0" />
              Continue with Google
            </button>

            <div className="mt-8 text-center">
              <p className="text-[14px] text-[var(--ink-secondary)] font-medium">
                Don't have an account? <Link href="/sign-up" className="text-[var(--brand-green)] font-semibold hover:underline focus:outline-none">Sign up</Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function validateFields(email: string, password: string): Partial<Record<'email' | 'password', string>> {
  const errors: Partial<Record<'email' | 'password', string>> = {};
  if (email.trim() === '') errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (password === '') errors.password = 'Enter your password.';
  return errors;
}
