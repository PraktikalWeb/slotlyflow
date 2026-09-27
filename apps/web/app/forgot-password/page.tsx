'use client';

import Link from 'next/link';
import * as React from 'react';

import { Alert } from '@/components/feedback/Alert';
import {
  requestPasswordReset,
  type PasswordResetRequestIssue,
} from '@/src/auth/auth-client';

const issueMessages: Record<Exclude<PasswordResetRequestIssue, 'INVALID_EMAIL'>, string> = {
  RATE_LIMITED: 'Too many reset requests. Please wait a moment before trying again.',
  UNAVAILABLE: 'SlotlyFlow is temporarily unavailable. Please try again shortly.',
  UNEXPECTED: 'We could not request a password reset. Please try again.',
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [emailError, setEmailError] = React.useState<string>();
  const [issue, setIssue] = React.useState<Exclude<PasswordResetRequestIssue, 'INVALID_EMAIL'>>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAccepted, setIsAccepted] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSubmitting) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setEmailError(undefined);
    setIssue(undefined);
    setIsSubmitting(true);
    const result = await requestPasswordReset(normalizedEmail);
    setIsSubmitting(false);

    if (result.ok === true) {
      setIsAccepted(true);
      return;
    }
    if (result.issue === 'INVALID_EMAIL') {
      setEmailError('Enter a valid email address.');
      return;
    }
    setIssue(result.issue);
  }

  return (
    <div className="relative min-h-screen bg-[var(--canvas)] flex flex-col items-center justify-center p-6">
      <Link href="/" className="w-full max-w-[400px] flex justify-center mb-8" aria-label="SlotlyFlow home">
        <img
          src="/slotlyflow-official-full-logo.png"
          alt="SlotlyFlow"
          className="w-[180px] h-auto object-contain"
          onError={(event) => {
            event.currentTarget.src = '/slotlyflow-logo-transparent.png';
          }}
        />
      </Link>

      <main className="w-full max-w-[400px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-8 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-[24px] font-semibold text-[var(--ink)] tracking-tight mb-1">
            {isAccepted ? 'Check your email' : 'Reset your password'}
          </h1>
          <p className="text-[14px] text-[var(--ink-secondary)] leading-relaxed">
            {isAccepted
              ? 'If an eligible account exists for that email, we sent a secure password reset link.'
              : 'Enter your account email and we will send you a secure reset link.'}
          </p>
        </div>

        {isAccepted ? (
          <div className="space-y-4">
            <Alert kind="success">
              Check your inbox and follow the link to choose a new password. The link may take a minute to arrive.
            </Alert>
            <p className="text-[13px] text-[var(--ink-secondary)] text-center leading-relaxed">
              No email? Check your spam folder, or submit the form again after a short wait.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsAccepted(false);
                setIssue(undefined);
              }}
              className="w-full h-[44px] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] border border-[var(--border-strong)] text-[var(--ink)] text-[14px] font-medium rounded-[var(--radius-md)] transition-colors duration-150"
            >
              Request another link
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => { void handleSubmit(event); }} className="space-y-4" noValidate>
            {issue !== undefined && <Alert kind="error">{issueMessages[issue]}</Alert>}
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="text-[14px] font-medium text-[var(--ink)] block text-left">Email</label>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailError !== undefined) setEmailError(undefined);
                }}
                placeholder="name@company.com"
                aria-invalid={emailError === undefined ? undefined : true}
                aria-describedby={emailError === undefined ? undefined : 'reset-email-error'}
                className={`w-full h-[44px] px-3.5 rounded-[var(--radius-md)] border ${emailError === undefined ? 'border-[var(--border-strong)]' : 'border-[#FF7A66]'} text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] bg-[var(--surface)] outline-none transition-all duration-150 focus:border-[var(--brand-green)] focus:ring-[3px] focus:ring-[var(--brand-green)]/10`}
              />
              {emailError !== undefined && <p id="reset-email-error" className="text-[13px] text-[#C85040]">{emailError}</p>}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[44px] bg-[var(--brand-green)] hover:bg-[#002B21] text-white text-[14px] font-medium rounded-[var(--radius-md)] transition-colors duration-150 active:scale-[0.99] flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Sending link...' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/sign-in" className="text-[13px] font-medium text-[var(--brand-green)] hover:underline">
            Back to Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
