'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

import { SemanticIcon } from '@/src/icons/semantic-icon';
import {
  getPlatformBusinessDetail,
  type PlatformBusinessDetail,
  type PlatformWhatsAppConnectionStatus,
  type PlatformWhatsAppConnectionVerificationStatus,
} from '@/src/platform-admin/businesses-client';

type DetailState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly detail: PlatformBusinessDetail }
  | { readonly status: 'not-found' }
  | { readonly status: 'unavailable' };

export default function AdminBusinessDetailPage() {
  const params = useParams<{ businessId: string }>();
  const organizationId = params.businessId;
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    if (typeof organizationId !== 'string' || organizationId === '') {
      setState({ status: 'not-found' });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });
    void getPlatformBusinessDetail(organizationId, fetch, undefined, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState(result.status === 'ready' ? { status: 'ready', detail: result.detail } : result);
      });
    return () => controller.abort();
  }, [organizationId]);

  if (state.status === 'loading') return <DetailNotice>Loading Business…</DetailNotice>;
  if (state.status === 'not-found') return <DetailNotice>Business not found.</DetailNotice>;
  if (state.status === 'unavailable') return <DetailNotice>Unable to load Business.</DetailNotice>;

  const { business, members, whatsappConnection } = state.detail;

  return (
    <div className="flex-1 overflow-y-auto font-['Spline_Sans'] bg-[#F7F9F8]">
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Back Button */}
        <div className="flex items-center gap-4 mb-8 relative">
          <Link href="/admin/businesses" aria-label="Back to Businesses" className="flex items-center text-[13px] font-semibold text-[#111816]/60 hover:text-[#111816] transition-colors group cursor-pointer w-fit">
            <SemanticIcon concept="back" className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
            Back to Businesses
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-2">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#003B2D] flex items-center justify-center text-white text-2xl font-bold shadow-sm shrink-0">
              {business.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-[28px] font-bold text-[#111816] tracking-tight mb-1">{business.name}</h1>
              <div className="flex items-center gap-3 text-sm text-[#111816]/60 font-medium">
                <span className="flex items-center gap-1.5"><SemanticIcon concept="organization" className="w-4 h-4" /> {business.slug}</span>
                <span>•</span>
                <span>{business.timezone}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#111816]/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <StatusValue label="Status"><BusinessStatus status={business.status} /></StatusValue>
            <Divider />
            <StatusValue label="Created"><span className="text-sm font-bold text-[#111816]">{formatDate(business.createdAt)}</span></StatusValue>
            <Divider />
            <StatusValue label="Organization ID"><span className="font-mono text-xs font-medium text-[#111816] break-all">{business.id}</span></StatusValue>
            <Divider />
            <StatusValue label="WhatsApp"><ConnectionStatus status={whatsappConnection?.status} /></StatusValue>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-[#111816]/10 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-[#111816]/5 flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#111816]">Users & Team</h2>
                <span className="text-sm font-medium text-[#111816]/50">{members.length} Total</span>
              </div>
              {members.length === 0 ? (
                <div className="p-6 text-sm text-[#111816]/60">No Business members found.</div>
              ) : (
                <div className="divide-y divide-[#111816]/5">
                  {members.map((member) => (
                    <div key={`${member.email}-${member.role}`} className="p-4 px-6 flex items-center justify-between hover:bg-[#F7F9F8] transition-colors">
                      <div>
                        <div className="font-medium text-[#111816] text-sm flex items-center gap-2">
                          {member.email}
                          <span className="bg-[#F7F9F8] border border-[#111816]/10 text-[#111816]/60 text-[10px] uppercase px-2 py-0.5 rounded-full font-bold">{member.role}</span>
                        </div>
                      </div>
                      <MemberStatus status={member.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-[#111816]/10 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-[#111816]/5 flex items-center gap-2">
                <SemanticIcon concept="conversations" className="w-5 h-5 text-[#003B2D]" />
                <h2 className="text-[15px] font-bold text-[#111816]">WhatsApp Connection</h2>
              </div>
              {whatsappConnection === undefined ? (
                <div className="p-5 text-sm text-[#111816]/60">No WhatsApp connection configured.</div>
              ) : (
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                  <DetailValue label="Display phone number" value={whatsappConnection.displayPhoneNumber ?? 'Not available'} />
                  <DetailValue label="Provider" value={whatsappConnection.provider} />
                  <DetailValue label="Connection status"><ConnectionStatus status={whatsappConnection.status} /></DetailValue>
                  <DetailValue label="Verification status"><VerificationStatus status={whatsappConnection.verificationStatus} /></DetailValue>
                  <DetailValue label="WhatsApp Connection ID" value={whatsappConnection.id} mono />
                  <DetailValue label="Meta Phone Number ID" value={whatsappConnection.externalPhoneNumberId ?? 'Not available'} mono />
                  <DetailValue label="WABA ID" value={whatsappConnection.externalWabaId ?? 'Not available'} mono />
                  <DetailValue label="Connection source" value={humanizeStatus(whatsappConnection.source)} />
                  <DetailValue label="Last verified" value={whatsappConnection.lastVerifiedAt === null ? 'Not yet verified' : formatDateTime(whatsappConnection.lastVerifiedAt)} />
                  <DetailValue label="Connection created" value={formatDateTime(whatsappConnection.createdAt)} />
                  <DetailValue label="Connection updated" value={formatDateTime(whatsappConnection.updatedAt)} />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#111816]/10 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#111816] mb-5">Business Details</h2>
              <div className="space-y-4">
                <DetailValue label="Organization ID" value={business.id} mono />
                <DetailValue label="Business email" value={business.businessEmail ?? 'Not available'} />
                <DetailValue label="Contact number" value={business.contactNumber ?? 'Not available'} />
                <DetailValue label="Website" value={business.website ?? 'Not available'} />
                <DetailValue label="Timezone" value={business.timezone} />
                <DetailValue label="Last updated" value={formatDateTime(business.updatedAt)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailNotice({ children }: { readonly children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto font-['Spline_Sans'] bg-[#F7F9F8] p-8"><div className="max-w-6xl mx-auto bg-white rounded-2xl border border-[#111816]/10 p-6 text-sm text-[#111816]/60 shadow-sm">{children}</div></div>;
}

function StatusValue({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return <div><div className="text-sm font-medium text-[#111816]/50 mb-1">{label}</div><div className="mt-1">{children}</div></div>;
}

function Divider() {
  return <div className="hidden md:block w-px h-10 bg-[#111816]/10" />;
}

function DetailValue({ label, value, children, mono = false }: { readonly label: string; readonly value?: string; readonly children?: React.ReactNode; readonly mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-[#111816]/50 mb-1 uppercase tracking-wide">{label}</div>
      {children ?? <div className={`${mono ? 'font-mono text-xs break-all' : 'text-sm'} font-medium text-[#111816]`}>{value}</div>}
    </div>
  );
}

function ConnectionStatus({ status }: { readonly status: PlatformWhatsAppConnectionStatus | undefined }) {
  if (status === undefined) return <span className="text-[12px] font-bold tracking-wide text-[#111816]/60">Not connected</span>;
  const healthy = status === 'CONNECTED';
  return <StatusBadge status={humanizeStatus(status)} healthy={healthy} />;
}

function VerificationStatus({ status }: { readonly status: PlatformWhatsAppConnectionVerificationStatus | null }) {
  if (status === null) return <span className="text-[12px] font-bold tracking-wide text-[#111816]/60">Not verified</span>;
  return <StatusBadge status={humanizeStatus(status)} healthy={status === 'VERIFIED'} />;
}

function BusinessStatus({ status }: { readonly status: PlatformBusinessDetail['business']['status'] }) {
  return <StatusBadge status={humanizeStatus(status)} healthy={status === 'ACTIVE'} />;
}

function MemberStatus({ status }: { readonly status: PlatformBusinessDetail['members'][number]['status'] }) {
  return <StatusBadge status={humanizeStatus(status)} healthy={status === 'active'} size="sm" />;
}

function StatusBadge({ status, healthy, size = 'md' }: { readonly status: string; readonly healthy: boolean; readonly size?: 'sm' | 'md' }) {
  return (
    <span className={`inline-flex items-center font-bold tracking-wide ${healthy ? 'text-green-700' : 'text-[#FF7A66]'} ${size === 'sm' ? 'text-[11px]' : 'text-[12px]'}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${healthy ? 'bg-green-500' : 'bg-[#FF7A66]'}`} />
      {status}
    </span>
  );
}

function humanizeStatus(status: string): string {
  return status.split('_').map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`).join(' ');
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
