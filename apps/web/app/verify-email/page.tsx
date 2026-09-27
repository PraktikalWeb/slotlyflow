'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { SemanticIcon } from '@/src/icons/semantic-icon';
import {
  resendVerificationEmail,
  verificationTokenFromSearch,
  verifyEmailOnce,
  type ResendVerificationIssue,
  type VerificationIssue,
} from '@/src/auth/auth-client';

type VerificationState =
  | { readonly status: 'pending' }
  | { readonly status: 'verifying' }
  | { readonly status: 'success' }
  | { readonly status: 'error'; readonly issue: VerificationIssue };

const verificationMessages: Record<VerificationIssue, string> = {
  TOKEN_UNAVAILABLE: 'This verification link is invalid, expired, or has already been used. Request a new link to continue.',
  RATE_LIMITED: 'Please wait a moment before trying this verification link again.',
  UNAVAILABLE: 'SlotlyFlow is temporarily unavailable. Please try again shortly.',
  UNEXPECTED: 'We could not verify your email. Please try the verification link again.',
};

const resendMessages: Record<Exclude<ResendVerificationIssue, 'INVALID_EMAIL'>, string> = {
  RATE_LIMITED: 'Please wait a moment before requesting another link.',
  UNAVAILABLE: 'SlotlyFlow is temporarily unavailable. Please try again shortly.',
  UNEXPECTED: 'We could not send another verification link. Please try again.',
};

import { Alert } from '@/components/feedback/Alert';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [state, setState] = React.useState<VerificationState>({ status: 'pending' });
  const [email, setEmail] = React.useState('');
  const [emailError, setEmailError] = React.useState<string>();
  const [resendFeedback, setResendFeedback] = React.useState<{ kind: 'success' | 'error'; message: string }>();
  const [isResending, setIsResending] = React.useState(false);

  React.useEffect(() => {
    void Promise.resolve().then(async () => {
      const search = window.location.search;
      const tokenParameterPresent = new URLSearchParams(search).has('token');
      const token = verificationTokenFromSearch(search);

      if (token === undefined) {
        if (tokenParameterPresent) {
          removeVerificationTokenFromUrl();
          setState({ status: 'error', issue: 'TOKEN_UNAVAILABLE' });
        }
        return;
      }

      setState({ status: 'verifying' });
      const result = await verifyEmailOnce(token);
      removeVerificationTokenFromUrl();
      if (result.ok === true) {
        setState({ status: 'success' });
        return;
      }
      setState({ status: 'error', issue: result.issue });
    });
  }, []);

  async function handleResend(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isResending) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setEmailError(undefined);
    setResendFeedback(undefined);
    setIsResending(true);
    const result = await resendVerificationEmail(normalizedEmail);
    setIsResending(false);
    if (result.ok === true) {
      setResendFeedback({ kind: 'success', message: 'If the account is eligible, a new verification link has been sent.' });
      return;
    }
    setResendFeedback({
      kind: 'error',
      message: result.issue === 'INVALID_EMAIL'
        ? 'Enter a valid email address.'
        : resendMessages[result.issue]
    });
  }

  const isError = state.status === 'error';
  const showResend = state.status === 'pending' || isError;

  return (
    <div className="relative min-h-screen bg-[var(--canvas)] flex flex-col items-center justify-center p-6">
      <button type="button" className="w-full max-w-[400px] flex justify-center mb-8" onClick={() => router.push('/')}>
        <img
          src="/slotlyflow-official-full-logo.png"
          alt="SlotlyFlow"
          className="w-[180px] h-auto object-contain"
          onError={(event) => {
            event.currentTarget.src = '/slotlyflow-logo-transparent.png';
          }}
        />
      </button>

      <main className="w-full max-w-[400px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-8 shadow-sm text-center" aria-live="polite">
        {state.status === 'verifying' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[var(--brand-green)]/10 flex items-center justify-center mx-auto mb-6">
              <div className="w-7 h-7 border-2 border-[var(--brand-green)]/20 border-t-[var(--brand-green)] rounded-full animate-spin" aria-hidden="true" />
            </div>
            <h1 className="text-[24px] font-semibold text-[var(--ink)] tracking-tight mb-2">Verifying email</h1>
            <p className="text-[14px] text-[var(--ink-secondary)] leading-relaxed">Please wait while we securely verify your email address.</p>
          </>
        )}

        {state.status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#B7F34A]/20 flex items-center justify-center mx-auto mb-6">
              <SemanticIcon concept="success" className="w-8 h-8 text-[var(--brand-green)]" />
            </div>
            <h1 className="text-[24px] font-semibold text-[var(--ink)] tracking-tight mb-2">Verified</h1>
            <p className="text-[14px] text-[var(--ink-secondary)] mb-8">Your email is verified. Let&apos;s set up your Business.</p>
            <button
              type="button"
              onClick={() => router.replace('/onboarding/business')}
              className="w-full h-[44px] bg-[var(--brand-green)] hover:bg-[#002B21] text-white text-[14px] font-medium rounded-[var(--radius-md)] transition-colors duration-150 active:scale-[0.99] flex items-center justify-center shadow-sm gap-2 group"
            >
              Continue
              <SemanticIcon concept="arrowRight" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </>
        )}

        {showResend && (
          <>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${isError ? 'bg-[#FF7A66]/10' : 'bg-[var(--brand-green)]/10'}`}>
              <SemanticIcon concept={isError ? 'alert' : 'email'} className={`w-8 h-8 ${isError ? 'text-[#C85040]' : 'text-[var(--brand-green)]'}`} />
            </div>
            <h1 className="text-[24px] font-semibold text-[var(--ink)] tracking-tight mb-2">
              {isError ? 'Verification link unavailable' : 'Check your email'}
            </h1>
            <p className="text-[14px] text-[var(--ink-secondary)] mb-6 leading-relaxed">
              {isError
                ? verificationMessages[state.issue]
                : 'Use the secure verification link in your email to finish creating your account.'}
            </p>

            <form className="space-y-3 text-left" noValidate onSubmit={(event) => { void handleResend(event); }}>
              <div className="space-y-1.5">
                <label htmlFor="verification-email" className="text-[14px] font-medium text-[var(--ink)] block">Email address</label>
                <input
                  id="verification-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (emailError !== undefined) setEmailError(undefined);
                  }}
                  aria-invalid={emailError === undefined ? undefined : true}
                  aria-describedby={emailError === undefined ? undefined : 'verification-email-error'}
                  className={`w-full h-[44px] px-3.5 rounded-[var(--radius-md)] border ${emailError === undefined ? 'border-[var(--border-strong)]' : 'border-[#FF7A66]'} text-[14px] text-[var(--ink)] bg-[var(--surface)] outline-none transition-all duration-150 focus:border-[var(--brand-green)] focus:ring-[3px] focus:ring-[var(--brand-green)]/10`}
                />
                {emailError !== undefined && <p id="verification-email-error" className="text-[13px] text-[#C85040]">{emailError}</p>}
              </div>
              <button
                type="submit"
                disabled={isResending}
                className="w-full h-[44px] bg-[var(--brand-green)] hover:bg-[#002B21] text-white text-[14px] font-medium rounded-[var(--radius-md)] transition-colors duration-150 active:scale-[0.99] flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isResending ? 'Sending link...' : 'Send verification link'}
              </button>
              {resendFeedback !== undefined && (
                <Alert kind={resendFeedback.kind} className="mt-3">
                  {resendFeedback.message}
                </Alert>
              )}
            </form>

            <button type="button" onClick={() => router.push('/sign-in')} className="mt-5 text-[13px] font-medium text-[var(--brand-green)] hover:underline">
              Back to Sign In
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function removeVerificationTokenFromUrl(): void {
  window.history.replaceState(null, '', window.location.pathname);
}
