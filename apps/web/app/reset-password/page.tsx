'use client';

import Link from 'next/link';
import * as React from 'react';

import { Alert } from '@/components/feedback/Alert';
import {
  passwordResetTokenFromSearch,
  submitPasswordReset,
  type PasswordResetIssue,
} from '@/src/auth/auth-client';
import { SemanticIcon } from '@/src/icons/semantic-icon';

const issueMessages: Record<PasswordResetIssue, string> = {
  TOKEN_UNAVAILABLE: 'This reset link is invalid, expired, or has already been used. Request a new link to continue.',
  RATE_LIMITED: 'Too many reset attempts. Please wait a moment before trying again.',
  UNAVAILABLE: 'SlotlyFlow is temporarily unavailable. Please try again shortly.',
  UNEXPECTED: 'We could not reset your password. Please try again.',
};

type ResetState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly token: string }
  | { readonly status: 'success' }
  | { readonly status: 'error'; readonly issue: PasswordResetIssue };

export default function ResetPasswordPage() {
  const initialized = React.useRef(false);
  const [state, setState] = React.useState<ResetState>({ status: 'loading' });
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<'password' | 'confirmPassword', string>>>({});
  const [submitIssue, setSubmitIssue] = React.useState<Exclude<PasswordResetIssue, 'TOKEN_UNAVAILABLE'>>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const token = passwordResetTokenFromSearch(window.location.search);
    window.history.replaceState(null, '', window.location.pathname);
    setState(token === undefined
      ? { status: 'error', issue: 'TOKEN_UNAVAILABLE' }
      : { status: 'ready', token });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSubmitting || state.status !== 'ready') return;

    const errors = validatePasswords(password, confirmPassword);
    setFieldErrors(errors);
    setSubmitIssue(undefined);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    const result = await submitPasswordReset({ token: state.token, password });
    setIsSubmitting(false);
    if (result.ok === true) {
      setPassword('');
      setConfirmPassword('');
      setState({ status: 'success' });
      return;
    }
    if (result.issue === 'TOKEN_UNAVAILABLE') {
      setState({ status: 'error', issue: result.issue });
      return;
    }
    setSubmitIssue(result.issue);
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
        {state.status === 'loading' && (
          <div className="text-center" role="status">
            <div className="w-8 h-8 border-2 border-[var(--brand-green)]/20 border-t-[var(--brand-green)] rounded-full animate-spin mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-[24px] font-semibold text-[var(--ink)] tracking-tight mb-1">Opening reset link</h1>
            <p className="text-[14px] text-[var(--ink-secondary)]">Please wait a moment.</p>
          </div>
        )}

        {state.status === 'ready' && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-[24px] font-semibold text-[var(--ink)] tracking-tight mb-1">Choose a new password</h1>
              <p className="text-[14px] text-[var(--ink-secondary)]">Use between 12 and 256 characters.</p>
            </div>
            <form onSubmit={(event) => { void handleSubmit(event); }} className="space-y-4" noValidate>
              {submitIssue !== undefined && <Alert kind="error">{issueMessages[submitIssue]}</Alert>}
              <PasswordField
                id="new-password"
                label="New password"
                value={password}
                visible={showPassword}
                error={fieldErrors.password}
                autoComplete="new-password"
                onToggle={() => setShowPassword((visible) => !visible)}
                onChange={(value) => {
                  setPassword(value);
                  if (fieldErrors.password !== undefined) setFieldErrors((current) => ({ ...current, password: undefined }));
                }}
              />
              <PasswordField
                id="confirm-new-password"
                label="Confirm new password"
                value={confirmPassword}
                visible={showConfirmPassword}
                error={fieldErrors.confirmPassword}
                autoComplete="new-password"
                onToggle={() => setShowConfirmPassword((visible) => !visible)}
                onChange={(value) => {
                  setConfirmPassword(value);
                  if (fieldErrors.confirmPassword !== undefined) setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
                }}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[44px] bg-[var(--brand-green)] hover:bg-[#002B21] text-white text-[14px] font-medium rounded-[var(--radius-md)] transition-colors duration-150 active:scale-[0.99] flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Resetting password...' : 'Reset password'}
              </button>
            </form>
          </>
        )}

        {state.status === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#B7F34A]/20 flex items-center justify-center mx-auto mb-6">
              <SemanticIcon concept="success" className="w-8 h-8 text-[var(--brand-green)]" />
            </div>
            <h1 className="text-[24px] font-semibold text-[var(--ink)] tracking-tight mb-2">Password reset</h1>
            <p className="text-[14px] text-[var(--ink-secondary)] mb-6">Your password has been updated. Sign in with your new password.</p>
            <Link href="/sign-in" className="w-full h-[44px] bg-[var(--brand-green)] hover:bg-[#002B21] text-white text-[14px] font-medium rounded-[var(--radius-md)] transition-colors flex items-center justify-center shadow-sm">
              Sign in
            </Link>
          </div>
        )}

        {state.status === 'error' && (
          <div className="text-center">
            <h1 className="text-[24px] font-semibold text-[var(--ink)] tracking-tight mb-4">Reset link unavailable</h1>
            <Alert kind="error" className="mb-6">{issueMessages[state.issue]}</Alert>
            <Link href="/forgot-password" className="w-full h-[44px] bg-[var(--brand-green)] hover:bg-[#002B21] text-white text-[14px] font-medium rounded-[var(--radius-md)] transition-colors flex items-center justify-center shadow-sm">
              Request a new link
            </Link>
            <Link href="/sign-in" className="inline-block mt-5 text-[13px] font-medium text-[var(--brand-green)] hover:underline">
              Back to Sign In
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

interface PasswordFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly visible: boolean;
  readonly error: string | undefined;
  readonly autoComplete: string;
  readonly onToggle: () => void;
  readonly onChange: (value: string) => void;
}

function PasswordField({ id, label, value, visible, error, autoComplete, onToggle, onChange }: PasswordFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[14px] font-medium text-[var(--ink)] block text-left">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={error === undefined ? undefined : errorId}
          className={`w-full h-[44px] px-3.5 pr-10 rounded-[var(--radius-md)] border ${error === undefined ? 'border-[var(--border-strong)]' : 'border-[#FF7A66]'} text-[14px] text-[var(--ink)] bg-[var(--surface)] outline-none transition-all duration-150 focus:border-[var(--brand-green)] focus:ring-[3px] focus:ring-[var(--brand-green)]/10`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors focus:outline-none"
        >
          {visible ? <SemanticIcon concept="passwordHidden" className="w-4 h-4" /> : <SemanticIcon concept="passwordVisible" className="w-4 h-4" />}
        </button>
      </div>
      {error !== undefined && <p id={errorId} className="text-[13px] text-[#C85040]">{error}</p>}
    </div>
  );
}

function validatePasswords(password: string, confirmPassword: string): Partial<Record<'password' | 'confirmPassword', string>> {
  const errors: Partial<Record<'password' | 'confirmPassword', string>> = {};
  if (password.length < 12) errors.password = 'Password must be at least 12 characters.';
  else if (password.length > 256) errors.password = 'Password must be no more than 256 characters.';
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}
