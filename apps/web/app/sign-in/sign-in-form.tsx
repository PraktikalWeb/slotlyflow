'use client';

import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Image from 'next/image';
import * as React from 'react';

import { parsePublicApiBaseUrl } from '../../src/config/public-environment';
import { apiUrl, submitSignIn, type SignInIssue, validateSignIn } from './sign-in-flow';

function configuredApiBaseUrl(): string {
  return parsePublicApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
}

const messages: Record<SignInIssue, string> = {
  INVALID_EMAIL: 'Check your email address and try again.',
  PASSWORD_REQUIRED: 'Enter your password and try again.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  EMAIL_VERIFICATION_REQUIRED: 'Verify your email before signing in.',
  RATE_LIMITED: 'Too many sign-in attempts. Please wait a moment before trying again.',
  UNAVAILABLE: 'SlotlyFlow is temporarily unavailable. Please try again shortly.',
  UNEXPECTED: 'We could not sign you in. Please try again.',
};

export function SignInForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [visiblePassword, setVisiblePassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<'email' | 'password', string>>>({});
  const [issue, setIssue] = React.useState<SignInIssue | undefined>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const errors = validateSignIn({ email, password });
    setFieldErrors(errors);
    setIssue(undefined);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    const result = await submitSignIn({ email, password }, fetch, configuredApiBaseUrl());
    setIsSubmitting(false);
    if (result.ok) {
      window.location.assign('/');
      return;
    }
    setIssue(result.issue ?? 'UNEXPECTED');
  }

  function beginGoogle(): void {
    if (isSubmitting) return;
    setIssue(undefined);
    setIsSubmitting(true);
    window.location.assign(apiUrl('/auth/google', configuredApiBaseUrl()));
  }

  return (
    <form className="sign-in-form" noValidate onSubmit={handleSubmit} aria-describedby={issue === undefined ? undefined : 'sign-in-feedback'}>
      {issue !== undefined && (
        <div className="form-feedback" id="sign-in-feedback" role="alert">
          <p>{messages[issue]}</p>
          {issue === 'EMAIL_VERIFICATION_REQUIRED' && <a href="/verify-email">Go to email verification</a>}
        </div>
      )}

      <div className="auth-field">
        <label htmlFor="sign-in-email">Email address</label>
        <input
          id="sign-in-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={fieldErrors.email === undefined ? undefined : true}
          aria-describedby={fieldErrors.email === undefined ? undefined : 'sign-in-email-error'}
        />
        {fieldErrors.email !== undefined && <p className="field-error" id="sign-in-email-error" role="alert">{fieldErrors.email}</p>}
      </div>

      <div className="auth-field">
        <div className="field-label-row">
          <label htmlFor="sign-in-password">Password</label>
          <a href="/forgot-password">Forgot password?</a>
        </div>
        <div className="password-control">
          <input
            id="sign-in-password"
            name="password"
            type={visiblePassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={fieldErrors.password === undefined ? undefined : true}
            aria-describedby={fieldErrors.password === undefined ? undefined : 'sign-in-password-error'}
          />
          <button className="password-visibility" type="button" onClick={() => setVisiblePassword((visible) => !visible)} aria-label={visiblePassword ? 'Hide password' : 'Show password'}>
            <FontAwesomeIcon icon={visiblePassword ? faEyeSlash : faEye} aria-hidden="true" />
          </button>
        </div>
        {fieldErrors.password !== undefined && <p className="field-error" id="sign-in-password-error" role="alert">{fieldErrors.password}</p>}
      </div>

      <button className="primary-action" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="auth-separator" aria-hidden="true"><span>or</span></div>

      <button className="google-action" type="button" disabled={isSubmitting} onClick={beginGoogle}>
        <Image className="google-mark" src="/google-logo.png" alt="" width={24} height={24} aria-hidden="true" />
        Continue with Google
      </button>

      <p className="account-prompt">New to SlotlyFlow? <a href="/create-account">Create an account</a></p>
    </form>
  );
}
