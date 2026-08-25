'use client';

import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Image from 'next/image';
import * as React from 'react';

import { parsePublicApiBaseUrl } from '../../src/config/public-environment';
import {
  authApiUrl,
  createRegistrationSubmitter,
  type CreateAccountFields,
  type CreateAccountIssue,
  registrationSuccessRoute,
  validateCreateAccount,
} from './create-account-flow';

type FieldErrors = Partial<Record<keyof CreateAccountFields, string>>;
type RegistrationSubmitter = ReturnType<typeof createRegistrationSubmitter>;

const messages: Record<CreateAccountIssue, string> = {
  EMAIL_ALREADY_REGISTERED: 'An account already uses this email address.',
  INVALID_DETAILS: 'Check your account details and try again.',
  CSRF_REJECTED: 'Your secure form session expired. Please try again.',
  RATE_LIMITED: 'Too many account attempts. Please wait a moment before trying again.',
  UNAVAILABLE: 'SlotlyFlow is temporarily unavailable. Please try again shortly.',
  UNEXPECTED: 'We could not create your account. Please try again.',
};

function configuredApiBaseUrl(): string {
  return parsePublicApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
}

export function CreateAccountForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [confirmationVisible, setConfirmationVisible] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [issue, setIssue] = React.useState<CreateAccountIssue | undefined>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const submitter = React.useRef<RegistrationSubmitter | undefined>(undefined);

  function getSubmitter(): RegistrationSubmitter {
    submitter.current ??= createRegistrationSubmitter(fetch, configuredApiBaseUrl());
    return submitter.current;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSubmitting) return;

    const fields = { email, password, confirmPassword };
    const errors = validateCreateAccount(fields);
    setFieldErrors(errors);
    setIssue(undefined);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    const result = await getSubmitter()(fields);
    if (result.ok) {
      window.location.assign(registrationSuccessRoute);
      return;
    }

    setIssue(result.issue ?? 'UNEXPECTED');
    setIsSubmitting(false);
  }

  function beginGoogle(): void {
    if (isSubmitting) return;
    setIssue(undefined);
    setIsSubmitting(true);
    window.location.assign(authApiUrl('/auth/google', configuredApiBaseUrl()));
  }

  return (
    <form
      className="create-account-form"
      noValidate
      onSubmit={handleSubmit}
      aria-describedby={issue === undefined ? undefined : 'create-account-feedback'}
    >
      {issue !== undefined && (
        <div className="form-feedback" id="create-account-feedback" role="alert">
          <p>{messages[issue]}</p>
          {issue === 'EMAIL_ALREADY_REGISTERED' && <a href="/sign-in">Sign in instead</a>}
        </div>
      )}

      <div className="auth-field">
        <label htmlFor="create-account-email">Email address</label>
        <input
          id="create-account-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={fieldErrors.email === undefined ? undefined : true}
          aria-describedby={fieldErrors.email === undefined ? undefined : 'create-account-email-error'}
        />
        {fieldErrors.email !== undefined && <p className="field-error" id="create-account-email-error" role="alert">{fieldErrors.email}</p>}
      </div>

      <div className="auth-field">
        <label htmlFor="create-account-password">Password</label>
        <div className="password-control">
          <input
            id="create-account-password"
            name="password"
            type={passwordVisible ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={fieldErrors.password === undefined ? undefined : true}
            aria-describedby={fieldErrors.password === undefined ? 'create-account-password-help' : 'create-account-password-help create-account-password-error'}
          />
          <button
            className="password-visibility"
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
          >
            <FontAwesomeIcon icon={passwordVisible ? faEyeSlash : faEye} aria-hidden="true" />
          </button>
        </div>
        <p className="field-help" id="create-account-password-help">Use 12 or more characters.</p>
        {fieldErrors.password !== undefined && <p className="field-error" id="create-account-password-error" role="alert">{fieldErrors.password}</p>}
      </div>

      <div className="auth-field">
        <label htmlFor="create-account-confirm-password">Confirm password</label>
        <div className="password-control">
          <input
            id="create-account-confirm-password"
            name="confirmPassword"
            type={confirmationVisible ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={256}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={fieldErrors.confirmPassword === undefined ? undefined : true}
            aria-describedby={fieldErrors.confirmPassword === undefined ? undefined : 'create-account-confirm-password-error'}
          />
          <button
            className="password-visibility"
            type="button"
            onClick={() => setConfirmationVisible((visible) => !visible)}
            aria-label={confirmationVisible ? 'Hide confirm password' : 'Show confirm password'}
          >
            <FontAwesomeIcon icon={confirmationVisible ? faEyeSlash : faEye} aria-hidden="true" />
          </button>
        </div>
        {fieldErrors.confirmPassword !== undefined && <p className="field-error" id="create-account-confirm-password-error" role="alert">{fieldErrors.confirmPassword}</p>}
      </div>

      <button className="primary-action" type="submit" disabled={isSubmitting} aria-live="polite">
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>

      <div className="auth-separator" aria-hidden="true"><span>or</span></div>

      <button className="google-action" type="button" disabled={isSubmitting} onClick={beginGoogle}>
        <Image className="google-mark" src="/google-logo.png" alt="" width={24} height={24} aria-hidden="true" />
        Continue with Google
      </button>

      <p className="account-prompt">Already have an account? <a href="/sign-in">Sign in</a></p>
    </form>
  );
}
