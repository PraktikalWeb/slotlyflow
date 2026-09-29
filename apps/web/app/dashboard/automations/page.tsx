'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { WhatsAppConnectionGate } from '@/components/whatsapp/WhatsAppConnectionGate';
import { useDashboardContext } from '@/src/dashboard/dashboard-context';
import { SemanticIcon } from '@/src/icons/semantic-icon';
import {
  getBotPublication,
  saveBotPublication,
  type BotPublication,
} from '@/src/automation/bot-publication-client';
import {
  executeBotPreview,
  resetBotPreview,
  type BotPreviewInput,
  type BotPreviewOption,
} from '@/src/automation/bot-preview-client';
import {
  getBusinessNotificationSettings,
  saveBusinessNotificationSettings,
  type BusinessNotificationSettings,
} from '@/src/notifications/notification-settings-client';
import { getConnectionTest, startConnectionTest, type WhatsAppConnectionTest } from '@/src/whatsapp/whatsapp-connection-test-client';
import { connectionTestPhoneNumberMessage } from '@/src/whatsapp/connection-test-phone-number';
import { useWhatsAppConnection } from '@/src/whatsapp/whatsapp-connection-context';

const AUTOMATION_TABS = ['Connection Test', 'Automation Test', 'Notifications'] as const;
type AutomationTab = (typeof AUTOMATION_TABS)[number];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AutomationsPage(): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<AutomationTab>('Automation Test');
  const searchParams = useSearchParams();
  const { selectedMembership } = useDashboardContext();
  const business = selectedMembership.organization;

  React.useEffect(() => {
    if (searchParams.get('connection-test') !== '1') return;
    setActiveTab('Connection Test');
    document.getElementById('connection-test')?.focus();
  }, [searchParams]);

  return (
    <div className="flex h-full min-h-full w-full flex-1 flex-col overflow-y-auto bg-[var(--canvas)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
        <div className="mb-6 shrink-0 sm:mb-8">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">Automation</h1>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-2.5 py-1 text-[12px] font-semibold text-[var(--ink-secondary)]">
              {business.name}
            </span>
          </div>
          <p className="text-[15px] text-[var(--ink-secondary)]">
            Test and manage your WhatsApp automation for this Business.
          </p>
        </div>

        <WhatsAppConnectionGate>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-8 flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[var(--border)] pb-2">
              <div aria-label="Automation sections" className="flex items-center gap-6" role="tablist">
                {AUTOMATION_TABS.map((tab) => (
                  <button
                    key={tab}
                    aria-controls={`automation-${tab.toLowerCase().replace(/\s+/g, '-')}-panel`}
                    aria-selected={activeTab === tab}
                    className={`relative whitespace-nowrap pb-3 text-[14px] font-medium transition-colors ${
                      activeTab === tab
                        ? 'text-[var(--brand-green)]'
                        : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
                    }`}
                    id={`automation-${tab.toLowerCase().replace(/\s+/g, '-')}-tab`}
                    onClick={() => setActiveTab(tab)}
                    role="tab"
                    type="button"
                  >
                    {tab}
                    {activeTab === tab && (
                      <span className="absolute inset-x-0 -bottom-2 h-0.5 bg-[var(--flow-lime)]" />
                    )}
                  </button>
                ))}
              </div>
              <BotPublicationPanel organizationId={business.id} />
            </div>

            {activeTab === 'Connection Test' && <ConnectionTestPanel organizationId={business.id} />}
            {activeTab === 'Automation Test' && <BotTestPanel key={business.id} organizationId={business.id} />}
            {activeTab === 'Notifications' && <NotificationsPanel businessName={business.name} organizationId={business.id} />}
          </div>
        </WhatsAppConnectionGate>
      </div>
    </div>
  );
}

function BotPublicationPanel({ organizationId }: Readonly<{ organizationId: string }>): React.JSX.Element {
  const [publication, setPublication] = React.useState<BotPublication>();
  const [loadedOrganizationId, setLoadedOrganizationId] = React.useState(organizationId);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string>();
  const publicationRequestId = React.useRef(0);

  const load = React.useCallback(async () => {
    const requestId = ++publicationRequestId.current;
    setLoadedOrganizationId(organizationId);
    setPublication(undefined);
    setSaving(false);
    setLoading(true);
    setFeedback(undefined);
    const current = await getBotPublication(organizationId);
    if (requestId !== publicationRequestId.current) return;
    setLoading(false);
    if (current === undefined) {
      setFeedback('We could not load bot status. Please try again.');
      return;
    }
    setPublication(current);
  }, [organizationId]);

  React.useEffect(() => {
    void load();
    return () => { publicationRequestId.current += 1; };
  }, [load]);

  const setPublished = async (published: boolean): Promise<void> => {
    if (saving || publication === undefined || publication.status === 'NOT_CONFIGURED' || loadedOrganizationId !== organizationId) return;
    const requestId = ++publicationRequestId.current;
    setSaving(true);
    setFeedback(undefined);
    const saved = await saveBotPublication(organizationId, published);
    if (requestId !== publicationRequestId.current) return;
    setSaving(false);
    if (saved === undefined) {
      setFeedback('We could not update bot status. Please try again.');
      return;
    }
    setPublication(saved);
  };

  const published = publication?.status === 'PUBLISHED';

  if (feedback !== undefined) {
    return <div className="flex h-8 items-center gap-2 text-[13px] text-[var(--error)]" role="alert"><span className="group/tip relative" tabIndex={0} aria-describedby="bot-status-tip"><SemanticIcon className="text-[var(--danger)]" concept="error" size="metadata" /><span id="bot-status-tip" role="tooltip" className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-[260px] -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left shadow-md group-hover/tip:visible group-focus/tip:visible"><span className="block text-[13px] font-semibold text-[var(--ink)]">Status: unavailable</span><span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--ink-secondary)]">SlotlyFlow could not load the current bot status.</span></span></span><span>Unavailable</span><button className="rounded-[var(--radius-sm)] px-1 font-medium text-[var(--brand-green)] hover:bg-[var(--surface-subtle)]" onClick={() => { void load(); }} type="button">Try again</button></div>;
  }
  if (loading || publication === undefined || loadedOrganizationId !== organizationId) {
    return <div className="flex h-8 items-center gap-2 text-[13px] text-[var(--ink-secondary)]"><span className="group/tip relative" tabIndex={0}><SemanticIcon className="animate-spin" concept="loader" size="metadata" /><span role="tooltip" className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-[260px] -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left shadow-md group-hover/tip:visible group-focus/tip:visible"><span className="block text-[13px] font-semibold text-[var(--ink)]">Checking bot status</span><span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--ink-secondary)]">SlotlyFlow is checking the current automation status.</span></span></span> Loading…</div>;
  }
  if (publication.status === 'NOT_CONFIGURED') {
    return <div className="flex h-8 items-center gap-2 text-[13px] text-[var(--ink-secondary)]"><span className="group/tip relative" tabIndex={0}><SemanticIcon className="text-[var(--error)]" concept="close" size="metadata" /><span role="tooltip" className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-[260px] -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left shadow-md group-hover/tip:visible group-focus/tip:visible"><span className="block text-[13px] font-semibold text-[var(--ink)]">Status: not configured</span><span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--ink-secondary)]">No bot is currently configured for this Business.</span></span></span><span>Not configured</span></div>;
  }
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 items-center">
        <span className="group/tip relative" tabIndex={0}>
          <span aria-hidden="true" className={`block h-2 w-2 rounded-full ${published ? 'bg-[var(--success)]' : 'bg-[var(--ink-tertiary)]'}`} />
          <span role="tooltip" className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-[260px] -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left shadow-md group-hover/tip:visible group-focus/tip:visible">
            <span className="block text-[13px] font-semibold text-[var(--ink)]">{published ? 'Status: published' : 'Status: unpublished'}</span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--ink-secondary)]">{published ? 'Your bot is live and can respond to new incoming WhatsApp messages.' : 'Your bot is paused and will not respond to new incoming WhatsApp messages.'}</span>
          </span>
        </span>
      </div>
      <button
        className={`inline-flex h-8 items-center rounded-[var(--radius-sm)] px-3 text-[13px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
          published
            ? 'border border-[var(--border-strong)] bg-transparent text-[var(--ink)] hover:border-[var(--ink-tertiary)] hover:bg-[var(--surface-subtle)] hover:shadow-sm'
            : 'bg-[var(--brand-green)] text-white hover:bg-[#00261D] hover:shadow-sm'
        }`}
        disabled={saving}
        onClick={() => { void setPublished(!published); }}
        type="button"
      >
        {saving ? (published ? 'Unpublishing…' : 'Publishing…') : published ? 'Unpublish' : 'Publish'}
      </button>
    </div>
  );
}

function ConnectionTestPanel({ organizationId }: Readonly<{ organizationId: string }>): React.JSX.Element {
  const connection = useWhatsAppConnection();
  const [test, setTest] = React.useState<WhatsAppConnectionTest>();
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [phoneError, setPhoneError] = React.useState<string>();
  const [changingNumber, setChangingNumber] = React.useState(false);

  const load = React.useCallback(async () => {
    const current = await getConnectionTest(organizationId);
    if (current === undefined) setError('We could not load the Connection Test. Please try again.');
    else {
      setTest(current);
      setError(undefined);
    }
    setLoading(false);
  }, [organizationId]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    if (test?.status !== 'IN_PROGRESS') return;
    const interval = window.setInterval(() => { void load(); }, 4_000);
    return () => window.clearInterval(interval);
  }, [load, test?.status]);

  const start = async (number = phoneNumber): Promise<void> => {
    if (starting) return;
    setStarting(true);
    setError(undefined);
    const started = await startConnectionTest(organizationId, number);
    setStarting(false);
    if (started.ok === false) {
      if (started.issue !== 'UNAVAILABLE') {
        setPhoneError(connectionTestPhoneNumberMessage(started.issue));
        return;
      }
      setError('We could not start the Connection Test. Check the number and try again.');
      return;
    }
    setPhoneError(undefined);
    setChangingNumber(false);
    setTest(started.test);
  };

  const connectedNumber = connection.connection?.displayPhoneNumber ?? 'your connected WhatsApp number';
  const connectionReady = connection.connection?.connectionStatus === 'CONNECTED' && connection.connection.verificationStatus === 'VERIFIED';
  const savedTestNumber = test?.testSenderPhoneNumber ?? null;

  return (
    <section aria-labelledby="connection-test-heading" className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6" id="connection-test" tabIndex={-1}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-green)]/10 text-[var(--brand-green)]">
          <SemanticIcon concept="whatsappConnection" size="control" />
        </div>
        <div>
          <h2 className="text-[17px] font-semibold text-[var(--ink)]" id="connection-test-heading">Connection test</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-secondary)]">Make sure SlotlyFlow can receive and respond through your connected WhatsApp number.</p>
        </div>
      </div>

      {!connectionReady ? (
        <p className="mt-5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-[13px] text-[var(--ink-secondary)]">Refresh and verify your WhatsApp connection before starting a Connection Test.</p>
      ) : loading ? (
        <div className="mt-5 flex items-center gap-2 text-[13px] text-[var(--ink-secondary)]"><SemanticIcon className="animate-spin" concept="loader" size="metadata" /> Loading Connection Test…</div>
      ) : test?.status === 'IN_PROGRESS' && !changingNumber ? (
        <ConnectionTestProgress connectedNumber={connectedNumber} onChangeNumber={() => { setPhoneNumber(test.testSenderPhoneNumber ?? ''); setChangingNumber(true); }} test={test} />
      ) : savedTestNumber !== null && !changingNumber ? (
        <ExistingTestNumber
          connectedNumber={connectedNumber}
          failed={test?.status === 'FAILED'}
          onChange={() => { setPhoneNumber(savedTestNumber); setChangingNumber(true); }}
          onStart={() => { void start(savedTestNumber); }}
          passed={test?.status === 'PASSED'}
          starting={starting}
          testNumber={savedTestNumber}
        />
      ) : (
        <ConnectionTestStart
          connectedNumber={connectedNumber}
          error={error}
          onChange={(value) => { setPhoneNumber(value); setPhoneError(undefined); }}
          onStart={() => { void start(); }}
          phoneError={phoneError}
          phoneNumber={phoneNumber}
          starting={starting}
          failed={test?.status === 'FAILED'}
        />
      )}
    </section>
  );
}

function ConnectionTestStart({ connectedNumber, error, failed, onChange, onStart, phoneError, phoneNumber, starting }: Readonly<{
  connectedNumber: string; error: string | undefined; failed: boolean; onChange: (value: string) => void; onStart: () => void; phoneError: string | undefined; phoneNumber: string; starting: boolean;
}>): React.JSX.Element {
  return <div className="mt-5 max-w-md">
    {failed && <p className="mb-4 text-[13px] leading-relaxed text-[var(--ink-secondary)]">We didn&apos;t receive or complete your test message. Check the number below, then try again.</p>}
    {error && <p className="mb-4 text-[13px] text-[var(--error)]" role="alert">{error}</p>}
    <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">Business WhatsApp number</p>
    <p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">{connectedNumber}</p>
    <label className="mt-5 block text-[14px] font-medium text-[var(--ink)]" htmlFor="connection-test-phone">Test WhatsApp number</label>
    <input aria-describedby={phoneError === undefined ? undefined : 'connection-test-phone-error'} aria-invalid={phoneError !== undefined} className={`mt-1.5 h-10 w-full rounded-[var(--radius-sm)] border bg-[var(--surface)] px-3 text-[14px] text-[var(--ink)] ${phoneError === undefined ? 'border-[var(--border-strong)]' : 'border-[var(--error)]'}`} id="connection-test-phone" inputMode="tel" onChange={(event) => onChange(event.target.value)} placeholder="082 123 4567" type="tel" value={phoneNumber} />
    {phoneError && <p className="mt-1.5 text-[13px] text-[var(--error)]" id="connection-test-phone-error">{phoneError}</p>}
    <button className="mt-4 inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--brand-green)] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={starting} onClick={onStart} type="button">
      {starting && <SemanticIcon className="animate-spin" concept="loader" size="metadata" />}{starting ? 'Starting…' : 'Start connection test'}
    </button>
  </div>;
}

function ExistingTestNumber({ connectedNumber, failed, onChange, onStart, passed, starting, testNumber }: Readonly<{
  connectedNumber: string; failed: boolean; onChange: () => void; onStart: () => void; passed: boolean; starting: boolean; testNumber: string;
}>): React.JSX.Element {
  return <div className="mt-5 max-w-md">
    <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">Business WhatsApp number</p>
    <p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">{connectedNumber}</p>
    <div className="mt-5 flex items-end justify-between gap-3">
      <div><p className="text-[12px] font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">Test WhatsApp number</p><p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">{testNumber}</p></div>
      <button className="h-8 shrink-0 rounded-[var(--radius-sm)] px-2 text-[13px] font-medium text-[var(--brand-green)] hover:bg-[var(--surface-subtle)]" onClick={onChange} type="button">Change</button>
    </div>
    {passed && <p className="mt-4 text-[13px] text-[var(--success)]">Your last Connection Test passed.</p>}
    {failed && <p className="mt-4 text-[13px] text-[var(--ink-secondary)]">Your last Connection Test did not complete. You can try again.</p>}
    <button className="mt-5 inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--brand-green)] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={starting} onClick={onStart} type="button">{starting && <SemanticIcon className="animate-spin" concept="loader" size="metadata" />}{starting ? 'Starting…' : 'Start connection test'}</button>
  </div>;
}

function ConnectionTestProgress({ connectedNumber, onChangeNumber, test }: Readonly<{ connectedNumber: string; onChangeNumber: () => void; test: WhatsAppConnectionTest }>): React.JSX.Element {
  const completed = test.stage === 'MESSAGE_RECEIVED' || test.stage === 'REPLY_SENT' || test.stage === 'PASSED';
  return <div className="mt-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">Business WhatsApp number</p><p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">{connectedNumber}</p></div><button className="mt-1 h-8 shrink-0 rounded-[var(--radius-sm)] px-2 text-[13px] font-medium text-[var(--brand-green)] hover:bg-[var(--surface-subtle)]" onClick={onChangeNumber} type="button">Change</button></div>
    <p className="mt-5 text-[12px] font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">Test WhatsApp number</p><p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">{test.testSenderPhoneNumber}</p>
    <h3 className="mt-5 text-[15px] font-semibold text-[var(--ink)]">Waiting for your message</h3>
    <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-secondary)]">Send any WhatsApp message from <strong>{test.testSenderPhoneNumber}</strong> to <strong>{connectedNumber}</strong>. We&apos;ll reply automatically when we receive it.</p>
    <ol className="mt-5 space-y-3 text-[13px] text-[var(--ink-secondary)]">
      <ProgressItem active={!completed} done={completed} label="Message received" />
      <ProgressItem active={test.stage === 'MESSAGE_RECEIVED'} done={test.stage === 'REPLY_SENT' || test.stage === 'PASSED'} label="Test reply sent" />
      <ProgressItem active={test.stage === 'REPLY_SENT'} done={test.stage === 'PASSED'} label="Connection verified" />
    </ol>
  </div>;
}

function ProgressItem({ active, done, label }: Readonly<{ active: boolean; done: boolean; label: string }>): React.JSX.Element {
  return <li className="flex items-center gap-2">{done ? <SemanticIcon concept="check" className="text-[var(--success)]" size="metadata" /> : active ? <SemanticIcon className="animate-spin" concept="loader" size="metadata" /> : <span className="h-2 w-2 rounded-full border border-[var(--border-strong)]" />}<span className={done ? 'text-[var(--ink)]' : ''}>{label}</span></li>;
}

type PreviewChatMessage = {
  readonly id: number;
  readonly author: 'Customer' | 'Bot';
  readonly text: string;
  readonly time: string;
  readonly options?: readonly BotPreviewOption[];
};

function BotTestPanel({ organizationId }: Readonly<{ organizationId: string }>): React.JSX.Element {
  const [messages, setMessages] = React.useState<readonly PreviewChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [previewSessionId, setPreviewSessionId] = React.useState<string | null>(null);
  const [handover, setHandover] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string>();
  const requestId = React.useRef(0);
  const messageId = React.useRef(0);
  const inFlight = React.useRef(false);

  React.useEffect(() => {
    requestId.current += 1;
    messageId.current = 0;
    inFlight.current = false;
    setMessages([]);
    setInput('');
    setSending(false);
    setPreviewSessionId(null);
    setHandover(false);
    setFeedback(undefined);
  }, [organizationId]);

  const submit = async (botInput: BotPreviewInput, visibleCustomerText: string): Promise<void> => {
    if (inFlight.current || handover) return;
    inFlight.current = true;
    const currentRequestId = ++requestId.current;
    const customerMessage: PreviewChatMessage = {
      id: ++messageId.current,
      author: 'Customer',
      text: visibleCustomerText,
      time: previewTime(),
    };
    setMessages((current) => [...current, customerMessage]);
    setInput('');
    setSending(true);
    setFeedback(undefined);

    const result = await executeBotPreview(organizationId, previewSessionId, botInput);
    if (currentRequestId !== requestId.current) {
      inFlight.current = false;
      return;
    }
    inFlight.current = false;
    setSending(false);
    if (result.ok === false) {
      setFeedback(result.issue === 'NOT_CONFIGURED'
        ? 'No Bot is configured for this Business.'
        : result.issue === 'SESSION_UNAVAILABLE'
          ? 'This preview session expired or changed. Reset the test and try again.'
          : 'We could not run the Bot preview. Please try again.');
      return;
    }
    setPreviewSessionId(result.preview.previewSessionId);
    setHandover(result.preview.handover);
    setMessages((current) => [...current, ...result.preview.messages.map((message): PreviewChatMessage => ({
      id: ++messageId.current,
      author: 'Bot',
      text: message.type === 'text' ? message.text : message.body,
      time: previewTime(),
      ...(message.type === 'interactive' ? { options: message.options } : {}),
    }))]);
  };

  const send = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const text = input.trim();
    if (text.length === 0) return;
    await submit({ type: 'text', text }, text);
  };

  const reset = async (): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (previewSessionId !== null) {
      setSending(true);
      const wasReset = await resetBotPreview(organizationId, previewSessionId);
      setSending(false);
      if (!wasReset) {
        inFlight.current = false;
        setFeedback('We could not reset the Bot preview. Please try again.');
        return;
      }
    }
    requestId.current += 1;
    messageId.current = 0;
    setMessages([]);
    setInput('');
    setPreviewSessionId(null);
    setHandover(false);
    setFeedback(undefined);
    inFlight.current = false;
  };

  const latestBotMessage = messages.reduce<PreviewChatMessage | undefined>(
    (latest, message) => message.author === 'Bot' ? message : latest,
    undefined,
  );
  const latestOptionMessageId = latestBotMessage?.options === undefined ? null : latestBotMessage.id;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const prevLengthRef = React.useRef(0);

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNewMessage = messages.length > prevLengthRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNewMessage || isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
    prevLengthRef.current = messages.length;
  }, [messages]);
  return (
    <section
      aria-labelledby="automation-test-tab"
      className="relative flex min-h-[500px] w-full flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[#EFEAE2] shadow-sm"
      id="automation-test-panel"
      role="tabpanel"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#128C7E] text-white">
          <SemanticIcon className="h-4 w-4" concept="bot" size="control" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-semibold text-[var(--ink)]">SlotlyFlow Bot</span>
          <span className="truncate text-[12px] text-[var(--ink-secondary)]">Preview Mode</span>
        </div>
        <button className="rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-medium text-[#128C7E] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#128C7E] disabled:cursor-not-allowed disabled:opacity-50" disabled={sending} onClick={() => { void reset(); }} type="button">Reset test</button>
      </div>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-repeat bg-center p-4 [scrollbar-color:rgba(0,0,0,0.15)_transparent] [scrollbar-width:thin] hover:[&::-webkit-scrollbar-thumb]:bg-black/25 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-[6px]"
        style={{ backgroundImage: 'linear-gradient(to bottom, #EFEAE2, #EFEAE2)' }}
      >
        {messages.length === 0 ? (
          <div className="m-auto flex flex-col items-center justify-center text-center">
            <span className="text-[14px] font-semibold text-[var(--ink)]">Send a message to test the bot</span>
            <span className="mt-1 max-w-[240px] text-[13px] text-[var(--ink-secondary)]">Type a message below to start a preview conversation.</span>
          </div>
        ) : (
          <div className="mt-auto flex w-full flex-col gap-4">
          {messages.map((message) => (
            <div className={message.author === 'Customer' ? 'flex justify-end' : 'flex justify-start'} key={message.id}>
              <div className={`relative max-w-[80%] rounded-lg px-3 py-2 shadow-sm ${message.author === 'Customer' ? 'rounded-tr-sm bg-[#D9FDD3]' : 'rounded-tl-sm bg-white'}`}>
                <span className={`mb-0.5 block text-[11px] font-bold ${message.author === 'Customer' ? 'text-[#128C7E]' : 'text-[var(--flow-violet)]'}`}>{message.author}</span>
                <p className="whitespace-pre-wrap text-[14px] leading-snug text-[#111111]">{message.text}</p>
                {message.options !== undefined ? (
                  <div className="-mx-3 mt-2 border-t border-[#E3E7E5]">
                    {message.options.map((option) => (
                      <button
                        className="block w-full border-b border-[#E3E7E5] px-3 py-2 text-center text-[13px] font-medium text-[#128C7E] last:border-b-0 hover:bg-[#F5FAF8] focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#128C7E] disabled:cursor-default disabled:text-gray-400 disabled:hover:bg-transparent"
                        disabled={sending || handover || message.id !== latestOptionMessageId}
                        key={option.id}
                        onClick={() => { void submit({ type: 'interactive_reply', optionId: option.id }, option.label); }}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <span className="float-right ml-3 mt-1 text-[10px] text-gray-500">{message.time}</span>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {feedback && <p className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 pt-3 text-[13px] text-[var(--error)]" role="alert">{feedback}</p>}
      <form className="flex shrink-0 items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3" onSubmit={(event) => { void send(event); }}>
        <div className="flex flex-1 items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-4 py-2">
          <input
            className="w-full border-none bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-tertiary)]"
            disabled={sending || handover}
            maxLength={4096}
            onChange={(event) => setInput(event.target.value)}
            placeholder={handover ? 'Reset the test to start again' : 'Type a test message...'}
            type="text"
            value={input}
          />
        </div>
        <button
          aria-label="Send test message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#128C7E] text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={sending || handover || input.trim().length === 0}
          type="submit"
        >
          <SemanticIcon className={`ml-0.5 h-4 w-4 ${sending ? 'animate-spin' : ''}`} concept={sending ? 'loader' : 'arrowRight'} size="control" />
        </button>
      </form>
    </section>
  );
}

function previewTime(): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
}

function NotificationsPanel({ businessName, organizationId }: Readonly<{ businessName: string; organizationId: string }>): React.JSX.Element {
  const [settings, setSettings] = React.useState<BusinessNotificationSettings>();
  const [notificationEmail, setNotificationEmail] = React.useState('');
  const [loadedOrganizationId, setLoadedOrganizationId] = React.useState(organizationId);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ readonly kind: 'error' | 'success'; readonly message: string }>();
  const settingsRequestId = React.useRef(0);

  const load = React.useCallback(async () => {
    const requestId = ++settingsRequestId.current;
    setLoadedOrganizationId(organizationId);
    setSettings(undefined);
    setNotificationEmail('');
    setSaving(false);
    setLoading(true);
    setFeedback(undefined);
    const current = await getBusinessNotificationSettings(organizationId);
    if (requestId !== settingsRequestId.current) return;
    setLoading(false);
    if (current === undefined) {
      setSettings(undefined);
      setNotificationEmail('');
      setFeedback({ kind: 'error', message: 'We could not load notification settings. Please try again.' });
      return;
    }
    setSettings(current);
    setNotificationEmail(current.fallbackEmailAddresses[0] ?? '');
  }, [organizationId]);

  React.useEffect(() => {
    void load();
    return () => { settingsRequestId.current += 1; };
  }, [load]);

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (saving || settings === undefined || loadedOrganizationId !== organizationId) return;
    const normalizedEmail = notificationEmail.trim().toLowerCase();
    if (normalizedEmail !== '' && !emailPattern.test(normalizedEmail)) {
      setFeedback({ kind: 'error', message: 'Enter a valid notification email address.' });
      return;
    }
    const requestId = ++settingsRequestId.current;
    setSaving(true);
    setFeedback(undefined);
    const saved = await saveBusinessNotificationSettings(organizationId, {
      handoverTeamId: settings.handoverTeamId,
      fallbackEmailAddresses: normalizedEmail === ''
        ? []
        : [normalizedEmail, ...settings.fallbackEmailAddresses.slice(1).filter((address) => address !== normalizedEmail)],
      emailNotificationsEnabled: settings.emailNotificationsEnabled,
    });
    if (requestId !== settingsRequestId.current) return;
    setSaving(false);
    if (saved === undefined) {
      setFeedback({ kind: 'error', message: 'We could not save notification settings. Please try again.' });
      return;
    }
    setSettings(saved);
    setNotificationEmail(saved.fallbackEmailAddresses[0] ?? '');
    setFeedback({ kind: 'success', message: 'Notification email saved.' });
  };

  return (
    <section
      aria-labelledby="automation-notifications-tab"
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-sm"
      id="automation-notifications-panel"
      role="tabpanel"
    >
      <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 sm:px-6">
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Email Notifications</h2>
        <p className="mt-0.5 text-[13px] text-[var(--ink-secondary)]">
          Important operational notifications, including human handover notifications, will be emailed to this address.
        </p>
      </div>

      <form className="space-y-6 p-5 sm:p-6" noValidate onSubmit={(event) => { void save(event); }}>
        {loading ? <div className="flex items-center gap-2 text-[13px] text-[var(--ink-secondary)]"><SemanticIcon className="animate-spin" concept="loader" size="metadata" /> Loading notification settings...</div> : null}
        {!loading && loadedOrganizationId === organizationId && settings !== undefined ? (
          <div>
            <label className="mb-1.5 block text-[14px] font-medium text-[var(--ink)]" htmlFor="automation-notification-email">
              Notification email
            </label>
            <input
              className="h-10 w-full max-w-md rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-[14px] text-[var(--ink)] focus:border-[var(--brand-green)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-green)]"
              id="automation-notification-email"
              onChange={(event) => { setNotificationEmail(event.target.value); setFeedback(undefined); }}
              placeholder="Business owner email fallback"
              type="email"
              value={notificationEmail}
            />
            <p className="mt-1.5 text-[12px] text-[var(--ink-secondary)]">
              This email is used for important operational notifications for {businessName}.
            </p>
            <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">Leave blank to use the active Business owner&apos;s approved email when a fallback is needed.</p>
          </div>
        ) : null}
        {feedback !== undefined ? <p className={`rounded-[var(--radius-sm)] border px-3 py-2 text-[13px] ${feedback.kind === 'success' ? 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]' : 'border-[var(--error)]/30 bg-[var(--error)]/10 text-[var(--error)]'}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.message}</p> : null}
        {!loading && loadedOrganizationId === organizationId && settings !== undefined ? <button className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--brand-green)] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save changes'}</button> : null}
      </form>
    </section>
  );
}
