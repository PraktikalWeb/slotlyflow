"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SemanticIcon } from '@/src/icons/semantic-icon';

const SUMMARY_DATA = {
  connected: 142,
  pending: 12,
  failed: 3,
  disconnected: 5,
  issues: 4
};

const GLOBAL_ISSUE = {
  active: true,
  title: "Meta status callbacks are delayed across multiple Businesses.",
  affected: 12,
  detected: "14:20",
  status: "Investigating"
};

const NEEDS_ATTENTION = [
  {
    id: 'iss_1',
    business: 'Wansati Brands',
    businessId: 'biz_1',
    number: '+27 82 000 0000',
    issue: 'Connection failed',
    desc: 'Delivery callbacks delayed by 5+ minutes.',
    severity: 'critical',
    lastOccurred: '2 hours ago',
    action: 'View Connection'
  },
  {
    id: 'iss_2',
    business: 'Urban Style Boutique',
    businessId: 'biz_2',
    number: '+27 71 123 4567',
    issue: 'Repeated outbound failures',
    desc: '5 failed sends in the last hour.',
    severity: 'attention',
    lastOccurred: '15 mins ago',
    action: 'View Issue'
  },
  {
    id: 'iss_3',
    business: 'Fresh Foods Market',
    businessId: 'biz_3',
    number: '+27 83 987 6543',
    issue: 'Onboarding incomplete',
    desc: 'Connection remains in VERIFYING state.',
    severity: 'attention',
    lastOccurred: '1 day ago',
    action: 'View Setup'
  }
];

const CONNECTIONS = [
  {
    id: 'biz_1',
    business: 'Wansati Brands',
    number: '+27 82 000 0000',
    source: 'Existing WhatsApp Business App',
    status: 'CONNECTED',
    health: 'HEALTHY',
    lastInbound: '3 min ago',
    lastOutbound: '2 min ago',
    lastCallback: '2 min ago'
  },
  {
    id: 'biz_2',
    business: 'Urban Style Boutique',
    number: '+27 71 123 4567',
    source: 'Existing WhatsApp Business App',
    status: 'CONNECTED',
    health: 'ATTENTION',
    lastInbound: '10 min ago',
    lastOutbound: '2 min ago',
    lastCallback: '15 min ago'
  },
  {
    id: 'biz_3',
    business: 'Fresh Foods Market',
    number: '+27 83 987 6543',
    source: 'New Number',
    status: 'VERIFYING',
    health: 'INACTIVE',
    lastInbound: '-',
    lastOutbound: '-',
    lastCallback: '-'
  },
  {
    id: 'biz_4',
    business: 'Tech Gear Pro',
    number: '+27 60 555 1234',
    source: 'Existing WhatsApp Business App',
    status: 'FAILED',
    health: 'CRITICAL',
    lastInbound: '2 days ago',
    lastOutbound: '2 days ago',
    lastCallback: '2 days ago'
  },
  {
    id: 'biz_5',
    business: 'Home Decor Co',
    number: '+27 82 444 9999',
    source: 'Existing Platform',
    status: 'DISCONNECTED',
    health: 'INACTIVE',
    lastInbound: '1 week ago',
    lastOutbound: '1 week ago',
    lastCallback: '1 week ago'
  },
  {
    id: 'biz_6',
    business: 'Coffee Roasters',
    number: '+27 73 222 1111',
    source: 'Existing WhatsApp Business App',
    status: 'PENDING',
    health: 'INACTIVE',
    lastInbound: '-',
    lastOutbound: '-',
    lastCallback: '-'
  },
  {
    id: 'biz_7',
    business: 'Beauty Supply Plus',
    number: '+27 81 777 3333',
    source: 'Existing WhatsApp Business App',
    status: 'CONNECTED',
    health: 'HEALTHY',
    lastInbound: '1 min ago',
    lastOutbound: '1 min ago',
    lastCallback: '1 min ago'
  }
];

export default function AdminWhatsAppPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center font-bold tracking-wide text-green-700 text-[12px]">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></div>
            CONNECTED
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center font-bold tracking-wide text-[#111816]/60 text-[12px]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#111816]/30 mr-1.5"></div>
            PENDING
          </span>
        );
      case 'VERIFYING':
        return (
          <span className="inline-flex items-center font-bold tracking-wide text-[#B27B16] text-[12px]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#F5B02E] mr-1.5 animate-pulse"></div>
            VERIFYING
          </span>
        );
      case 'FAILED':
      case 'DISCONNECTED':
        return (
          <span className="inline-flex items-center font-bold tracking-wide text-[#FF7A66] text-[12px]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF7A66] mr-1.5"></div>
            {status}
          </span>
        );
      default:
        return <span className="text-[12px] font-bold">{status}</span>;
    }
  };

  const getHealthBadge = (health: string) => {
    switch(health) {
      case 'HEALTHY':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-green-500/10 text-green-700 text-[11px] font-bold border border-green-500/20">HEALTHY</span>;
      case 'ATTENTION':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#F5B02E]/10 text-[#B27B16] text-[11px] font-bold border border-[#F5B02E]/30">ATTENTION</span>;
      case 'CRITICAL':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#FF7A66]/10 text-[#FF7A66] text-[11px] font-bold border border-[#FF7A66]/30">CRITICAL</span>;
      case 'INACTIVE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#111816]/5 text-[#111816]/60 text-[11px] font-bold border border-[#111816]/10">INACTIVE</span>;
      default:
        return null;
    }
  };

  const filteredConnections = CONNECTIONS.filter(conn => {
    const matchesSearch = conn.business.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          conn.number.includes(searchQuery);
    const matchesStatus = statusFilter === 'All' || conn.status === statusFilter.toUpperCase();
    const matchesSource = sourceFilter === 'All' || conn.source === sourceFilter;
    
    return matchesSearch && matchesStatus && matchesSource;
  });

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold text-[#111816] tracking-tight">WhatsApp</h1>
        <p className="text-[#111816]/60 text-[15px]">Monitor WhatsApp connections and messaging health across SlotlyFlow.</p>
      </div>

      {/* Global Issue Banner */}
      {GLOBAL_ISSUE.active && (
        <div className="bg-[#FF7A66]/10 border border-[#FF7A66]/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#FF7A66]/20 flex items-center justify-center shrink-0 mt-0.5">
              <SemanticIcon concept="warning" className="text-[#FF7A66]" />
            </div>
            <div>
              <h3 className="font-bold text-[#111816] text-[15px] mb-1">Platform Notice: {GLOBAL_ISSUE.title}</h3>
              <div className="flex items-center gap-4 text-[13px] text-[#111816]/70">
                <span>Affected Businesses: <strong className="text-[#111816]">{GLOBAL_ISSUE.affected}</strong></span>
                <span>•</span>
                <span>First detected: {GLOBAL_ISSUE.detected}</span>
                <span>•</span>
                <span>Status: <strong className="text-[#111816]">{GLOBAL_ISSUE.status}</strong></span>
              </div>
            </div>
          </div>
          <button className="shrink-0 px-4 py-2 bg-white border border-[#111816]/10 rounded-xl text-sm font-medium text-[#111816] hover:bg-[#F7F9F8] transition-colors shadow-sm">
            View Operations
          </button>
        </div>
      )}

      {/* Restrained Summary Strip */}
      <div className="bg-white rounded-2xl border border-[#111816]/10 p-2 shadow-sm flex flex-wrap lg:flex-nowrap divide-y lg:divide-y-0 lg:divide-x divide-[#111816]/5">
        <div className="flex-1 p-4 flex items-center gap-4 min-w-[200px]">
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
            <SemanticIcon concept="success" className="text-green-600" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#111816]/60">Connected</div>
            <div className="text-2xl font-bold text-[#111816]">{SUMMARY_DATA.connected}</div>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center gap-4 min-w-[200px]">
          <div className="w-10 h-10 rounded-full bg-[#111816]/5 flex items-center justify-center">
            <SemanticIcon concept="clock" className="text-[#111816]/60" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#111816]/60">Pending / Verifying</div>
            <div className="text-2xl font-bold text-[#111816]">{SUMMARY_DATA.pending}</div>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center gap-4 min-w-[200px]">
          <div className="w-10 h-10 rounded-full bg-[#FF7A66]/10 flex items-center justify-center">
            <SemanticIcon concept="alert" className="text-[#FF7A66]" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#111816]/60">Failed</div>
            <div className="text-2xl font-bold text-[#FF7A66]">{SUMMARY_DATA.failed}</div>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center gap-4 min-w-[200px]">
          <div className="w-10 h-10 rounded-full bg-[#111816]/5 flex items-center justify-center">
            <SemanticIcon concept="error" className="text-[#111816]/40" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#111816]/60">Disconnected</div>
            <div className="text-2xl font-bold text-[#111816]">{SUMMARY_DATA.disconnected}</div>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center gap-4 min-w-[200px] bg-[#FF7A66]/5 rounded-r-xl">
          <div className="w-10 h-10 rounded-full bg-[#FF7A66]/20 flex items-center justify-center">
            <SemanticIcon concept="warning" className="text-[#FF7A66]" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#111816]/60">Attention Required</div>
            <div className="text-2xl font-bold text-[#FF7A66]">{SUMMARY_DATA.issues}</div>
          </div>
        </div>
      </div>

      {/* Needs Attention */}
      {NEEDS_ATTENTION.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#111816] mb-4">Needs Attention</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {NEEDS_ATTENTION.map(issue => (
              <div key={issue.id} className="bg-white border border-[#111816]/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-[14px] font-bold text-[#111816]">{issue.business}</div>
                    <div className="text-[12px] font-mono text-[#111816]/60">{issue.number}</div>
                  </div>
                  {issue.severity === 'critical' ? (
                    <span className="px-2 py-0.5 rounded-[4px] bg-[#FF7A66]/10 text-[#FF7A66] text-[10px] font-bold uppercase tracking-wider">Critical</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-[4px] bg-[#F5B02E]/10 text-[#B27B16] text-[10px] font-bold uppercase tracking-wider">Attention</span>
                  )}
                </div>
                <div className="mb-4 flex-1">
                  <div className="text-[14px] font-semibold text-[#111816] mb-1">{issue.issue}</div>
                  <div className="text-[13px] text-[#111816]/70 leading-relaxed">{issue.desc}</div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-[#111816]/5 mt-auto">
                  <span className="text-[12px] text-[#111816]/50 font-medium flex items-center gap-1.5">
                    <SemanticIcon concept="clock" className="mr-1" size="metadata" /> {issue.lastOccurred}
                  </span>
                  <button 
                    onClick={() => router.push(`/admin/businesses/${issue.businessId}/whatsapp`)}
                    className="text-[13px] font-semibold text-[#003B2D] hover:underline flex items-center gap-1"
                  >
                    {issue.action} <SemanticIcon concept="arrowUpRight" size="metadata" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {NEEDS_ATTENTION.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center justify-center">
          <div className="flex items-center gap-3 text-green-700">
            <SemanticIcon concept="success" className="w-6 h-6" />
            <span className="font-medium text-[15px]">All WhatsApp connections are operating normally.</span>
          </div>
        </div>
      )}

      {/* Connections Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#111816]/10 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-[#111816]/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-[320px]">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#111816]/40">
                <SemanticIcon concept="search" size="navigation" />
              </div>
              <input 
                type="text" 
                placeholder="Search business or number..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-[#F7F9F8] border border-transparent rounded-xl text-[14px] text-[#111816] placeholder-[#111816]/40 focus:bg-white focus:border-[#003B2D] focus:outline-none transition-colors"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2">
              <SemanticIcon concept="filter" className="text-[#111816]/50" size="navigation" />
              <span className="text-[13px] font-medium text-[#111816]/70">Status:</span>
            </div>
            <div className="flex bg-[#F7F9F8] p-1 rounded-xl border border-[#111816]/5 overflow-x-auto w-full sm:w-auto hide-scrollbar">
              {['All', 'Connected', 'Pending', 'Verifying', 'Failed', 'Disconnected'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors whitespace-nowrap ${
                    statusFilter === status 
                      ? 'bg-white text-[#111816] shadow-sm' 
                      : 'text-[#111816]/60 hover:text-[#111816] hover:bg-[#111816]/5'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <select 
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="h-10 px-3 bg-[#F7F9F8] border border-[#111816]/5 rounded-xl text-[13px] font-medium text-[#111816] focus:outline-none focus:border-[#003B2D] transition-colors cursor-pointer"
            >
              <option value="All">All Sources</option>
              <option value="Existing WhatsApp Business App">Existing WhatsApp Business App</option>
              <option value="New Number">New Number</option>
              <option value="Existing Platform">Existing Platform</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[#F7F9F8]/50 border-b border-[#111816]/10">
                <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider w-[220px]">Business</th>
                <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider w-[150px]">Number</th>
                <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider w-[180px]">Source</th>
                <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider w-[140px]">Status</th>
                <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider w-[240px]">Message Loop (Last Active)</th>
                <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider w-[100px]">Health</th>
                <th className="px-5 py-3.5 text-[12px] font-bold text-[#111816]/50 uppercase tracking-wider w-[80px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#111816]/5">
              {filteredConnections.map((conn) => (
                <tr key={conn.id} className="hover:bg-[#F7F9F8]/80 transition-colors group">
                  <td className="px-5 py-4 align-top">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[8px] bg-[#003B2D]/5 text-[#003B2D] flex items-center justify-center shrink-0 border border-[#003B2D]/10">
                        <SemanticIcon concept="conversations" size="navigation" />
                      </div>
                      <span className="text-[14px] font-bold text-[#111816]">{conn.business}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <span className="text-[13px] font-mono text-[#111816]/70">{conn.number}</span>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <span className="text-[13px] text-[#111816]/60 font-medium">{conn.source}</span>
                  </td>
                  <td className="px-5 py-4 align-top">
                    {getStatusBadge(conn.status)}
                  </td>
                  <td className="px-5 py-4 align-top">
                    {conn.status === 'CONNECTED' || conn.status === 'FAILED' ? (
                      <div className="flex flex-col gap-1.5 text-[12px]">
                        <div className="flex items-center justify-between">
                          <span className="text-[#111816]/50">Inbound:</span>
                          <span className="font-medium text-[#111816]">{conn.lastInbound}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#111816]/50">Outbound:</span>
                          <span className="font-medium text-[#111816]">{conn.lastOutbound}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#111816]/50">Callback:</span>
                          <span className="font-medium text-[#111816]">{conn.lastCallback}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[13px] text-[#111816]/40 italic">Not applicable</span>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top">
                    {getHealthBadge(conn.health)}
                  </td>
                  <td className="px-5 py-4 align-top text-right">
                    <button 
                      onClick={() => router.push(`/admin/businesses/${conn.id}/whatsapp`)}
                      className="inline-flex items-center justify-center h-8 px-3 rounded-[6px] text-[13px] font-semibold text-[#003B2D] bg-[#003B2D]/5 hover:bg-[#003B2D]/10 transition-colors"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filteredConnections.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-[#111816]/40">
                      <SemanticIcon concept="search" className="mb-3" size="feature" />
                      <p className="text-[14px] font-medium">No WhatsApp connections match your search criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-5 py-4 border-t border-[#111816]/10 flex items-center justify-between bg-[#F7F9F8]/50">
          <span className="text-[13px] text-[#111816]/60 font-medium">
            Showing <strong className="text-[#111816]">1</strong> to <strong className="text-[#111816]">{filteredConnections.length}</strong> of <strong className="text-[#111816]">162</strong> connections
          </span>
          <div className="flex items-center gap-1.5">
            <button className="px-3 py-1.5 rounded-xl border border-[#111816]/10 bg-white text-[13px] font-medium text-[#111816]/60 hover:text-[#111816] hover:bg-[#F7F9F8] transition-colors">
              Previous
            </button>
            <button className="w-8 h-8 rounded-xl bg-[#003B2D] text-white text-[13px] font-semibold flex items-center justify-center">
              1
            </button>
            <button className="w-8 h-8 rounded-xl bg-transparent hover:bg-[#111816]/5 text-[#111816]/70 text-[13px] font-semibold flex items-center justify-center transition-colors">
              2
            </button>
            <button className="w-8 h-8 rounded-xl bg-transparent hover:bg-[#111816]/5 text-[#111816]/70 text-[13px] font-semibold flex items-center justify-center transition-colors">
              3
            </button>
            <span className="text-[#111816]/40 px-1">...</span>
            <button className="w-8 h-8 rounded-xl bg-transparent hover:bg-[#111816]/5 text-[#111816]/70 text-[13px] font-semibold flex items-center justify-center transition-colors">
              16
            </button>
            <button className="px-3 py-1.5 rounded-xl border border-[#111816]/10 bg-white text-[13px] font-medium text-[#111816]/60 hover:text-[#111816] hover:bg-[#F7F9F8] transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
