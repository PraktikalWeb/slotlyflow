'use client';

import * as React from 'react';

import {
  getBusinessSettings,
  updateBusinessSettings,
  type BusinessDay,
  type BusinessSettings,
} from '@/src/dashboard/business-client';
import { useDashboardContext } from '@/src/dashboard/dashboard-context';
import { businessInitial } from '@/src/dashboard/dashboard-types';
import { SemanticIcon } from '@/src/icons/semantic-icon';
import { Alert } from '@/components/feedback/Alert';

const DAYS: readonly { readonly day: BusinessDay; readonly label: string }[] = [
  { day: 'MONDAY', label: 'Monday' },
  { day: 'TUESDAY', label: 'Tuesday' },
  { day: 'WEDNESDAY', label: 'Wednesday' },
  { day: 'THURSDAY', label: 'Thursday' },
  { day: 'FRIDAY', label: 'Friday' },
  { day: 'SATURDAY', label: 'Saturday' },
  { day: 'SUNDAY', label: 'Sunday' },
];

const TIMEZONES = ['Africa/Johannesburg', 'Europe/London', 'America/New_York'] as const;
type SettingsTab = 'General' | 'Plan & Billing';

export default function BusinessSettingsPage(): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('General');
  const { selectedMembership } = useDashboardContext();
  const selectedBusiness = selectedMembership.organization;

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--canvas)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[24px] font-bold tracking-tight text-[var(--ink)]">Business Settings</h1>
            <div className="rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-2.5 py-1 text-[12px] font-semibold text-[var(--ink-secondary)]">
              {selectedBusiness.name}
            </div>
          </div>
          <p className="text-[14.5px] text-[var(--ink-secondary)]">
            Manage the details, preferences and subscription for this Business.
          </p>
        </div>

        <div aria-label="Business Settings sections" className="mb-8 flex items-center gap-6 border-b border-[var(--border)]" role="tablist">
          {(['General', 'Plan & Billing'] as const).map((tab) => (
            <button
              key={tab}
              aria-selected={activeTab === tab}
              className={`relative pb-3 text-[14px] font-medium transition-colors ${
                activeTab === tab
                  ? 'text-[var(--brand-green)]'
                  : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {tab}
              {activeTab === tab && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--flow-lime)]" />}
            </button>
          ))}
        </div>

        <div className="pb-16">
          {activeTab === 'General' ? (
            <GeneralSettings
              key={selectedBusiness.id}
              canEdit={selectedMembership.role === 'OWNER' || selectedMembership.role === 'ADMIN'}
              organizationId={selectedBusiness.id}
            />
          ) : (
            <PlanAndBillingPreview businessName={selectedBusiness.name} />
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralSettings({ canEdit, organizationId }: Readonly<{ canEdit: boolean; organizationId: string }>): React.JSX.Element {
  const { updateBusiness } = useDashboardContext();
  const [reloadKey, setReloadKey] = React.useState(0);
  const [business, setBusiness] = React.useState<BusinessSettings>();
  const [loadError, setLoadError] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ readonly kind: 'success' | 'error'; readonly message: string }>();
  const [fieldError, setFieldError] = React.useState<string>();

  React.useEffect(() => {
    let cancelled = false;
    void getBusinessSettings(organizationId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setBusiness(result.business);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    });
    return () => { cancelled = true; };
  }, [organizationId, reloadKey]);

  const setField = <Key extends keyof BusinessSettings>(key: Key, value: BusinessSettings[Key]) => {
    setBusiness((current) => current === undefined ? current : { ...current, [key]: value });
    setFeedback(undefined);
    setFieldError(undefined);
  };

  const setHours = (day: BusinessDay, change: { readonly enabled?: boolean; readonly opensAt?: string; readonly closesAt?: string }) => {
    if (business === undefined) return;
    setField('businessHours', business.businessHours.map((entry) => {
      if (entry.day !== day) return entry;
      const enabled = change.enabled ?? entry.enabled;
      return {
        ...entry,
        enabled,
        opensAt: enabled ? (change.opensAt ?? entry.opensAt ?? '08:00') : null,
        closesAt: enabled ? (change.closesAt ?? entry.closesAt ?? '17:00') : null,
      };
    }));
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (business === undefined || isSaving || !canEdit) return;
    const validationMessage = validateBusinessSettings(business);
    if (validationMessage !== undefined) {
      setFieldError(validationMessage);
      setFeedback(undefined);
      return;
    }

    setIsSaving(true);
    setFeedback(undefined);
    const result = await updateBusinessSettings(organizationId, {
      name: business.name.trim(),
      businessEmail: optionalValue(business.businessEmail),
      contactNumber: optionalValue(business.contactNumber),
      website: optionalValue(business.website),
      timezone: business.timezone.trim(),
      businessHours: business.businessHours,
    });
    setIsSaving(false);

    if (result.ok === false) {
      setFeedback({
        kind: 'error',
        message: result.issue === 'INVALID'
          ? 'Check the Business details and try again.'
          : result.issue === 'FORBIDDEN'
            ? 'You do not have permission to update this Business.'
            : 'Unable to save Business settings. Please try again.',
      });
      return;
    }

    setBusiness(result.business);
    updateBusiness({ id: result.business.id, name: result.business.name, slug: result.business.slug });
    setFeedback({ kind: 'success', message: 'Business settings updated.' });
  };

  if (business === undefined) {
    return loadError ? (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-[14px] text-[var(--danger)]">Unable to load Business settings. Please try again.</p>
        <button className="mt-4 h-9 rounded-[var(--radius-md)] bg-[var(--brand-green)] px-4 text-[14px] font-medium text-white" onClick={() => { setLoadError(false); setReloadKey((value) => value + 1); }} type="button">
          Try again
        </button>
      </div>
    ) : (
      <div aria-label="Loading Business settings" className="flex min-h-48 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-secondary)]">
        <SemanticIcon className="mr-2 animate-spin" concept="loader" size="control" /> Loading Business settings...
      </div>
    );
  }

  return (
    <form className="space-y-8" onSubmit={(event) => { void save(event); }}>
      {!canEdit && (
        <p className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-[13px] text-[var(--ink-secondary)]">
          You can view these settings, but only a Business Owner or Admin can make changes.
        </p>
      )}

      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Business Profile</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <SettingsInput disabled={!canEdit} label="Business name" maxLength={255} onChange={(value) => setField('name', value)} required value={business.name} />
          <SettingsInput disabled={!canEdit} label="Business email" maxLength={320} onChange={(value) => setField('businessEmail', value)} type="email" value={business.businessEmail ?? ''} />
          <SettingsInput disabled={!canEdit} label="Business contact number" maxLength={40} onChange={(value) => setField('contactNumber', value)} type="tel" value={business.contactNumber ?? ''} />
          <SettingsInput disabled={!canEdit} label="Website" maxLength={2048} onChange={(value) => setField('website', value)} placeholder="https://example.com" type="url" value={business.website ?? ''} />
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]" htmlFor="business-timezone">Timezone</label>
            <div className="relative">
              <select
                className="h-10 w-full appearance-none rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-white pl-3 pr-10 text-[14px] focus:border-[var(--brand-green)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)] disabled:bg-[var(--surface-subtle)]"
                disabled={!canEdit}
                id="business-timezone"
                onChange={(event) => setField('timezone', event.target.value)}
                value={business.timezone}
              >
                {!TIMEZONES.includes(business.timezone as (typeof TIMEZONES)[number]) && <option value={business.timezone}>{business.timezone}</option>}
                {TIMEZONES.map((timezone) => <option key={timezone}>{timezone}</option>)}
              </select>
              <SemanticIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-secondary)]" concept="chevronDown" />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Business Logo</h2>
        </div>
        <div className="flex items-start gap-5 p-5 sm:p-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#8b7cf6] text-[28px] font-bold text-white">
            {businessInitial(business.name)}
          </div>
          <div>
            <p className="text-[14px] font-medium text-[var(--ink)]">Initials are used for this Business.</p>
            <p className="mt-1 max-w-md text-[13px] text-[var(--ink-secondary)]">
              Logo uploads are not available yet because durable Business media storage has not been implemented.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Business Hours</h2>
          <p className="mt-0.5 text-[13px] text-[var(--ink-secondary)]">Define normal consultant and service availability.</p>
        </div>
        <div className="space-y-3 p-5 sm:p-6">
          {DAYS.map(({ day, label }) => {
            const hours = business.businessHours.find((entry) => entry.day === day);
            if (hours === undefined) return null;
            return (
              <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4" key={day}>
                <div className="flex w-40 items-center gap-3">
                  <button
                    aria-label={`${hours.enabled ? 'Close' : 'Open'} ${label}`}
                    aria-pressed={hours.enabled}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${hours.enabled ? 'bg-[var(--flow-lime)]' : 'bg-[var(--border-strong)]'} disabled:opacity-60`}
                    disabled={!canEdit}
                    onClick={() => setHours(day, { enabled: !hours.enabled })}
                    type="button"
                  >
                    <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${hours.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-[14px] font-medium text-[var(--ink)]">{label}</span>
                </div>
                {hours.enabled ? (
                  <div className="flex items-center gap-2">
                    <input aria-label={`${label} opening time`} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-white px-3 text-[14px] disabled:bg-[var(--surface-subtle)]" disabled={!canEdit} onChange={(event) => setHours(day, { opensAt: event.target.value })} type="time" value={hours.opensAt ?? '08:00'} />
                    <span className="text-[13px] text-[var(--ink-secondary)]">to</span>
                    <input aria-label={`${label} closing time`} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-white px-3 text-[14px] disabled:bg-[var(--surface-subtle)]" disabled={!canEdit} onChange={(event) => setHours(day, { closesAt: event.target.value })} type="time" value={hours.closesAt ?? '17:00'} />
                  </div>
                ) : <span className="text-[14px] italic text-[var(--ink-secondary)]">Closed</span>}
              </div>
            );
          })}
        </div>
      </section>

      {fieldError !== undefined && <p className="text-[13px] font-medium text-[var(--danger)]" role="alert">{fieldError}</p>}
      {feedback !== undefined && (
        <Alert kind={feedback.kind}>
          {feedback.message}
        </Alert>
      )}
      {canEdit && (
        <button className="h-10 rounded-[var(--radius-md)] bg-[var(--brand-green)] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#002B21] disabled:cursor-not-allowed disabled:opacity-70" disabled={isSaving} type="submit">
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      )}
    </form>
  );
}

function SettingsInput({ disabled, label, onChange, value, ...inputProps }: Readonly<{
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}> & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'disabled' | 'onChange' | 'value'>): React.JSX.Element {
  const id = React.useId();
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]" htmlFor={id}>{label}</label>
      <input
        {...inputProps}
        className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-white px-3 text-[14px] focus:border-[var(--brand-green)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)] disabled:bg-[var(--surface-subtle)]"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}

function PlanAndBillingPreview({ businessName }: Readonly<{ businessName: string }>): React.JSX.Element {
  return (
    <div className="space-y-8">
      <p className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-[13px] text-[var(--ink-secondary)]">
        Plan & Billing is a product preview. Billing actions are not yet available.
      </p>
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-4">
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Current Plan</h2>
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-secondary)]">Preview</span>
        </div>
        <div className="p-6">
          <h3 className="text-[20px] font-bold text-[var(--ink)]">SlotlyFlow Managed</h3>
          <p className="mt-1 text-[14px] text-[var(--ink-secondary)]">Billing has not been connected for {businessName}.</p>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-4"><h2 className="text-[16px] font-semibold text-[var(--ink)]">Billing Details</h2></div>
          <div className="p-6"><p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">Business</p><p className="mt-1 text-[14px] text-[var(--ink)]">{businessName}</p></div>
        </section>
        <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-4"><h2 className="text-[16px] font-semibold text-[var(--ink)]">Payment Method</h2></div>
          <div className="p-6 text-[14px] text-[var(--ink-secondary)]">No payment method is connected.</div>
        </section>
      </div>
    </div>
  );
}

function optionalValue(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized === '' ? null : normalized;
}

function validateBusinessSettings(business: BusinessSettings): string | undefined {
  const name = business.name.trim();
  if (name.length === 0 || name.length > 255) return 'Enter a Business name between 1 and 255 characters.';
  const email = optionalValue(business.businessEmail);
  if (email !== null && (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return 'Enter a valid Business email address.';
  const contactNumber = optionalValue(business.contactNumber);
  if (contactNumber !== null && contactNumber.length > 40) return 'Business contact number must be 40 characters or fewer.';
  const website = optionalValue(business.website);
  if (website !== null && !isHttpUrl(website)) return 'Website must be a valid HTTP or HTTPS URL.';
  for (const hours of business.businessHours) {
    if (hours.enabled && (hours.opensAt === null || hours.closesAt === null || hours.opensAt >= hours.closesAt)) {
      return `${DAYS.find((entry) => entry.day === hours.day)?.label ?? 'Business'} closing time must be after opening time.`;
    }
  }
  return undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}
