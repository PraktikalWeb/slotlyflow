'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Alert } from '@/components/feedback/Alert';
import { SemanticIcon } from '@/src/icons/semantic-icon';
import { useWhatsAppConnection } from '@/src/whatsapp/whatsapp-connection-context';
import { ConnectWhatsAppCard } from './ConnectWhatsAppCard';

/**
 * WhatsAppConnectionGate
 *
 * Wraps page content that requires a connected WhatsApp number.
 * While loading shows a neutral placeholder (same footprint as the card).
 * When not connected shows the standardized ConnectWhatsAppCard.
 * The CTA navigates to /dashboard/whatsapp — the single onboarding surface.
 */
export function WhatsAppConnectionGate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  const connection = useWhatsAppConnection();
  const router = useRouter();

  if (connection.status === 'loading') {
    return (
      <div className="flex min-h-[480px] items-center justify-center p-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
            <img src="/green_icon.png" alt="" aria-hidden="true" className="z-10 h-10 w-10 object-contain" />
            <div aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#E1E8E4] border-t-[#003B2D]" />
          </div>
          <h2 className="text-[24px] font-bold tracking-tight text-[var(--ink)]">Loading</h2>
          <p className="mt-2 text-[15px] font-medium text-[var(--ink-secondary)]">Checking WhatsApp connection…</p>
        </div>
      </div>
    );
  }

  if (connection.status === 'unavailable') {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Alert kind="error">Unable to load the WhatsApp connection for this Business. Please try again.</Alert>
        <button
          className="mt-4 h-10 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-[14px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
          onClick={() => { void connection.refresh(); }}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  if (connection.connection?.connectionStatus === 'CONNECTED') return <>{children}</>;

  const setupInProgress =
    connection.connection?.connectionStatus === 'PENDING' ||
    connection.connection?.connectionStatus === 'VERIFYING';

  if (setupInProgress) {
    return (
      <section className="flex min-h-[420px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm sm:p-12">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
          <SemanticIcon className="h-9 w-9 animate-spin" concept="loader" size="feature" />
        </div>
        <h2 className="text-[22px] font-semibold tracking-tight text-[var(--ink)]">Connecting WhatsApp</h2>
        <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-[var(--ink-secondary)]">
          We're finishing the WhatsApp connection for this Business.
        </p>
        <Link
          className="mt-6 inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-[14px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-subtle)]"
          href="/dashboard/whatsapp"
        >
          View WhatsApp status
        </Link>
      </section>
    );
  }

  // No connection — show the standardised card navigating to the onboarding surface.
  return (
    <ConnectWhatsAppCard
      onConnect={() => { router.push('/dashboard/whatsapp'); }}
    />
  );
}
