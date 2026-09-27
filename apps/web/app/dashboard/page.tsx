'use client';

import * as React from 'react';

import { SemanticIcon } from '@/src/icons/semantic-icon';
import { useWhatsAppConnection } from '@/src/whatsapp/whatsapp-connection-context';

export default function DashboardPage(): React.JSX.Element {
  const whatsapp = useWhatsAppConnection();

  if (whatsapp.status === 'loading') return <HomeLoader />;

  const connection = whatsapp.connection;
  const connectionPresentation = whatsapp.status === 'unavailable'
    ? { label: 'Unavailable', detail: 'Unable to load WhatsApp connection status.', connected: false }
    : connection?.connectionStatus === 'CONNECTED'
      ? { label: connection.displayPhoneNumber ?? 'Connected', detail: 'Connected and active', connected: true }
      : connection?.connectionStatus === 'PENDING' || connection?.connectionStatus === 'VERIFYING'
        ? { label: 'Connecting', detail: 'WhatsApp connection is being finalised.', connected: false }
        : connection?.connectionStatus === 'FAILED'
          ? { label: 'Needs attention', detail: 'WhatsApp connection needs attention.', connected: false }
          : connection?.connectionStatus === 'DISCONNECTED'
            ? { label: 'Disconnected', detail: 'No WhatsApp number is currently connected.', connected: false }
            : { label: 'Not connected', detail: 'No WhatsApp number is currently connected.', connected: false };

  return (
    <div className="max-w-[1440px] mx-auto px-8 py-8 space-y-6">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricUnavailableCard detail="Message summaries are not available yet." title="Messages" />
          <MetricUnavailableCard detail="Automation summaries are not available yet." title="Active Automations" />

          <div className="flex flex-col justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div>
              <p className="mb-3 text-[13px] font-medium text-[var(--ink-secondary)]">WhatsApp Connection</p>
              <div className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1">
                <div className={`h-1.5 w-1.5 rounded-full ${connectionPresentation.connected ? 'bg-[var(--flow-lime)]' : 'bg-[var(--ink-tertiary)]'}`} />
                <span className="text-[12px] font-medium text-[var(--ink)]">{connectionPresentation.label}</span>
              </div>
            </div>
            <p className={`mt-auto pt-2 text-[12px] ${whatsapp.status === 'unavailable' ? 'text-[var(--danger)]' : 'text-[var(--ink-tertiary)]'}`}>
              {connectionPresentation.detail}
            </p>
          </div>
        </div>

        <div className="mt-6 flex min-h-[360px] flex-col items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)]">
            <div className="flex h-[20px] w-[20px] items-center justify-center text-[var(--ink-secondary)]">
              <SemanticIcon concept="automations" size="control" />
            </div>
          </div>
          <h3 className="mb-2 text-[16px] font-semibold tracking-tight text-[var(--ink)]">Welcome to Home</h3>
          <p className="mb-6 max-w-sm text-[14px] leading-relaxed text-[var(--ink-secondary)]">
            Your workspace is ready. Recent activity will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricUnavailableCard({ detail, title }: Readonly<{ detail: string; title: string }>): React.JSX.Element {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="mb-1 text-[13px] font-medium text-[var(--ink-secondary)]">{title}</p>
      <span className="text-[28px] font-semibold tracking-tight text-[var(--ink-tertiary)]">—</span>
      <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">{detail}</p>
    </div>
  );
}

function HomeLoader(): React.JSX.Element {
  return (
    <div className="flex min-h-[480px] items-center justify-center p-8">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
          <img alt="" aria-hidden="true" className="z-10 h-10 w-10 object-contain" src="/green_icon.png" />
          <div aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#E1E8E4] border-t-[#003B2D]" />
        </div>
        <h2 className="text-[24px] font-bold tracking-tight text-[var(--ink)]">Loading Home</h2>
        <p className="mt-2 text-[15px] font-medium text-[var(--ink-secondary)]">Getting your Business ready.</p>
      </div>
    </div>
  );
}
