'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Alert } from '@/components/feedback/Alert';
import { PortalMenu } from '@/components/feedback/PortalMenu';
import { SemanticIcon } from '@/src/icons/semantic-icon';
import {
  getPlatformBusinessDetail,
  listPlatformBusinesses,
  type PlatformBusinessDetail,
  type PlatformBusinessListItem,
} from '@/src/platform-admin/businesses-client';
import {
  activateBotDeployment,
  createBotDeployment,
  deactivateBotDeployment,
  listBotCatalogue,
  listBotDeployments,
  publishBotDeployment,
  unpublishBotDeployment,
  type PlatformBotCatalogueDefinition,
  type PlatformBotCatalogueVersion,
  type PlatformBotDeployment,
  type PlatformBotMutationResult,
} from '@/src/platform-admin/bots-client';

type TabType = 'deployments' | 'catalogue';
type LoadState = 'loading' | 'ready' | 'error';
type PublicationAction = 'publish' | 'unpublish';

const deploymentPageSize = 100;

export default function BotsAdminPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const deployAction = searchParams?.get('action') === 'deploy';
  const requestedBusinessId = searchParams?.get('businessId') ?? undefined;

  const [activeTab, setActiveTab] = useState<TabType>('deployments');
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(deployAction);
  const [prevDeployAction, setPrevDeployAction] = useState(deployAction);
  const [catalogue, setCatalogue] = useState<readonly PlatformBotCatalogueDefinition[]>([]);
  const [catalogueState, setCatalogueState] = useState<LoadState>('loading');
  const [businesses, setBusinesses] = useState<readonly PlatformBusinessListItem[]>([]);
  const [businessesState, setBusinessesState] = useState<LoadState>('loading');
  const [deployments, setDeployments] = useState<readonly PlatformBotDeployment[]>([]);
  const [deploymentsState, setDeploymentsState] = useState<LoadState>('loading');
  const [feedback, setFeedback] = useState<{ readonly kind: 'success' | 'error'; readonly message: string }>();
  const [lastCheckedBusinessId, setLastCheckedBusinessId] = useState<string>();
  const [mutatingDeploymentId, setMutatingDeploymentId] = useState<string>();
  const [publicationAction, setPublicationAction] = useState<{ readonly deployment: PlatformBotDeployment; readonly action: PublicationAction }>();

  if (deployAction !== prevDeployAction) {
    setPrevDeployAction(deployAction);
    setIsDeployModalOpen(deployAction);
  }

  if (deployAction && requestedBusinessId !== undefined && businessesState === 'ready' && lastCheckedBusinessId !== requestedBusinessId) {
    setLastCheckedBusinessId(requestedBusinessId);
    if (!businesses.some((business) => business.id === requestedBusinessId)) {
      setFeedback({ kind: 'error', message: 'The requested Business is unavailable.' });
    }
  }

  const refreshDeployments = useCallback(async () => {
    setDeploymentsState('loading');
    const result = await listBotDeployments({ page: 1, pageSize: deploymentPageSize });
    if (result.ok === false) {
      setDeployments([]);
      setDeploymentsState('error');
      return;
    }
    setDeployments(result.value.deployments);
    setDeploymentsState('ready');
  }, []);

  useEffect(() => {
    let active = true;
    void listBotDeployments({ page: 1, pageSize: deploymentPageSize }).then((result) => {
      if (!active) return;
      if (result.ok === false) {
        setDeployments([]);
        setDeploymentsState('error');
      } else {
        setDeployments(result.value.deployments);
        setDeploymentsState('ready');
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void listBotCatalogue(fetch, undefined, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok === false) {
        setCatalogue([]);
        setCatalogueState('error');
        return;
      }
      setCatalogue(result.value);
      setCatalogueState('ready');
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void listPlatformBusinesses({ page: 1, pageSize: 100, search: '' }, fetch, undefined, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result === undefined) {
        setBusinesses([]);
        setBusinessesState('error');
        return;
      }
      setBusinesses(result.businesses);
      setBusinessesState('ready');
    });
    return () => controller.abort();
  }, []);

  const closeDeployModal = () => {
    setIsDeployModalOpen(false);
    if (searchParams?.has('action')) router.replace('/admin/bots');
  };

  const handleMutationResult = (result: PlatformBotMutationResult, successMessage: string) => {
    if (result.ok === false) {
      setFeedback({ kind: 'error', message: mutationErrorMessage(result.issue) });
      return;
    }
    setFeedback({ kind: 'success', message: successMessage });
    void refreshDeployments();
  };

  const handleLifecycleMutation = async (deployment: PlatformBotDeployment, action: 'activate' | 'deactivate') => {
    setMutatingDeploymentId(deployment.id);
    const result = action === 'activate' ? await activateBotDeployment(deployment.id) : await deactivateBotDeployment(deployment.id);
    setMutatingDeploymentId(undefined);
    handleMutationResult(result, action === 'activate' ? 'Deployment activated.' : 'Deployment deactivated.');
  };

  const handlePublicationMutation = async () => {
    if (publicationAction === undefined) return;
    const { action, deployment } = publicationAction;
    setMutatingDeploymentId(deployment.id);
    const result = action === 'publish' ? await publishBotDeployment(deployment.id) : await unpublishBotDeployment(deployment.id);
    setMutatingDeploymentId(undefined);
    setPublicationAction(undefined);
    handleMutationResult(result, action === 'publish' ? 'Bot published.' : 'Bot unpublished.');
  };

  const activeCount = useMemo(() => deployments.filter((deployment) => deployment.status === 'ACTIVE').length, [deployments]);
  const liveCount = useMemo(() => deployments.filter((deployment) => deployment.publication.status === 'PUBLISHED').length, [deployments]);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-8 pt-6 pb-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div><h1 className="text-[28px] font-bold text-[#111816] tracking-tight mb-1">Bots</h1><p className="text-[15px] text-[#111816]/60">Manage trusted bots and their deployments across SlotlyFlow Businesses.</p></div>
          <button type="button" onClick={() => setIsDeployModalOpen(true)} className="h-10 px-5 bg-[#003B2D] text-white rounded-[6px] flex items-center justify-center gap-2 text-[13px] font-semibold hover:bg-[#002B21] transition-colors cursor-pointer shrink-0"><SemanticIcon concept="bot" className="w-4 h-4" size="navigation" />Deploy bot</button>
        </div>
        {feedback !== undefined && <Alert kind={feedback.kind}>{feedback.message}</Alert>}
        <div className="flex border-b border-[#111816]/10">
          <button type="button" onClick={() => setActiveTab('deployments')} className={`px-4 py-3 text-[14px] font-semibold border-b-2 transition-colors ${activeTab === 'deployments' ? 'border-[#003B2D] text-[#003B2D]' : 'border-transparent text-[#111816]/60 hover:text-[#111816]'}`}>Deployments</button>
          <button type="button" onClick={() => setActiveTab('catalogue')} className={`px-4 py-3 text-[14px] font-semibold border-b-2 transition-colors ${activeTab === 'catalogue' ? 'border-[#003B2D] text-[#003B2D]' : 'border-transparent text-[#111816]/60 hover:text-[#111816]'}`}>Bot Catalogue</button>
        </div>
        {activeTab === 'deployments' && <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#111816]/10 p-2 shadow-sm flex flex-wrap lg:flex-nowrap divide-y lg:divide-y-0 lg:divide-x divide-[#111816]/5">
            <Metric label="Total deployments" value={deployments.length} icon="bot" iconClassName="text-[#003B2D] bg-[#003B2D]/5" />
            <Metric label="Active" value={activeCount} icon="success" iconClassName="text-green-600 bg-green-50" />
            <Metric label="Live (Published)" value={liveCount} icon="checkDouble" iconClassName="text-[#003B2D] bg-[#003B2D]/10" />
            <Metric label="Not live" value={deployments.length - liveCount} icon="clock" iconClassName="text-[#111816]/40 bg-[#111816]/5" />
          </div>
          <DeploymentsTable deployments={deployments} state={deploymentsState} mutatingDeploymentId={mutatingDeploymentId} onDeploy={() => setIsDeployModalOpen(true)} onLifecycleMutation={handleLifecycleMutation} onPublicationAction={(deployment, action) => setPublicationAction({ deployment, action })} />
        </div>}
        {activeTab === 'catalogue' && <CatalogueTable definitions={catalogue} state={catalogueState} />}
      </div>
      {isDeployModalOpen && <DeployBotModal businesses={businesses} businessesState={businessesState} definitions={catalogue} catalogueState={catalogueState} initialBusinessId={requestedBusinessId} onClose={closeDeployModal} onCreated={() => { setFeedback({ kind: 'success', message: 'Bot deployment created. Activate and publish it separately when it is ready.' }); void refreshDeployments(); }} />}
      {publicationAction !== undefined && <PublicationConfirmationDialog action={publicationAction.action} pending={mutatingDeploymentId === publicationAction.deployment.id} onCancel={() => setPublicationAction(undefined)} onConfirm={() => { void handlePublicationMutation(); }} />}
    </main>
  );
}

function Metric({ label, value, icon, iconClassName }: { readonly label: string; readonly value: number; readonly icon: 'bot' | 'success' | 'checkDouble' | 'clock'; readonly iconClassName: string }) {
  return <div className="flex-1 p-4 flex items-center gap-4 min-w-[200px]"><div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconClassName}`}><SemanticIcon concept={icon} size="control" /></div><div><div className="text-[13px] font-medium text-[#111816]/60">{label}</div><div className="text-2xl font-bold text-[#111816]">{value}</div></div></div>;
}

function DeploymentsTable({ deployments, state, mutatingDeploymentId, onDeploy, onLifecycleMutation, onPublicationAction }: { readonly deployments: readonly PlatformBotDeployment[]; readonly state: LoadState; readonly mutatingDeploymentId: string | undefined; readonly onDeploy: () => void; readonly onLifecycleMutation: (deployment: PlatformBotDeployment, action: 'activate' | 'deactivate') => void; readonly onPublicationAction: (deployment: PlatformBotDeployment, action: PublicationAction) => void }) {
  return <div className="bg-white rounded-[12px] border border-[#111816]/10 shadow-sm"><div className="overflow-x-auto"><div className="max-h-[min(56vh,560px)] overflow-y-auto"><table className="w-full text-left border-collapse min-w-[1000px]"><thead className="sticky top-0 z-10"><tr className="border-b border-[#111816]/10 bg-[#F7F9F8]"><>{['Business', 'WhatsApp', 'Bot', 'Version', 'Deployment', 'Publication', 'Updated', 'Actions'].map((heading) => <th key={heading} className={`px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider ${heading === 'Actions' ? 'text-right' : ''}`}>{heading}</th>)}</></tr></thead><tbody className="divide-y divide-[#111816]/5">{state === 'loading' && <TableMessage>Loading deployments…</TableMessage>}{state === 'error' && <TableMessage>Unable to load deployments.</TableMessage>}{state === 'ready' && deployments.length === 0 && <EmptyDeployments onDeploy={onDeploy} />}{state === 'ready' && deployments.map((deployment) => <DeploymentRow key={deployment.id} deployment={deployment} mutating={mutatingDeploymentId === deployment.id} onLifecycleMutation={onLifecycleMutation} onPublicationAction={(action) => onPublicationAction(deployment, action)} />)}</tbody></table></div></div></div>;
}

function TableMessage({ children }: { readonly children: string }) { return <tr><td colSpan={8} className="px-5 py-12 text-center text-[#111816]/50 text-[14px]">{children}</td></tr>; }
function EmptyDeployments({ onDeploy }: { readonly onDeploy: () => void }) { return <tr><td colSpan={8} className="px-5 py-16 text-center"><div className="flex flex-col items-center justify-center"><div className="w-12 h-12 rounded-full bg-[#111816]/5 flex items-center justify-center text-[#111816]/40 mb-3"><SemanticIcon concept="bot" size="feature" /></div><h3 className="text-[15px] font-semibold text-[#111816] mb-1">No bots have been deployed yet.</h3><p className="text-[14px] text-[#111816]/60 mb-4 max-w-sm">Deploy a trusted bot to a Business WhatsApp connection to get started.</p><button type="button" onClick={onDeploy} className="h-9 px-4 bg-white border border-[#111816]/10 shadow-sm text-[#111816] rounded-[6px] text-[13px] font-semibold hover:bg-[#F7F9F8] transition-colors cursor-pointer">Deploy bot</button></div></td></tr>; }

function DeploymentRow({ deployment, mutating, onLifecycleMutation, onPublicationAction }: { readonly deployment: PlatformBotDeployment; readonly mutating: boolean; readonly onLifecycleMutation: (deployment: PlatformBotDeployment, action: 'activate' | 'deactivate') => void; readonly onPublicationAction: (action: PublicationAction) => void }) {
  const canPublish = deployment.status === 'ACTIVE' && deployment.publication.status === 'UNPUBLISHED';
  const canUnpublish = deployment.status === 'ACTIVE' && deployment.publication.status === 'PUBLISHED';
  const actionTriggerRef = useRef<HTMLButtonElement>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const closeMenuAndRun = (action: () => void) => {
    setIsActionMenuOpen(false);
    action();
  };

  return <tr className="hover:bg-[#F7F9F8] transition-colors group"><td className="px-5 py-4 align-top"><div className="font-semibold text-[#111816] text-[14px] leading-snug group-hover:text-[#003B2D] transition-colors"><Link href={`/admin/businesses/${encodeURIComponent(deployment.business.id)}`}>{deployment.business.name}</Link></div><div className="text-[12px] text-[#111816]/40 font-mono mt-0.5" title={deployment.business.id}>{deployment.business.id.split('-')[0]}...</div></td><td className="px-5 py-4 align-top"><div className="text-[14px] text-[#111816]/70">{deployment.whatsappConnection.displayPhoneNumber ?? 'No display number'}</div><div className="text-[11px] font-medium text-[#111816]/50 mt-0.5">{connectionLabel(deployment)}</div></td><td className="px-5 py-4 align-top"><div className="text-[14px] font-medium text-[#111816]">{deployment.bot.name}</div><div className="text-[11px] text-[#111816]/40 font-mono mt-0.5">{deployment.version.implementationKey}</div></td><td className="px-5 py-4 align-top"><div className="text-[13px] text-[#111816]/70 font-mono bg-[#111816]/5 px-1.5 py-0.5 rounded-[4px] inline-block">{deployment.version.version}</div></td><td className="px-5 py-4 align-top"><LifecycleStatus status={deployment.status} /></td><td className="px-5 py-4 align-top"><PublicationStatus status={deployment.publication.status} /></td><td className="px-5 py-4 align-top text-[13px] text-[#111816]/70">{formatDate(deployment.updatedAt)}</td><td className="px-5 py-4 align-top text-right"><button ref={actionTriggerRef} type="button" aria-label={`Actions for ${deployment.bot.name}`} aria-expanded={isActionMenuOpen} disabled={mutating} onClick={() => setIsActionMenuOpen((isOpen) => !isOpen)} className="w-8 h-8 rounded-[6px] inline-flex items-center justify-center text-[#111816]/50 hover:bg-[#111816]/5 hover:text-[#111816] transition-colors focus:outline-none cursor-pointer disabled:opacity-50"><SemanticIcon concept="menuHorizontal" size="control" /></button><PortalMenu isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} triggerRef={actionTriggerRef} placement="bottom-end" className="!w-48 !rounded-[8px] !p-1"><>{deployment.status === 'INACTIVE' ? <button type="button" disabled={mutating} onClick={() => closeMenuAndRun(() => onLifecycleMutation(deployment, 'activate'))} className="w-full text-left px-4 py-2 text-[13px] text-[#111816] hover:bg-[#F7F9F8] disabled:opacity-50 transition-colors cursor-pointer">Activate</button> : <button type="button" disabled={mutating} onClick={() => closeMenuAndRun(() => onLifecycleMutation(deployment, 'deactivate'))} className="w-full text-left px-4 py-2 text-[13px] text-[#111816] hover:bg-[#F7F9F8] disabled:opacity-50 transition-colors cursor-pointer">Deactivate</button>}{canPublish && <button type="button" disabled={mutating} onClick={() => closeMenuAndRun(() => onPublicationAction('publish'))} className="w-full text-left px-4 py-2 text-[13px] text-[#003B2D] font-medium hover:bg-[#F7F9F8] disabled:opacity-50 transition-colors cursor-pointer">Publish</button>}{canUnpublish && <button type="button" disabled={mutating} onClick={() => closeMenuAndRun(() => onPublicationAction('unpublish'))} className="w-full text-left px-4 py-2 text-[13px] text-[#111816] hover:bg-[#F7F9F8] disabled:opacity-50 transition-colors cursor-pointer">Unpublish</button>}</></PortalMenu></td></tr>;
}

function LifecycleStatus({ status }: { readonly status: PlatformBotDeployment['status'] }) { return <span className={`inline-flex items-center text-[11px] font-bold tracking-wide ${status === 'ACTIVE' ? 'text-green-700' : 'text-[#111816]/50'}`}><span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === 'ACTIVE' ? 'bg-green-500' : 'bg-[#111816]/30'}`} />{status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>; }
function PublicationStatus({ status }: { readonly status: PlatformBotDeployment['publication']['status'] }) { return <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border text-[11px] font-bold tracking-wide ${status === 'PUBLISHED' ? 'bg-[#003B2D]/5 text-[#003B2D] border-[#003B2D]/20' : 'bg-transparent text-[#111816]/50 border-[#111816]/10'}`}>{status === 'PUBLISHED' ? 'Published' : 'Not live'}</span>; }

function CatalogueTable({ definitions, state }: { readonly definitions: readonly PlatformBotCatalogueDefinition[]; readonly state: LoadState }) {
  return <div className="bg-white rounded-[12px] border border-[#111816]/10 shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-[#111816]/10 bg-[#F7F9F8]/50">{['Bot Name', 'Description', 'Available Versions', 'Latest Version', 'Status'].map((heading) => <th key={heading} className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[#111816]/5">{state === 'loading' && <tr><td colSpan={5} className="px-5 py-12 text-center text-[#111816]/50 text-[14px]">Loading trusted bots…</td></tr>}{state === 'error' && <tr><td colSpan={5} className="px-5 py-12 text-center text-[#111816]/50 text-[14px]">Unable to load the trusted bot catalogue.</td></tr>}{state === 'ready' && definitions.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-[#111816]/50 text-[14px]">No trusted bots are available yet.</td></tr>}{state === 'ready' && definitions.map((definition) => <CatalogueRow key={definition.id} definition={definition} />)}</tbody></table></div></div>;
}

function CatalogueRow({ definition }: { readonly definition: PlatformBotCatalogueDefinition }) {
  const availableVersions = definition.versions.filter((version) => version.status === 'PUBLISHED');
  const latestVersion = availableVersions[0];
  return <tr className="hover:bg-[#F7F9F8] transition-colors"><td className="px-5 py-4 align-top"><div className="font-semibold text-[#111816] text-[14px]">{definition.name}</div>{latestVersion !== undefined && <div className="text-[12px] text-[#111816]/40 font-mono mt-0.5">{latestVersion.implementationKey}</div>}</td><td className="px-5 py-4 align-top"><div className="text-[13px] text-[#111816]/70 max-w-md">{definition.description ?? '—'}</div></td><td className="px-5 py-4 align-top"><div className="flex gap-1 flex-wrap">{availableVersions.map((version) => <span key={version.id} className="text-[11px] font-mono bg-[#111816]/5 text-[#111816]/70 px-1.5 py-0.5 rounded-[4px]">{version.version}</span>)}{availableVersions.length === 0 && <span className="text-[13px] text-[#111816]/40">None</span>}</div></td><td className="px-5 py-4 align-top"><span className="text-[13px] font-medium text-[#111816]">{latestVersion?.version ?? '—'}</span></td><td className="px-5 py-4 align-top"><span className={`inline-flex items-center text-[11px] font-bold tracking-wide ${definition.status === 'ACTIVE' ? 'text-green-700' : 'text-[#111816]/50'}`}>{definition.status}</span></td></tr>;
}

function DeployBotModal({ businesses, businessesState, definitions, catalogueState, initialBusinessId, onClose, onCreated }: { readonly businesses: readonly PlatformBusinessListItem[]; readonly businessesState: LoadState; readonly definitions: readonly PlatformBotCatalogueDefinition[]; readonly catalogueState: LoadState; readonly initialBusinessId: string | undefined; readonly onClose: () => void; readonly onCreated: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [businessId, setBusinessId] = useState(() => {
    if (businessesState === 'ready' && initialBusinessId !== undefined && businesses.some((b) => b.id === initialBusinessId)) {
      return initialBusinessId;
    }
    return '';
  });
  const [prevBusinessesState, setPrevBusinessesState] = useState(businessesState);
  
  const [businessDetail, setBusinessDetail] = useState<PlatformBusinessDetail>();
  const [detailState, setDetailState] = useState<LoadState | 'idle'>('idle');
  const [loadedBusinessId, setLoadedBusinessId] = useState('');
  
  const [botId, setBotId] = useState('');
  const [botVersionId, setBotVersionId] = useState('');
  const [submissionError, setSubmissionError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (businessesState !== prevBusinessesState) {
    setPrevBusinessesState(businessesState);
    if (businessesState === 'ready' && initialBusinessId !== undefined && businessId === '' && businesses.some((business) => business.id === initialBusinessId)) {
      setBusinessId(initialBusinessId);
    }
  }

  if (businessId !== loadedBusinessId) {
    setLoadedBusinessId(businessId);
    setBusinessDetail(undefined);
    setDetailState(businessId === '' ? 'idle' : 'loading');
  }

  useEffect(() => {
    if (businessId === '') return;
    const controller = new AbortController();
    void getPlatformBusinessDetail(businessId, fetch, undefined, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status !== 'ready') { setDetailState('error'); return; }
      setBusinessDetail(result.detail);
      setDetailState('ready');
    });
    return () => controller.abort();
  }, [businessId]);


  const selectedBusiness = businesses.find((business) => business.id === businessId);
  const connection = businessDetail?.whatsappConnection;
  const connectionEligible = connection !== undefined && connection.status === 'CONNECTED' && connection.verificationStatus === 'VERIFIED';
  const deployableDefinitions = definitions.filter((definition) => definition.status === 'ACTIVE' && definition.versions.some((version) => version.status === 'PUBLISHED'));
  const selectedBot = deployableDefinitions.find((definition) => definition.id === botId);
  const versions = selectedBot?.versions.filter((version) => version.status === 'PUBLISHED') ?? [];
  const selectedVersion = versions.find((version) => version.id === botVersionId);
  const canReview = selectedBusiness !== undefined && connectionEligible && selectedBot !== undefined && selectedVersion !== undefined;

  const deploy = async () => {
    if (!canReview || connection === undefined || selectedVersion === undefined) return;
    setIsSubmitting(true);
    setSubmissionError(undefined);
    const result = await createBotDeployment({ organizationId: businessId, whatsappConnectionId: connection.id, botVersionId: selectedVersion.id });
    setIsSubmitting(false);
    if (result.ok === false) { setSubmissionError(mutationErrorMessage(result.issue)); return; }
    onCreated();
    onClose();
  };

  return <><div className="fixed inset-0 bg-[#111816]/20 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} /><div role="dialog" aria-modal="true" aria-labelledby="deploy-bot-title" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[500px] bg-white rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[90vh]"><div className="px-6 py-4 border-b border-[#111816]/10 flex items-center justify-between bg-white shrink-0"><h2 id="deploy-bot-title" className="text-[18px] font-bold text-[#111816]">Deploy trusted bot</h2><button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#111816]/40 hover:text-[#111816] hover:bg-[#F7F9F8] transition-colors cursor-pointer focus:outline-none"><SemanticIcon concept="close" size="control" /></button></div><div className="p-6 overflow-y-auto flex-1">{submissionError !== undefined && <Alert kind="error" className="mb-5">{submissionError}</Alert>}{step === 1 ? <div className="space-y-5"><div><label className="block text-[13px] font-semibold text-[#111816] mb-1.5" htmlFor="bot-business">Business</label><select id="bot-business" className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] cursor-pointer disabled:opacity-50" value={businessId} onChange={(event) => { setBusinessId(event.target.value); setBotId(''); setBotVersionId(''); setSubmissionError(undefined); }} disabled={businessesState !== 'ready'}><option value="" disabled>{businessesState === 'loading' ? 'Loading Businesses…' : 'Select a Business'}</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select>{businessesState === 'error' && <p className="mt-1.5 text-[12px] text-[#B44735]">Unable to load Businesses.</p>}</div><div><label className="block text-[13px] font-semibold text-[#111816] mb-1.5" htmlFor="bot-whatsapp">WhatsApp connection</label><select id="bot-whatsapp" className="w-full h-10 px-3 bg-[#F7F9F8] border border-[#111816]/10 rounded-[6px] text-[14px] text-[#111816]/50 focus:outline-none cursor-not-allowed" value={connectionEligible ? connection?.id ?? '' : ''} disabled><option value="" disabled>{businessId === '' ? 'Select a Business first' : detailState === 'loading' ? 'Loading connection…' : 'No eligible connection'}</option>{connectionEligible && connection !== undefined && <option value={connection.id}>{connection.displayPhoneNumber ?? 'Connected WhatsApp'} · {connection.status} · {connection.verificationStatus}</option>}</select>{businessId !== '' && detailState === 'ready' && !connectionEligible && <p className="mt-1.5 text-[12px] text-[#111816]/50">{connection === undefined ? 'This Business does not have an eligible WhatsApp connection.' : `WhatsApp is ${connection.status}${connection.verificationStatus === null ? '' : ` · ${connection.verificationStatus}`}.`}</p>}{detailState === 'error' && <p className="mt-1.5 text-[12px] text-[#B44735]">Unable to load this Business’s WhatsApp connection.</p>}</div><div className="pt-4 border-t border-[#111816]/5"><label className="block text-[13px] font-semibold text-[#111816] mb-1.5" htmlFor="bot-definition">Bot</label><select id="bot-definition" className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] cursor-pointer disabled:bg-[#F7F9F8] disabled:text-[#111816]/50 disabled:cursor-not-allowed" value={botId} onChange={(event) => { setBotId(event.target.value); setBotVersionId(''); }} disabled={!connectionEligible || catalogueState !== 'ready'}><option value="" disabled>{catalogueState === 'loading' ? 'Loading trusted bots…' : 'Select a trusted bot'}</option>{deployableDefinitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select>{catalogueState === 'error' && <p className="mt-1.5 text-[12px] text-[#B44735]">Unable to load trusted bots.</p>}</div><div><label className="block text-[13px] font-semibold text-[#111816] mb-1.5" htmlFor="bot-version">Version</label><select id="bot-version" className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] cursor-pointer disabled:bg-[#F7F9F8] disabled:text-[#111816]/50 disabled:cursor-not-allowed" value={botVersionId} onChange={(event) => setBotVersionId(event.target.value)} disabled={selectedBot === undefined}><option value="" disabled>Select a version</option>{versions.map((version) => <option key={version.id} value={version.id}>{version.version}</option>)}</select></div></div> : <Review selectedBusiness={selectedBusiness} connection={connection} selectedBot={selectedBot} selectedVersion={selectedVersion} />}</div><div className="px-6 py-4 border-t border-[#111816]/10 bg-[#F7F9F8]/50 flex justify-end gap-3 shrink-0">{step === 1 ? <><button type="button" onClick={onClose} className="h-10 px-4 bg-white border border-[#111816]/20 rounded-[6px] text-[13px] font-semibold text-[#111816] hover:bg-[#F7F9F8] transition-colors cursor-pointer">Cancel</button><button type="button" onClick={() => setStep(2)} disabled={!canReview} className="h-10 px-5 bg-[#003B2D] text-white rounded-[6px] text-[13px] font-semibold hover:bg-[#002B21] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Continue to review</button></> : <><button type="button" onClick={() => setStep(1)} disabled={isSubmitting} className="h-10 px-4 bg-white border border-[#111816]/20 rounded-[6px] text-[13px] font-semibold text-[#111816] hover:bg-[#F7F9F8] transition-colors cursor-pointer disabled:opacity-50">Back</button><button type="button" onClick={() => { void deploy(); }} disabled={isSubmitting} className="h-10 px-5 bg-[#003B2D] text-white rounded-[6px] text-[13px] font-semibold hover:bg-[#002B21] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Deploying…' : 'Deploy bot'}</button></>}</div></div></>;
}

function Review({ selectedBusiness, connection, selectedBot, selectedVersion }: { readonly selectedBusiness: PlatformBusinessListItem | undefined; readonly connection: PlatformBusinessDetail['whatsappConnection'] | undefined; readonly selectedBot: PlatformBotCatalogueDefinition | undefined; readonly selectedVersion: PlatformBotCatalogueVersion | undefined }) { return <div className="space-y-6"><div className="bg-[#F7F9F8] rounded-[8px] border border-[#111816]/5 p-4 space-y-3"><ReviewRow label="Business" value={selectedBusiness?.name ?? '—'} /><ReviewRow label="WhatsApp number" value={connection?.displayPhoneNumber ?? 'Connected WhatsApp'} /><ReviewRow label="Bot" value={selectedBot?.name ?? '—'} /><ReviewRow label="Version" value={selectedVersion?.version ?? '—'} mono /></div><div className="bg-[#003B2D]/5 border border-[#003B2D]/10 rounded-[8px] p-4 flex items-start gap-3"><div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5 text-[#003B2D]"><SemanticIcon concept="alert" size="metadata" className="w-3 h-3" /></div><div><h4 className="text-[13px] font-semibold text-[#111816] mb-1">Initial deployment: Inactive</h4><p className="text-[12px] text-[#111816]/70 leading-relaxed">Initial publication: Not live. The deployment can be activated after creation. Publishing it live is a separate action.</p></div></div></div>; }
function ReviewRow({ label, value, mono = false }: { readonly label: string; readonly value: string; readonly mono?: boolean }) { return <div className="flex justify-between items-start gap-6"><span className="text-[13px] text-[#111816]/60">{label}</span><span className={`text-right ${mono ? 'text-[13px] font-mono bg-white px-1.5 py-0.5 rounded-[4px] border border-[#111816]/10' : 'text-[14px] font-medium text-[#111816]'}`}>{value}</span></div>; }

function PublicationConfirmationDialog({ action, pending, onCancel, onConfirm }: { readonly action: PublicationAction; readonly pending: boolean; readonly onCancel: () => void; readonly onConfirm: () => void }) {
  const isPublish = action === 'publish';
  return <><div className="fixed inset-0 bg-[#111816]/20 backdrop-blur-sm z-[60]" onClick={pending ? undefined : onCancel} /><div role="dialog" aria-modal="true" aria-labelledby="publication-title" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] bg-white rounded-2xl shadow-xl z-[70] overflow-hidden"><div className="p-6"><h2 id="publication-title" className="text-[18px] font-bold text-[#111816]">{isPublish ? 'Publish bot?' : 'Unpublish bot?'}</h2><p className="mt-2 text-[14px] leading-relaxed text-[#111816]/70">{isPublish ? 'Once published, this bot can respond to inbound WhatsApp messages for this Business.' : 'Live bot responses will stop for this Business. The deployment will remain available for management and preview.'}</p></div><div className="px-6 py-4 border-t border-[#111816]/10 bg-[#F7F9F8]/50 flex justify-end gap-3"><button type="button" disabled={pending} onClick={onCancel} className="h-10 px-4 bg-white border border-[#111816]/20 rounded-[6px] text-[13px] font-semibold text-[#111816] hover:bg-[#F7F9F8] disabled:opacity-50">Cancel</button><button type="button" disabled={pending} onClick={onConfirm} className="h-10 px-5 bg-[#003B2D] text-white rounded-[6px] text-[13px] font-semibold hover:bg-[#002B21] disabled:opacity-50">{pending ? 'Saving…' : isPublish ? 'Publish bot' : 'Unpublish bot'}</button></div></div></>;
}

function connectionLabel(deployment: PlatformBotDeployment): string { const verification = deployment.whatsappConnection.verificationStatus; return verification === null ? deployment.whatsappConnection.status : `${deployment.whatsappConnection.status} · ${verification}`; }
function formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)); }
function mutationErrorMessage(issue: Exclude<PlatformBotMutationResult, { readonly ok: true }>['issue']): string { if (issue === 'INVALID') return 'The requested bot deployment details are invalid.'; if (issue === 'NOT_FOUND') return 'The requested deployment is no longer available.'; if (issue === 'CONFLICT') return 'This deployment cannot make that transition right now.'; if (issue === 'FORBIDDEN') return 'Your platform role does not allow this action.'; return 'The bot administration service is temporarily unavailable. Please try again.'; }
