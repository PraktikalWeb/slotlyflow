"use client";

import { useState } from 'react';

import {
  changeCurrentUserPassword,
  updateCurrentUserProfile,
  type PasswordChangeIssue,
  type ProfileUpdateIssue,
} from '@/src/auth/auth-client';
import { useDashboardContext } from '@/src/dashboard/dashboard-context';
import { dashboardUserInitials } from '@/src/dashboard/dashboard-types';
import { SemanticIcon } from '@/src/icons/semantic-icon';
import { Alert } from '@/components/feedback/Alert';

type ProfileTab = 'Personal Information' | 'Security';

const profileIssueMessages: Record<ProfileUpdateIssue, string> = {
  INVALID_DETAILS: 'Enter a first and last name of no more than 100 characters each.',
  UNAUTHENTICATED: 'Your session is no longer available. Please sign in again.',
  RATE_LIMITED: 'Too many save attempts. Please wait a moment and try again.',
  UNAVAILABLE: 'Unable to save your changes right now. Please try again.',
  UNEXPECTED: 'Unable to save your changes. Please try again.',
};

const passwordIssueMessages: Record<PasswordChangeIssue, string> = {
  INVALID_CURRENT_PASSWORD: 'The current password is incorrect.',
  INVALID_NEW_PASSWORD: 'Use a new password between 12 and 256 characters.',
  UNAVAILABLE_FOR_ACCOUNT: 'Password changes are not available for this account.',
  UNAUTHENTICATED: 'Your session is no longer available. Please sign in again.',
  RATE_LIMITED: 'Too many password-change attempts. Please wait a moment and try again.',
  UNAVAILABLE: 'Unable to update your password right now. Please try again.',
  UNEXPECTED: 'Unable to update your password. Please try again.',
};

export default function MyProfile() {
  const { updateUser, user } = useDashboardContext();
  const [activeTab, setActiveTab] = useState<ProfileTab>('Personal Information');
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [profileErrors, setProfileErrors] = useState<Record<'firstName' | 'lastName', string>>({ firstName: '', lastName: '' });
  const [profileFeedback, setProfileFeedback] = useState<{ kind: 'success' | 'error'; message: string }>();
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordFeedback, setPasswordFeedback] = useState<{ kind: 'success' | 'error'; message: string }>();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({ current: false, next: false, confirmation: false });

  const initials = dashboardUserInitials(user);

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSavingProfile) return;
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const nextErrors = {
      firstName: normalizedFirstName.length === 0
        ? 'First name is required.'
        : normalizedFirstName.length > 100
          ? 'First name must be 100 characters or fewer.'
          : '',
      lastName: normalizedLastName.length === 0
        ? 'Last name is required.'
        : normalizedLastName.length > 100
          ? 'Last name must be 100 characters or fewer.'
          : '',
    };
    setProfileErrors(nextErrors);
    setProfileFeedback(undefined);
    if (nextErrors.firstName !== '' || nextErrors.lastName !== '') return;

    setIsSavingProfile(true);
    const result = await updateCurrentUserProfile({ firstName: normalizedFirstName, lastName: normalizedLastName });
    setIsSavingProfile(false);
    if (result.ok === false) {
      setProfileFeedback({ kind: 'error', message: profileIssueMessages[result.issue] });
      return;
    }

    setFirstName(result.user.firstName ?? '');
    setLastName(result.user.lastName ?? '');
    updateUser({
      id: result.user.id,
      email: result.user.email,
      emailVerified: result.user.emailVerified,
      passwordAuthenticationEnabled: result.user.passwordAuthenticationEnabled,
      firstName: result.user.firstName ?? undefined,
      lastName: result.user.lastName ?? undefined,
    });
    setProfileFeedback({ kind: 'success', message: 'Your personal information has been saved.' });
  };

  const handlePasswordChange = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isChangingPassword) return;
    const nextErrors = {
      currentPassword: currentPassword.length === 0 ? 'Current password is required.' : '',
      newPassword: newPassword.length < 12
        ? 'New password must be at least 12 characters.'
        : newPassword.length > 256
          ? 'New password must be no more than 256 characters.'
          : '',
      confirmPassword: newPassword !== confirmPassword ? 'Passwords do not match.' : '',
    };
    setPasswordErrors(nextErrors);
    setPasswordFeedback(undefined);
    if (Object.values(nextErrors).some((message) => message !== '')) return;

    setIsChangingPassword(true);
    const result = await changeCurrentUserPassword({ currentPassword, newPassword });
    setIsChangingPassword(false);
    if (result.ok === false) {
      setPasswordFeedback({ kind: 'error', message: passwordIssueMessages[result.issue] });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordFeedback({ kind: 'success', message: 'Your password has been updated.' });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--canvas)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-[24px] font-bold tracking-tight text-[var(--ink)]">Profile</h1>
          <p className="text-[14.5px] text-[var(--ink-secondary)]">
            Manage your personal information and account security.
          </p>
        </div>

        <div role="tablist" aria-label="Profile sections" className="mb-8 flex items-center gap-6 overflow-x-auto border-b border-[var(--border)]">
          {(['Personal Information', 'Security'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`relative shrink-0 pb-3 text-[14px] font-medium transition-colors ${
                activeTab === tab
                  ? 'text-[var(--brand-green)]'
                  : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
              }`}
            >
              {tab}
              {activeTab === tab && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--flow-lime)]" />}
            </button>
          ))}
        </div>

        <div className="pb-16">
          {activeTab === 'Personal Information' && (
            <section role="tabpanel" className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
                <h2 className="text-[16px] font-semibold text-[var(--ink)]">Personal Information</h2>
              </div>
              <form onSubmit={handleProfileSave} noValidate className="space-y-6 p-5 sm:p-6">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div aria-label={`Initials ${initials}`} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#8B7CF6] text-[22px] font-bold text-white sm:h-20 sm:w-20 sm:text-[28px]">
                    {initials}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--ink)]">Your profile identity</p>
                    <p className="mt-1 text-[13px] text-[var(--ink-secondary)]">Your initials are generated from your saved name.</p>
                  </div>
                </div>

                {profileFeedback !== undefined && (
                  <Alert kind={profileFeedback.kind} className="mb-4">
                    {profileFeedback.message}
                  </Alert>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <ProfileField
                    id="profile-first-name"
                    label="First name"
                    value={firstName}
                    error={profileErrors.firstName}
                    autoComplete="given-name"
                    onChange={(value) => {
                      setFirstName(value);
                      setProfileErrors((current) => ({ ...current, firstName: '' }));
                      setProfileFeedback(undefined);
                    }}
                  />
                  <ProfileField
                    id="profile-last-name"
                    label="Last name"
                    value={lastName}
                    error={profileErrors.lastName}
                    autoComplete="family-name"
                    onChange={(value) => {
                      setLastName(value);
                      setProfileErrors((current) => ({ ...current, lastName: '' }));
                      setProfileFeedback(undefined);
                    }}
                  />
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="profile-email" className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]">Email address</label>
                      <span className={`mb-1.5 text-[12px] font-medium ${user.emailVerified ? 'text-[var(--success)]' : 'text-[var(--ink-tertiary)]'}`}>
                        {user.emailVerified ? 'Verified' : 'Not verified'}
                      </span>
                    </div>
                    <input
                      id="profile-email"
                      type="email"
                      value={user.email}
                      readOnly
                      aria-readonly="true"
                      className="h-10 w-full cursor-not-allowed rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-3 text-[14px] text-[var(--ink-secondary)] focus:outline-none"
                    />
                    <p className="mt-1.5 text-[12px] text-[var(--ink-tertiary)]">Email address changes are not available yet.</p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="h-9 rounded-[var(--radius-md)] bg-[var(--brand-green)] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#002B21] disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'Security' && (
            <section role="tabpanel" className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
                <h2 className="text-[16px] font-semibold text-[var(--ink)]">Change password</h2>
              </div>
              {user.passwordAuthenticationEnabled === true ? (
                <form onSubmit={handlePasswordChange} noValidate className="max-w-xl space-y-5 p-5 sm:p-6">
                  {passwordFeedback !== undefined && (
                    <Alert kind={passwordFeedback.kind}>
                      {passwordFeedback.message}
                    </Alert>
                  )}
                  <PasswordField
                    id="current-password"
                    label="Current password"
                    value={currentPassword}
                    visible={visiblePasswords.current}
                    error={passwordErrors.currentPassword}
                    autoComplete="current-password"
                    onChange={(value) => {
                      setCurrentPassword(value);
                      setPasswordErrors((current) => ({ ...current, currentPassword: '' }));
                      setPasswordFeedback(undefined);
                    }}
                    onToggle={() => setVisiblePasswords((current) => ({ ...current, current: !current.current }))}
                  />
                  <PasswordField
                    id="new-password"
                    label="New password"
                    value={newPassword}
                    visible={visiblePasswords.next}
                    error={passwordErrors.newPassword}
                    autoComplete="new-password"
                    help="Use between 12 and 256 characters."
                    onChange={(value) => {
                      setNewPassword(value);
                      setPasswordErrors((current) => ({ ...current, newPassword: '' }));
                      setPasswordFeedback(undefined);
                    }}
                    onToggle={() => setVisiblePasswords((current) => ({ ...current, next: !current.next }))}
                  />
                  <PasswordField
                    id="confirm-new-password"
                    label="Confirm new password"
                    value={confirmPassword}
                    visible={visiblePasswords.confirmation}
                    error={passwordErrors.confirmPassword}
                    autoComplete="new-password"
                    onChange={(value) => {
                      setConfirmPassword(value);
                      setPasswordErrors((current) => ({ ...current, confirmPassword: '' }));
                      setPasswordFeedback(undefined);
                    }}
                    onToggle={() => setVisiblePasswords((current) => ({ ...current, confirmation: !current.confirmation }))}
                  />
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="h-9 rounded-[var(--radius-md)] bg-[var(--brand-green)] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#002B21] disabled:cursor-not-allowed disabled:opacity-65"
                    >
                      {isChangingPassword ? 'Updating...' : 'Update password'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-5 sm:p-6">
                  <div className="max-w-xl rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                    <p className="text-[14px] font-semibold text-[var(--ink)]">Password change is not available</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-secondary)]">
                      This account signs in with Google and does not have a SlotlyFlow password. Setting a password is not supported yet.
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileField({
  autoComplete,
  error,
  id,
  label,
  onChange,
  value,
}: {
  readonly autoComplete: string;
  readonly error: string;
  readonly id: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]">{label}</label>
      <input
        id={id}
        type="text"
        autoComplete={autoComplete}
        value={value}
        aria-invalid={error !== ''}
        aria-describedby={error === '' ? undefined : `${id}-error`}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 w-full rounded-[var(--radius-sm)] border bg-white px-3 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)] ${error === '' ? 'border-[var(--border-strong)] focus:border-[var(--brand-green)]' : 'border-[var(--danger)]'}`}
      />
      {error !== '' && <p id={`${id}-error`} className="mt-1.5 text-[12px] text-[var(--danger)]">{error}</p>}
    </div>
  );
}

function PasswordField({
  autoComplete,
  error,
  help,
  id,
  label,
  onChange,
  onToggle,
  value,
  visible,
}: {
  readonly autoComplete: string;
  readonly error: string;
  readonly help?: string;
  readonly id: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly onToggle: () => void;
  readonly value: string;
  readonly visible: boolean;
}) {
  const describedBy = error !== '' ? `${id}-error` : help === undefined ? undefined : `${id}-help`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          aria-invalid={error !== ''}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={`h-10 w-full rounded-[var(--radius-sm)] border bg-white px-3 pr-11 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)] ${error === '' ? 'border-[var(--border-strong)] focus:border-[var(--brand-green)]' : 'border-[var(--danger)]'}`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-8 w-9 -translate-y-1/2 items-center justify-center text-[var(--ink-tertiary)] transition-colors hover:text-[var(--brand-green)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-green)]"
        >
          <SemanticIcon concept={visible ? 'passwordHidden' : 'passwordVisible'} className="h-4 w-4" />
        </button>
      </div>
      {error !== ''
        ? <p id={`${id}-error`} className="mt-1.5 text-[12px] text-[var(--danger)]">{error}</p>
        : help !== undefined && <p id={`${id}-help`} className="mt-1.5 text-[12px] text-[var(--ink-tertiary)]">{help}</p>}
    </div>
  );
}
