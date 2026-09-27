'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { SemanticIcon } from '@/src/icons/semantic-icon';
import {
  listPlatformBusinesses,
  type PlatformBusinessListItem,
  type PlatformBusinessesPage,
  type PlatformWhatsAppConnectionStatus,
} from '@/src/platform-admin/businesses-client';

const pageSize = 25;

export default function BusinessesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PlatformBusinessesPage>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    void listPlatformBusinesses({ page, pageSize, search: searchQuery }, fetch, undefined, controller.signal)
      .then((nextResult) => {
        if (controller.signal.aborted) return;
        if (nextResult === undefined) {
          setResult(undefined);
          setState('error');
          return;
        }
        setResult(nextResult);
        setState('ready');
      });
    return () => controller.abort();
  }, [page, searchQuery]);

  const totalPages = result === undefined ? 1 : Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-[28px] font-bold text-[#111816] tracking-tight mb-1">Businesses</h1>
            <p className="text-[15px] text-[#111816]/60">Manage client businesses, operational health, and platform connections.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-[320px]">
            <SemanticIcon concept="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111816]/40" />
            <input
              type="search"
              placeholder="Search Businesses"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              className="w-full h-[40px] pl-10 pr-4 bg-white border border-[#111816]/10 rounded-[6px] text-[14px] text-[#111816] placeholder-[#111816]/40 focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-colors"
            />
          </div>
          {result !== undefined && state === 'ready' && (
            <p className="text-[13px] text-[#111816]/60">{result.total} {result.total === 1 ? 'Business' : 'Businesses'}</p>
          )}
        </div>

        <div className="bg-white rounded-[12px] border border-[#111816]/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#111816]/10 bg-[#F7F9F8]/50">
                  <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider">Business</th>
                  <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider">WhatsApp</th>
                  <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider">Connection status</th>
                  <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider">Business status</th>
                  <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider hidden lg:table-cell">Created</th>
                  <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111816]/5">
                {state === 'loading' && <TableMessage colSpan={6}>Loading Businesses…</TableMessage>}
                {state === 'error' && <TableMessage colSpan={6}>Unable to load Businesses.</TableMessage>}
                {state === 'ready' && result !== undefined && result.businesses.length === 0 && (
                  <TableMessage colSpan={6}>No Businesses found.</TableMessage>
                )}
                {state === 'ready' && result?.businesses.map((business) => <BusinessRow key={business.id} business={business} />)}
              </tbody>
            </table>
          </div>
          {state === 'ready' && result !== undefined && result.total > result.pageSize && (
            <div className="flex items-center justify-between gap-4 border-t border-[#111816]/10 px-5 py-3.5">
              <p className="text-[13px] text-[#111816]/60">Page {result.page} of {totalPages}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={result.page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="h-8 px-3 rounded-[6px] text-[13px] font-semibold border border-[#111816]/10 text-[#111816]/70 hover:bg-[#F7F9F8] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={result.page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="h-8 px-3 rounded-[6px] text-[13px] font-semibold border border-[#111816]/10 text-[#111816]/70 hover:bg-[#F7F9F8] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function BusinessRow({ business }: { readonly business: PlatformBusinessListItem }) {
  const connection = business.whatsappConnection;
  return (
    <tr className="hover:bg-[#F7F9F8] transition-colors group">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#003B2D]/5 flex items-center justify-center shrink-0">
            <SemanticIcon concept="organization" className="w-4 h-4 text-[#003B2D]" />
          </div>
          <div>
            <div className="font-semibold text-[#111816] text-[14px] leading-snug group-hover:text-[#003B2D] transition-colors">{business.name}</div>
            <div className="text-[13px] text-[#111816]/50">{business.slug}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-[14px] text-[#111816]/70">{connection?.displayPhoneNumber ?? 'Not connected'}</td>
      <td className="px-5 py-4"><ConnectionStatus status={connection?.status} /></td>
      <td className="px-5 py-4"><BusinessStatus status={business.status} /></td>
      <td className="px-5 py-4 hidden lg:table-cell text-[14px] text-[#111816]/70">{formatDate(business.createdAt)}</td>
      <td className="px-5 py-4 text-right">
        <Link href={`/admin/businesses/${encodeURIComponent(business.id)}`} className="text-[13px] font-semibold text-[#003B2D] hover:underline cursor-pointer">
          View
        </Link>
      </td>
    </tr>
  );
}

function TableMessage({ children, colSpan }: { readonly children: ReactNode; readonly colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-5 py-12 text-center text-[#111816]/50 text-[14px]">{children}</td></tr>;
}

function ConnectionStatus({ status }: { readonly status: PlatformWhatsAppConnectionStatus | undefined }) {
  if (status === undefined) return <span className="text-[13px] font-medium text-[#111816]/50">Not connected</span>;
  const connected = status === 'CONNECTED';
  return (
    <span className={`inline-flex items-center text-[11px] font-bold tracking-wide ${connected ? 'text-green-700' : 'text-[#FF7A66]'}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${connected ? 'bg-green-500' : 'bg-[#FF7A66]'}`} />
      {humanizeStatus(status)}
    </span>
  );
}

function BusinessStatus({ status }: { readonly status: PlatformBusinessListItem['status'] }) {
  const active = status === 'ACTIVE';
  return (
    <span className={`inline-flex items-center text-[11px] font-bold tracking-wide ${active ? 'text-green-700' : 'text-[#FF7A66]'}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${active ? 'bg-green-500' : 'bg-[#FF7A66]'}`} />
      {humanizeStatus(status)}
    </span>
  );
}

function humanizeStatus(status: string): string {
  return status.split('_').map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`).join(' ');
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
