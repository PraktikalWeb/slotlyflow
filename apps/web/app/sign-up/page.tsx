"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SemanticIcon } from '../../src/icons/semantic-icon';
import { GoogleMark } from '@/components/GoogleMark';
import { Alert } from '@/components/feedback/Alert';
import {
  configuredApiBaseUrl,
  googleAuthorizationUrl,
  resendVerificationEmail,
  submitSignUp,
  type ResendVerificationIssue,
  type SignUpIssue,
} from '@/src/auth/auth-client';

const signUpMessages: Record<Exclude<SignUpIssue, 'EMAIL_ALREADY_REGISTERED'>, string> = {
  INVALID_DETAILS: 'Check your name and email address, and use a password between 12 and 256 characters.',
  RATE_LIMITED: 'Too many account-creation attempts. Please wait a moment and try again.',
  UNAVAILABLE: 'SlotlyFlow is temporarily unavailable. Please try again shortly.',
  UNEXPECTED: 'We could not create your account. Please try again.',
};

const resendMessages: Record<Exclude<ResendVerificationIssue, 'INVALID_EMAIL'>, string> = {
  RATE_LIMITED: 'Please wait a moment before requesting another link.',
  UNAVAILABLE: 'SlotlyFlow is temporarily unavailable. Please try again shortly.',
  UNEXPECTED: 'We could not send another verification link. Please try again.',
};

export default function SignUpPage() {
  const router = useRouter();
  const [view, setView] = useState<'form' | 'verify-email'>('form');
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string>();
  const [resendFeedback, setResendFeedback] = useState<string>();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required.';
    } else if (firstName.trim().length > 100) {
      newErrors.firstName = 'First name must be 100 characters or fewer.';
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required.';
    } else if (lastName.trim().length > 100) {
      newErrors.lastName = 'Last name must be 100 characters or fewer.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (password.length < 12) {
      newErrors.password = 'Password must be at least 12 characters.';
    } else if (password.length > 256) {
      newErrors.password = 'Password must be no more than 256 characters.';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (isLoading || !validateForm()) return;

    setFeedback(undefined);
    setIsLoading(true);
    const result = await submitSignUp({ firstName, lastName, email, password });
    setIsLoading(false);

    if (result.ok === true) {
      setResendFeedback(undefined);
      setView('verify-email');
      return;
    }

    if (result.issue === 'EMAIL_ALREADY_REGISTERED') {
      setErrors((current) => ({ ...current, email: 'An account already exists with this email.' }));
      return;
    }
    setFeedback(signUpMessages[result.issue]);
  };

  const handleGoogleSignUp = (): void => {
    if (isLoading) return;
    try {
      setFeedback(undefined);
      setIsLoading(true);
      window.location.assign(googleAuthorizationUrl(configuredApiBaseUrl(), '/dashboard'));
    } catch {
      setIsLoading(false);
      setFeedback(signUpMessages.UNAVAILABLE);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (isLoading) return;

    setResendFeedback(undefined);
    setIsLoading(true);
    const result = await resendVerificationEmail(email);
    setIsLoading(false);
    if (result.ok === true) {
      setResendFeedback('We sent another verification link. It may take a minute to arrive.');
      return;
    }
    setResendFeedback(result.issue === 'INVALID_EMAIL'
      ? 'Enter a valid email address.'
      : resendMessages[result.issue]);
  };

  return (
    <div className="relative min-h-screen bg-[var(--canvas)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px] flex justify-center mb-8 cursor-pointer" onClick={() => router.push('/')}>
        <img
          src="/slotlyflow-official-full-logo.png"
          alt="SlotlyFlow"
          className="w-[180px] h-auto object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/slotlyflow-logo-transparent.png';
          }}
        />
      </div>

      <div className="w-full max-w-[400px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-8 shadow-sm">

        {view === 'form' && (
          <div className="animate-in fade-in duration-300">
            <div className="text-center mb-8">
              <h2 className="text-[24px] font-semibold text-[var(--ink)] tracking-tight mb-1">Create an account</h2>
              <p className="text-[14px] text-[var(--ink-secondary)]">Get started with SlotlyFlow</p>
            </div>

            {feedback !== undefined && (
              <Alert kind="error" className="mb-4">
                {feedback}
              </Alert>
            )}
            
            <button 
              type="button"
              onClick={handleGoogleSignUp}
              disabled={isLoading}
              className="w-full h-[44px] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] border border-[var(--border-strong)] text-[var(--ink)] text-[14px] font-medium rounded-[var(--radius-md)] flex items-center justify-center gap-2.5 transition-colors duration-150 active:scale-[0.99] shadow-sm disabled:opacity-70 disabled:cursor-not-allowed mb-6"
            >
              <GoogleMark className="w-4 h-4 shrink-0" />
              Continue with Google
            </button>
            
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--border)]"></div>
              <span className="text-[12px] text-[var(--ink-tertiary)] uppercase font-medium tracking-wider bg-[var(--surface)] px-1">Or</span>
              <div className="flex-1 h-px bg-[var(--border)]"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium text-[var(--ink)] block text-left">First name</label>
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (errors.firstName) setErrors({ ...errors, firstName: '' });
                    }}
                    placeholder="Jane"
                    className={`w-full h-[44px] px-3.5 rounded-[var(--radius-md)] border ${errors.firstName ? 'border-[#FF7A66]' : 'border-[var(--border-strong)]'} text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] bg-[var(--surface)] outline-none transition-all duration-150 focus:border-[var(--brand-green)] focus:ring-[3px] focus:ring-[var(--brand-green)]/10`}
                  />
                  {errors.firstName && <p className="text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5 shrink-0" />{errors.firstName}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium text-[var(--ink)] block text-left">Last name</label>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (errors.lastName) setErrors({ ...errors, lastName: '' });
                    }}
                    placeholder="Doe"
                    className={`w-full h-[44px] px-3.5 rounded-[var(--radius-md)] border ${errors.lastName ? 'border-[#FF7A66]' : 'border-[var(--border-strong)]'} text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] bg-[var(--surface)] outline-none transition-all duration-150 focus:border-[var(--brand-green)] focus:ring-[3px] focus:ring-[var(--brand-green)]/10`}
                  />
                  {errors.lastName && <p className="text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5 shrink-0" />{errors.lastName}</p>}
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[14px] font-medium text-[var(--ink)] block text-left">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: '' });
                  }}
                  placeholder="jane@company.com"
                  className={`w-full h-[44px] px-3.5 rounded-[var(--radius-md)] border ${errors.email ? 'border-[#FF7A66]' : 'border-[var(--border-strong)]'} text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] bg-[var(--surface)] outline-none transition-all duration-150 focus:border-[var(--brand-green)] focus:ring-[3px] focus:ring-[var(--brand-green)]/10`}
                />
                {errors.email && (
                  <div className="text-[13px] font-medium text-[#FF7A66] flex flex-col gap-1.5">
                    <div className="flex items-center gap-1">
                      <SemanticIcon concept="alert" className="w-3.5 h-3.5" />{errors.email}
                    </div>
                    {errors.email.includes('already exists') && (
                      <button type="button" onClick={() => router.push('/sign-in')} className="text-left text-[var(--brand-green)] hover:underline">
                        Sign in instead
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] font-medium text-[var(--ink)] block text-left">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({ ...errors, password: '' });
                    }}
                    placeholder="••••••••"
                    className={`w-full h-[44px] px-3.5 pr-10 rounded-[var(--radius-md)] border ${errors.password ? 'border-[#FF7A66]' : 'border-[var(--border-strong)]'} text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] bg-[var(--surface)] outline-none transition-all duration-150 focus:border-[var(--brand-green)] focus:ring-[3px] focus:ring-[var(--brand-green)]/10`}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors focus:outline-none"
                  >
                    {showPassword ? <SemanticIcon concept="passwordHidden" className="w-4 h-4" /> : <SemanticIcon concept="passwordVisible" className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5" />{errors.password}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] font-medium text-[var(--ink)] block text-left">Confirm password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                    }}
                    placeholder="••••••••"
                    className={`w-full h-[44px] px-3.5 pr-10 rounded-[var(--radius-md)] border ${errors.confirmPassword ? 'border-[#FF7A66]' : 'border-[var(--border-strong)]'} text-[14px] text-[var(--ink)] placeholder-[var(--ink-tertiary)] bg-[var(--surface)] outline-none transition-all duration-150 focus:border-[var(--brand-green)] focus:ring-[3px] focus:ring-[var(--brand-green)]/10`}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors focus:outline-none"
                  >
                    {showConfirmPassword ? <SemanticIcon concept="passwordHidden" className="w-4 h-4" /> : <SemanticIcon concept="passwordVisible" className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5" />{errors.confirmPassword}</p>
                )}
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[44px] bg-[var(--brand-green)] hover:bg-[#002B21] text-white text-[14px] font-medium rounded-[var(--radius-md)] transition-colors duration-150 active:scale-[0.99] flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Create account'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-[13px] text-[var(--ink-tertiary)] leading-relaxed mb-6">
                By creating an account, you agree to SlotlyFlow’s <a href="#" className="text-[var(--ink-secondary)] hover:underline font-medium">Terms</a> & <a href="#" className="text-[var(--ink-secondary)] hover:underline font-medium">Privacy</a>.
              </p>
              <p className="text-[14px] text-[var(--ink-secondary)] font-medium">
                Already have an account? <button onClick={() => router.push('/sign-in')} className="text-[var(--brand-green)] font-semibold hover:underline">Sign in</button>
              </p>
            </div>
          </div>
        )}

        {view === 'verify-email' && (
          <div className="animate-in fade-in duration-300 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--brand-green)]/10 flex items-center justify-center mx-auto mb-6">
              <SemanticIcon concept="email" className="w-8 h-8 text-[var(--brand-green)]" />
            </div>
            <h2 className="text-[24px] font-semibold text-[var(--ink)] tracking-tight mb-2">Check your email</h2>
            <p className="text-[14px] text-[var(--ink-secondary)] mb-6 leading-relaxed">
              We sent a verification link to <br/><strong className="text-[var(--ink)] font-semibold">{email || 'you@example.com'}</strong>
            </p>
            
            <div className="space-y-3">
              <button 
                type="button"
                onClick={() => { void handleResend(); }}
                disabled={isLoading}
                className="w-full h-[44px] bg-[var(--brand-green)] hover:bg-[#002B21] text-white text-[14px] font-medium rounded-[var(--radius-md)] transition-colors duration-150 active:scale-[0.99] flex items-center justify-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  'Resend link'
                )}
              </button>
              {resendFeedback !== undefined && (
                <p role="status" className="text-[13px] text-[var(--ink-secondary)] leading-relaxed">
                  {resendFeedback}
                </p>
              )}
              <button 
                type="button"
                onClick={() => setView('form')}
                className="w-full h-[44px] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] border border-[var(--border-strong)] text-[var(--ink)] text-[14px] font-medium rounded-[var(--radius-md)] flex items-center justify-center transition-colors duration-150 active:scale-[0.99] shadow-sm"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
