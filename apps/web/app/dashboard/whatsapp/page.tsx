'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { Alert } from '@/components/feedback/Alert';
import { useDashboardContext } from '@/src/dashboard/dashboard-context';
import { SemanticIcon } from '@/src/icons/semantic-icon';
import {
  completeWhatsAppOnboarding,
  startWhatsAppOnboarding,
  type WhatsAppConnection,
  type WhatsAppOnboardingCompletionIssue,
} from '@/src/whatsapp/whatsapp-client';
import { useWhatsAppConnection } from '@/src/whatsapp/whatsapp-connection-context';
import { prepareMetaEmbeddedSignup } from '@/src/whatsapp/meta-embedded-signup';

import whatsappBusinessAppIcon from '../../../public/brand/whatsapp-business-app.jpg';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionFeedback = {
  readonly organizationId: string;
  readonly kind: 'error' | 'info';
  readonly message: string;
};

type ConnectStep =
  | { readonly kind: 'idle' }
  | { readonly kind: 'preparing' }
  | { readonly kind: 'authorising' }
  | { readonly kind: 'verifying' }
  | { readonly kind: 'finalising' }
  | { readonly kind: 'success'; readonly phoneNumber: string | null }
  | { readonly kind: 'recovery' };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerWhatsApp(): React.JSX.Element {
  const router = useRouter();
  const { selectedMembership } = useDashboardContext();
  const connectionState = useWhatsAppConnection();
  const organizationId = selectedMembership.organization.id;
  const [startingOrganizationId, setStartingOrganizationId] = React.useState<string>();
  const [validatingOrganizationId, setValidatingOrganizationId] = React.useState<string>();
  const [feedback, setFeedback] = React.useState<ActionFeedback>();
  const [connectStep, setConnectStep] = React.useState<ConnectStep>({ kind: 'idle' });
  const currentOrganizationIdRef = React.useRef(organizationId);
  const onboardingInFlightRef = React.useRef(false);
  const validationInFlightRef = React.useRef(false);

  React.useEffect(() => {
    currentOrganizationIdRef.current = organizationId;
    /* eslint-disable react-hooks/set-state-in-effect -- Business changes intentionally reset transient onboarding UI state. */
    setConnectStep({ kind: 'idle' });
    setFeedback(undefined);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [organizationId]);

  const canManage = selectedMembership.role === 'OWNER' || selectedMembership.role === 'ADMIN';
  const isStarting = startingOrganizationId === organizationId;
  const isValidating = validatingOrganizationId === organizationId;

  const beginConnection = async (): Promise<void> => {
    if (isStarting || onboardingInFlightRef.current || !canManage) return;
    const operationOrganizationId = organizationId;
    onboardingInFlightRef.current = true;
    setStartingOrganizationId(operationOrganizationId);
    setFeedback(undefined);
    setConnectStep({ kind: 'preparing' });

    try {
      const start = await startWhatsAppOnboarding(operationOrganizationId);
      if (start.ok === false) {
        setFeedback({ organizationId: operationOrganizationId, kind: 'error', message: 'Unable to start WhatsApp setup. Please try again.' });
        setConnectStep({ kind: 'idle' });
        return;
      }
      if (currentOrganizationIdRef.current !== operationOrganizationId) return;

      setConnectStep({ kind: 'authorising' });
      const launcher = await prepareMetaEmbeddedSignup(start.onboarding.meta);
      const providerResult = await launcher.launch();
      if (currentOrganizationIdRef.current !== operationOrganizationId) return;
      if (providerResult.kind === 'cancelled') {
        setFeedback({ organizationId: operationOrganizationId, kind: 'info', message: "WhatsApp setup was not completed. You can try again when you're ready." });
        setConnectStep({ kind: 'idle' });
        return;
      }
      if (providerResult.kind === 'error') {
        setFeedback({ organizationId: operationOrganizationId, kind: 'error', message: 'Unable to complete WhatsApp setup. Please try again.' });
        setConnectStep({ kind: 'idle' });
        return;
      }

      setConnectStep({ kind: 'finalising' });
      let authorizationCode = providerResult.authorizationCode;
      try {
        const completion = await completeWhatsAppOnboarding(
          operationOrganizationId,
          start.onboarding.transactionId,
          {
            authorizationCode,
            phoneNumberId: providerResult.phoneNumberId,
            whatsappBusinessAccountId: providerResult.whatsappBusinessAccountId,
          },
        );
        if (completion.ok === false) {
          if (completion.httpStatus === 409 && await reconcilePersistedConnection(operationOrganizationId, true)) return;
          setFeedback({
            organizationId: operationOrganizationId,
            kind: 'error',
            message: completionFailureMessage(completion.issue),
          });
          setConnectStep({ kind: 'recovery' });
          return;
        }

        if (!await reconcilePersistedConnection(operationOrganizationId)) {
          setFeedback({ organizationId: operationOrganizationId, kind: 'error', message: 'WhatsApp was set up with Meta, but SlotlyFlow could not confirm the connection yet.' });
          setConnectStep({ kind: 'recovery' });
        }
      } finally {
        authorizationCode = '';
      }
    } catch {
      setFeedback({ organizationId: operationOrganizationId, kind: 'error', message: 'Unable to start WhatsApp setup. Please try again.' });
      setConnectStep({ kind: 'idle' });
    } finally {
      onboardingInFlightRef.current = false;
      setStartingOrganizationId((current) => current === operationOrganizationId ? undefined : current);
    }
  };

  const dismissConnectModal = () => setConnectStep({ kind: 'idle' });

  const checkRecoveryStatus = async (): Promise<void> => {
    const currentOrganizationId = currentOrganizationIdRef.current;
    if (await reconcilePersistedConnection(currentOrganizationId, true)) return;
    setFeedback({ organizationId: currentOrganizationId, kind: 'error', message: 'The WhatsApp connection is not available yet. Please try again later.' });
  };

  async function reconcilePersistedConnection(operationOrganizationId: string, validate = false): Promise<boolean> {
    if (currentOrganizationIdRef.current !== operationOrganizationId) return false;
    const refreshed = validate ? await connectionState.validate() : await connectionState.refresh();
    if (
      currentOrganizationIdRef.current === operationOrganizationId
      && refreshed.ok === true
      && refreshed.connection?.connectionStatus === 'CONNECTED'
      && refreshed.connection.verificationStatus === 'VERIFIED'
    ) {
      setConnectStep({ kind: 'success', phoneNumber: refreshed.connection.displayPhoneNumber });
      return true;
    }
    return false;
  }

  const validateConnection = async (): Promise<void> => {
    if (validationInFlightRef.current) return;
    const operationOrganizationId = organizationId;
    validationInFlightRef.current = true;
    setValidatingOrganizationId(operationOrganizationId);
    setFeedback(undefined);
    try {
      const result = await connectionState.validate();
      if (currentOrganizationIdRef.current !== operationOrganizationId) return;
      if (!result.ok) {
        setFeedback({ organizationId: operationOrganizationId, kind: 'error', message: 'We could not verify the WhatsApp connection. Please try again.' });
        return;
      }
      if (result.connection?.verificationStatus === 'CHECK_FAILED') {
        setFeedback({ organizationId: operationOrganizationId, kind: 'error', message: 'We could not verify the WhatsApp connection right now. Its previous status has been preserved.' });
      }
    } finally {
      validationInFlightRef.current = false;
      setValidatingOrganizationId((current) => current === operationOrganizationId ? undefined : current);
    }
  };

  return (
    <div className="flex-1 bg-[var(--canvas)]">
      {connectStep.kind !== 'idle' && (
        <ConnectingModal
          step={connectStep}
          onDismiss={dismissConnectModal}
          onCheckStatus={() => { void checkRecoveryStatus(); }}
          onTestConnection={() => { dismissConnectModal(); router.push('/dashboard/automations?connection-test=1'); }}
        />
      )}
      {connectStep.kind === 'idle' && feedback?.organizationId === organizationId && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1100px]">
            <Alert kind={feedback.kind}>{feedback.message}</Alert>
          </div>
        </div>
      )}
      <WhatsAppPageContent
        canManage={canManage}
        connection={connectionState.connection}
        isConnecting={isStarting}
        isRefreshing={isValidating}
        onConnect={() => { void beginConnection(); }}
        onRefresh={() => { void validateConnection(); }}
        onReload={() => { void connectionState.refresh(); }}
        state={connectionState.status}
      />
    </div>
  );
}

// ─── Connecting modal ──────────────────────────────────────────────────────────

const CONNECT_STAGES = [
  'Preparing connection',
  'Authorisation with Meta',
  'Verifying your number',
  'Connecting to SlotlyFlow',
];

const STEP_INDEX: Partial<Record<ConnectStep['kind'], number>> = {
  preparing: 0,
  authorising: 1,
  verifying: 2,
  finalising: 3,
};

function completionFailureMessage(issue: WhatsAppOnboardingCompletionIssue): string {
  switch (issue) {
    case 'META_AUTHORIZATION_CODE_EXCHANGE_FAILED':
      return 'Meta could not complete the connection authorization. Please try again.';
    case 'META_PHONE_OWNERSHIP_VERIFICATION_FAILED':
      return 'SlotlyFlow could not verify the selected WhatsApp number. Please try again.';
    case 'WHATSAPP_CONNECTION_PERSISTENCE_FAILED':
      return 'SlotlyFlow could not save the WhatsApp connection. Please try again.';
    case 'WHATSAPP_ONBOARDING_COMPLETION_UNAVAILABLE':
      return 'This WhatsApp setup could not be completed. SlotlyFlow checked for an existing connection first.';
    case 'META_ONBOARDING_NOT_CONFIGURED':
      return 'WhatsApp setup is not available right now. Please try again later.';
    case 'UNAVAILABLE':
      return 'SlotlyFlow could not complete the WhatsApp connection. Please try again.';
  }
}

function ConnectingModal({
  step,
  onCheckStatus,
  onDismiss,
  onTestConnection,
}: Readonly<{ step: ConnectStep; onCheckStatus: () => void; onDismiss: () => void; onTestConnection: () => void }>): React.JSX.Element {
  if (step.kind === 'success') {
    return (
      <ModalBackdrop>
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[var(--success)]/10">
            <SemanticIcon concept="success" className="!text-[36px] text-[var(--success)]" size="feature" />
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-[var(--ink)]">WhatsApp connected</h2>
          <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-[var(--ink-secondary)]">
            {step.phoneNumber === null
              ? 'Your WhatsApp number is now connected to SlotlyFlow.'
              : `${step.phoneNumber} is now connected to SlotlyFlow.`}
          </p>
          <div className="mt-7 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-left">
            <h3 className="text-[14px] font-semibold text-[var(--ink)]">Test your WhatsApp connection</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-secondary)]">Make sure SlotlyFlow can receive and respond to messages through your WhatsApp number.</p>
            <button
              className="mt-4 h-9 w-full rounded-[var(--radius-md)] bg-[var(--brand-green)] px-4 text-[13px] font-semibold text-white"
              onClick={onTestConnection}
              type="button"
            >
              Test connection
            </button>
          </div>
          <button
            className="mt-3 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-6 text-[14px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-subtle)]"
            onClick={onDismiss}
            type="button"
          >
            Skip for now
          </button>
        </div>
      </ModalBackdrop>
    );
  }

  if (step.kind === 'recovery') {
    return (
      <ModalBackdrop>
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[var(--warning)]/10">
            <SemanticIcon concept="warning" className="!text-[36px] text-[var(--warning)]" size="feature" />
          </div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--ink)]">Finishing your connection</h2>
          <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-[var(--ink-secondary)]">
            Your WhatsApp setup was completed with Meta. SlotlyFlow is finishing the connection in the background.
          </p>
          <button
            className="mt-8 h-11 w-full rounded-[var(--radius-md)] bg-[#25D366] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#20BD5A]"
            onClick={onCheckStatus}
            type="button"
          >
            Check connection status
          </button>
          <button
            className="mt-3 text-[13px] text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]"
            onClick={onDismiss}
            type="button"
          >
            Close
          </button>
        </div>
      </ModalBackdrop>
    );
  }

  const currentIdx = STEP_INDEX[step.kind] ?? 0;

  return (
    <ModalBackdrop>
      <div className="flex items-center gap-3 mb-7">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10">
          <SemanticIcon concept="loader" className="animate-spin !text-[20px] text-[#25D366]" size="control" />
        </div>
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--ink)]">Connecting your WhatsApp</h2>
      </div>
      <div className="space-y-4">
        {CONNECT_STAGES.map((label, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={label} className="flex items-center gap-3">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                done ? 'bg-[var(--success)]/10' : active ? 'bg-[#25D366]/10' : 'bg-[var(--surface-subtle)]'
              }`}>
                {done ? (
                  <SemanticIcon concept="check" className="!text-[11px] text-[var(--success)]" size="metadata" />
                ) : active ? (
                  <SemanticIcon concept="loader" className="animate-spin !text-[11px] text-[#25D366]" size="metadata" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)]" />
                )}
              </div>
              <span className={`text-[14px] transition-colors ${
                done
                  ? 'text-[var(--ink-secondary)]'
                  : active
                  ? 'font-medium text-[var(--ink)]'
                  : 'text-[var(--ink-tertiary)]'
              }`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </ModalBackdrop>
  );
}

function ModalBackdrop({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[420px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-xl">
        {children}
      </div>
    </div>
  );
}

// ─── Page content router ───────────────────────────────────────────────────────

function WhatsAppPageContent({
  canManage,
  connection,
  isConnecting,
  isRefreshing,
  onConnect,
  onReload,
  onRefresh,
  state,
}: Readonly<{
  canManage: boolean;
  connection: WhatsAppConnection | null;
  isConnecting: boolean;
  isRefreshing: boolean;
  onConnect: () => void;
  onReload: () => void;
  onRefresh: () => void;
  state: 'loading' | 'ready' | 'unavailable';
}>): React.JSX.Element {
  if (state === 'loading') {
    return (
      <div className="flex min-h-[480px] items-center justify-center p-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
            <img src="/green_icon.png" alt="" aria-hidden="true" className="z-10 h-10 w-10 object-contain" />
            <div aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#E1E8E4] border-t-[#003B2D]" />
          </div>
          <h2 className="text-[24px] font-bold tracking-tight text-[var(--ink)]">Loading WhatsApp</h2>
          <p className="mt-2 text-[15px] font-medium text-[var(--ink-secondary)]">Checking your connection.</p>
        </div>
      </div>
    );
  }

  if (state === 'unavailable') {
    return (
      <div className="flex min-h-[480px] items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
            <SemanticIcon concept="warning" className="text-[var(--warning)]" size="feature" />
          </div>
          <h2 className="mb-2 text-[18px] font-semibold text-[var(--ink)]">Connection unavailable</h2>
          <p className="mb-6 text-[14px] text-[var(--ink-secondary)]">We could not load the WhatsApp connection for this Business.</p>
          <button
            className="h-10 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] transition-colors"
            onClick={onReload}
            type="button"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (connection === null) {
    return <DisconnectedView canManage={canManage} onConnect={onConnect} />;
  }

  if (connection.connectionStatus === 'CONNECTED') {
    return <ConnectedView connection={connection} isRefreshing={isRefreshing} onRefresh={onRefresh} />;
  }

  if (connection.connectionStatus === 'PENDING' || connection.connectionStatus === 'VERIFYING') {
    return <FinalisingView onRefresh={onReload} />;
  }

  if (connection.connectionStatus === 'FAILED') {
    return (
      <div className="flex min-h-[480px] items-center justify-center p-8">
        <GenericStatusView
          heading="WhatsApp connection needs attention"
          body="SlotlyFlow could not verify this connection. No account information has been exposed."
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
        />
      </div>
    );
  }

  if (connection.connectionStatus === 'DISCONNECTED' || connection.connectionStatus === 'NEEDS_REAUTH') {
    return (
      <ReconnectView
        canManage={canManage}
        heading={connection.connectionStatus === 'NEEDS_REAUTH'
          ? 'WhatsApp needs to be reconnected'
          : 'WhatsApp is disconnected'}
        body={connection.connectionStatus === 'NEEDS_REAUTH'
          ? 'Reconnect your WhatsApp to continue using SlotlyFlow.'
          : 'Your WhatsApp connection is no longer active. Reconnect to continue using SlotlyFlow.'}
        isStarting={isConnecting}
        onReconnect={onConnect}
      />
    );
  }

  return (
    <div className="flex min-h-[480px] items-center justify-center p-8">
      <GenericStatusView
        heading="WhatsApp connection conflict"
        body="SlotlyFlow could not confirm that this WhatsApp number matches the connection saved for this Business. No connection ownership was changed."
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
      />
    </div>
  );
}

// ─── Disconnected state ────────────────────────────────────────────────────────

function DisconnectedView({
  canManage,
  onConnect,
}: Readonly<{ canManage: boolean; onConnect: () => void }>): React.JSX.Element {
  return (
    <div className="flex min-h-[520px] items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-[500px]">
        <section
          aria-label="Connect WhatsApp"
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-10 text-center shadow-sm"
        >
          {/* ── Connection graphic ── */}
          <div className="mb-8 flex items-center justify-center">
            {/* SlotlyFlow — brand-green container, white icon */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[#003B2D] shadow-sm">
              <img src="/white_icon.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
            </div>

            {/* Connector with disconnect indicator */}
            <div className="relative flex w-[88px] shrink-0 items-center" aria-hidden="true">
              <div className="h-0 w-full border-t-2 border-dashed border-[var(--border-strong)]" />
              <div className="absolute left-1/2 flex h-[26px] w-[26px] -translate-x-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] shadow-sm">
                <SemanticIcon concept="close" className="!text-[10px] text-[var(--danger)]" size="metadata" />
              </div>
            </div>

            {/* WhatsApp — greyscale/dimmed while disconnected */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] shadow-sm">
              <Image
                src={whatsappBusinessAppIcon}
                alt="WhatsApp Business"
                className="h-full w-full object-cover opacity-40 grayscale"
              />
            </div>
          </div>

          {/* ── Main copy ── */}
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--ink)]">
            Connect your WhatsApp
          </h2>
          <p className="mx-auto mt-2.5 max-w-[360px] text-[14px] leading-relaxed text-[var(--ink-secondary)]">
            Connect your Business WhatsApp number to start automating customer conversations with SlotlyFlow.
          </p>

          {/* ── Reassurance panel ── */}
          <div className="mt-6 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] px-4 py-3 text-left">
            <div className="relative mt-0.5 shrink-0">
              <Image
                src={whatsappBusinessAppIcon}
                alt=""
                aria-hidden="true"
                className="h-8 w-8 rounded-[6px] object-cover"
              />
              <span
                aria-hidden="true"
                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--success)] text-white"
              >
                <SemanticIcon concept="check" className="!text-[8px]" size="metadata" />
              </span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--ink)]">Existing WhatsApp Business App</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-secondary)]">
                Keep using your current WhatsApp Business app while SlotlyFlow handles your automation.
              </p>
            </div>
          </div>

          {/* ── Primary CTA ── */}
          <div className="mt-5">
            {canManage ? (
              <button
                className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-[var(--radius-md)] bg-[#25D366] px-6 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#20BD5A]"
                onClick={onConnect}
                type="button"
              >
                <SemanticIcon concept="whatsappConnection" className="!text-[18px] opacity-90" />
                <span>Connect WhatsApp Business</span>
                <Image
                  src={whatsappBusinessAppIcon}
                  alt=""
                  aria-hidden="true"
                  className="h-[22px] w-[22px] rounded-[4px] object-cover opacity-90"
                />
              </button>
            ) : (
              <p className="text-[13px] text-[var(--ink-secondary)]">
                A Business Owner or Admin must connect WhatsApp.
              </p>
            )}
          </div>

          {/* ── Supporting note ── */}
          <p className="mt-4 text-[12px] leading-relaxed text-[var(--ink-tertiary)]">
            You'll briefly continue with Meta to securely choose and authorise your WhatsApp Business number.
          </p>
        </section>
      </div>
    </div>
  );
}

// ─── Connected state ───────────────────────────────────────────────────────────

function ConnectedView({
  connection,
  isRefreshing,
  onRefresh,
}: Readonly<{ connection: WhatsAppConnection; isRefreshing: boolean; onRefresh: () => void }>): React.JSX.Element {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <style>{`
        @keyframes waConnectionFlow {
          to { stroke-dashoffset: -20; }
        }
      `}</style>
      <div className="mx-auto w-full max-w-[1100px]">

        {/* ── Page header ── */}
        <div className="mb-7">
          <h1 className="text-[26px] font-semibold tracking-tight text-[var(--ink)]">WhatsApp</h1>
          <p className="mt-1 text-[15px] text-[var(--ink-secondary)]">Connect and manage your Business WhatsApp number.</p>
        </div>

        {/* ── Top: 2:1 grid ── */}
        <div className="max-w-[720px]">

          {/* Active connection card */}
          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">

            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              {/* Connection graphic — matches ConnectWhatsAppCard */}
              <div className="inline-flex items-center gap-0">
                {/* SlotlyFlow — bare green icon, no container */}
                <img src="/green_icon.png" alt="" aria-hidden="true" className="h-14 w-14 shrink-0 object-contain" />

                {/* Animated dashed line — fixed compact width */}
                <div className="w-[110px] shrink-0 sm:w-[120px]" aria-hidden="true">
                  <svg
                    className="w-full text-[var(--ink-tertiary)]"
                    height="24"
                    viewBox="0 0 100 24"
                    fill="none"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <line
                      x1="0"
                      y1="12"
                      x2="100"
                      y2="12"
                      stroke="#25D366"
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      className="animate-[waConnectionFlow_1s_linear_infinite] motion-reduce:animate-none"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>

                {/* WhatsApp — rounded-square container matching ConnectWhatsAppCard */}
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-subtle)] shadow-sm">
                  <Image src={whatsappBusinessAppIcon} alt="WhatsApp Business" className="h-10 w-10 rounded-[10px] object-cover" />
                </div>
              </div>
              <button
                className="h-9 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[13px] font-medium text-[var(--ink)] shadow-sm transition-colors hover:bg-[var(--surface-subtle)]"
                type="button"
              >
                Get Help
              </button>
            </div>

            {/* Connected status badge */}
            <div className="mb-5 inline-flex self-start items-center gap-2 rounded-full bg-[var(--success)]/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--success)]">Connected</span>
            </div>

            {/* Connection data */}
            <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">Business number</p>
                <p className="text-[16px] font-semibold text-[var(--ink)]">{connection.displayPhoneNumber ?? '\u2014'}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">Connection type</p>
                <p className="text-[14px] font-medium text-[var(--ink)]">{connectionSourceLabel(connection.connectionSource)}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">Last checked</p>
                {connection.lastVerifiedAt === null ? (
                  <p className="text-[14px] font-medium text-[var(--ink-secondary)]">Not checked yet</p>
                ) : (
                  <time className="text-[14px] font-medium text-[var(--ink)]" dateTime={connection.lastVerifiedAt}>
                    {formatLastChecked(connection.lastVerifiedAt)}
                  </time>
                )}
              </div>
            </div>

            {/* Divider + footer */}
            <div className="mt-auto border-t border-[var(--border)] pt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-[var(--ink-secondary)]">
                {connection.verificationStatus === 'CHECK_FAILED'
                  ? 'The latest status check could not be completed. Your previous connection status is preserved.'
                  : 'Keep using your WhatsApp Business app normally.'}
              </p>
              <button
                className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRefreshing}
                onClick={onRefresh}
                type="button"
              >
                {isRefreshing && <SemanticIcon className="animate-spin" concept="loader" size="metadata" />}
                {isRefreshing ? 'Refreshing...' : 'Refresh status'}
              </button>
            </div>
          </div>

          {/* Health card */}
        </div>

        {/* ── Bottom: 1:1 grid ── */}
      </div>
    </div>
  );
}

// ─── Finalising (PENDING | VERIFYING backend state) ───────────────────────────

function connectionSourceLabel(source: WhatsAppConnection['connectionSource']): string {
  if (source === 'EXISTING_BUSINESS_APP') return 'WhatsApp Business App';
  if (source === 'EXISTING_PLATFORM') return 'WhatsApp Business Platform';
  return 'New WhatsApp number';
}

function formatLastChecked(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function FinalisingView({ onRefresh }: Readonly<{ onRefresh: () => void }>): React.JSX.Element {
  return (
    <div className="flex min-h-[480px] items-center justify-center p-8">
      <div className="w-full max-w-[440px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366]/10">
          <SemanticIcon concept="loader" className="animate-spin text-[#25D366]" size="feature" />
        </div>
        <h2 className="text-[20px] font-semibold tracking-tight text-[var(--ink)]">Finishing your WhatsApp connection</h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--ink-secondary)]">
          Your WhatsApp setup was completed with Meta. SlotlyFlow is finalising the connection.
        </p>
        <p className="mt-1.5 text-[12px] text-[var(--ink-tertiary)]">This usually takes just a moment.</p>
        <button
          className="mt-7 h-10 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] transition-colors"
          onClick={onRefresh}
          type="button"
        >
          Check status
        </button>
      </div>
    </div>
  );
}

// ─── Generic status view ───────────────────────────────────────────────────────

function GenericStatusView({
  heading,
  body,
  isRefreshing,
  onRefresh,
}: Readonly<{ heading: string; body: string; isRefreshing: boolean; onRefresh: () => void }>): React.JSX.Element {
  return (
    <div className="max-w-sm text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
        <SemanticIcon concept="warning" className="text-[var(--warning)]" size="feature" />
      </div>
      <h2 className="mb-2 text-[18px] font-semibold text-[var(--ink)]">{heading}</h2>
      <p className="mb-6 text-[14px] leading-relaxed text-[var(--ink-secondary)]">{body}</p>
      <button
        className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-[14px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isRefreshing}
        onClick={onRefresh}
        type="button"
      >
        {isRefreshing && <SemanticIcon className="animate-spin" concept="loader" size="metadata" />}
        {isRefreshing ? 'Refreshing...' : 'Refresh status'}
      </button>
    </div>
  );
}

function ReconnectView({
  body,
  canManage,
  heading,
  isStarting,
  onReconnect,
}: Readonly<{
  body: string;
  canManage: boolean;
  heading: string;
  isStarting: boolean;
  onReconnect: () => void;
}>): React.JSX.Element {
  return (
    <div className="flex min-h-[480px] items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-subtle)]">
          <SemanticIcon concept="warning" className="text-[var(--warning)]" size="feature" />
        </div>
        <h2 className="mb-2 text-[18px] font-semibold text-[var(--ink)]">{heading}</h2>
        <p className="mb-6 text-[14px] leading-relaxed text-[var(--ink-secondary)]">{body}</p>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[#25D366] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#20BD5A] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canManage || isStarting}
          onClick={onReconnect}
          type="button"
        >
          {isStarting && <SemanticIcon className="animate-spin" concept="loader" size="metadata" />}
          {isStarting ? 'Starting...' : 'Reconnect WhatsApp'}
        </button>
        {!canManage && (
          <p className="mt-3 text-[12px] text-[var(--ink-tertiary)]">An Owner or Admin must reconnect WhatsApp.</p>
        )}
      </div>
    </div>
  );
}
