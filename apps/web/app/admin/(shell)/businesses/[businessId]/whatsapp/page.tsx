"use client";

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SemanticIcon } from '@/src/icons/semantic-icon';

const WA_DETAIL_DATA = {
  businessName: 'Wansati Brands',
  number: '+27 82 000 0000',
  status: 'CONNECTED',
  health: 'HEALTHY',
  provider: 'Meta WhatsApp Cloud API',
  source: 'Existing WhatsApp Business App',
  connectedAt: '12 Sep 2026, 14:32',
  lastVerified: '17 Sep 2026, 14:40',
  externalId: 'waba_1029384756',
  phoneId: 'phn_987654321',
  loopHealth: {
    inbound: { status: 'HEALTHY', lastActivity: '3 min ago' },
    outbound: { status: 'HEALTHY', lastActivity: '2 min ago' },
    delivery: { status: 'HEALTHY', lastActivity: '2 min ago' },
    read: { status: 'AVAILABLE', lastActivity: '1 min ago' }
  },
  last24Hours: {
    inbound: 246,
    outbound: 198,
    delivered: 194,
    read: 161,
    failed: 4,
    unsupportedInbound: 2
  },
  webhookHealth: {
    status: 'HEALTHY',
    lastInbound: '1 min ago',
    lastStatus: '2 min ago',
    failedEvents: 0,
    unknownEvents: 0,
    duplicateEvents: 12,
    signatureFailures: 0
  },
  outboundHealth: {
    accepted: 198,
    sent: 198,
    delivered: 194,
    read: 161,
    failed: 4,
    recentFailure: {
      messageId: 'msg_1xyz89',
      error: 'Recipient unavailable',
      time: '14:32',
      status: 'FAILED'
    }
  },
  events: [
    { event: 'Delivery callback received', date: '17 Sep 2026, 14:32', actor: 'System', meta: 'msg_1xyz89' },
    { event: 'Outbound message accepted', date: '17 Sep 2026, 14:32', actor: 'System', meta: 'status: ACCEPTED' },
    { event: 'Inbound message received', date: '17 Sep 2026, 14:31', actor: 'System', meta: 'text message' },
    { event: 'Connection verified', date: '17 Sep 2026, 14:30', actor: 'System', meta: 'waba_1029384756' },
  ]
};

export default function AdminBusinessWhatsAppPage({ params }: { params: Promise<{ businessId: string }> }) {
  const router = useRouter();
  const { businessId } = use(params);

  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReconnectOpen, setIsReconnectOpen] = useState(false);
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);
  const [disconnectReason, setDisconnectReason] = useState('');

  const currentUserRole = 'SUPER_ADMIN';
  const canManageConnection = currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'OPERATIONS';

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center font-bold tracking-wide text-green-700 text-[12px]">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></div>
            CONNECTED
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

  const getLoopHealthColor = (status: string) => {
    switch(status) {
      case 'HEALTHY': return 'text-[#003B2D]';
      case 'ATTENTION': return 'text-[#B27B16]';
      case 'AVAILABLE': return 'text-[#111816]/70';
      default: return 'text-[#111816]';
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#F7F9F8] font-['Spline_Sans'] min-h-screen">
      <div className="max-w-[1200px] mx-auto px-8 py-8 space-y-6">
        
        {/* Breadcrumbs */}
        <div className="flex items-center text-[14px] text-[#111816]/50 font-medium mb-2">
          <button onClick={() => router.push('/admin/businesses')} className="hover:text-[#003B2D] transition-colors cursor-pointer">Businesses</button>
          <SemanticIcon concept="chevronRight" size="metadata" className="mx-2" />
          <button onClick={() => router.push(`/admin/businesses/${businessId}`)} className="hover:text-[#003B2D] transition-colors cursor-pointer">{WA_DETAIL_DATA.businessName}</button>
          <SemanticIcon concept="chevronRight" size="metadata" className="mx-2" />
          <span className="text-[#111816]">WhatsApp</span>
        </div>

        {/* Context Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <h1 className="text-[28px] font-bold text-[#111816] tracking-tight">WhatsApp Connection</h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleRefresh}
              className="px-4 py-2.5 rounded-xl font-medium text-[#003B2D] bg-white border border-[#111816]/10 hover:bg-[#F7F9F8] transition-colors shadow-sm flex items-center gap-2 text-sm cursor-pointer"
            >
              <SemanticIcon concept="refresh" className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
            </button>
            {canManageConnection && (
              <button 
                onClick={() => setIsReconnectOpen(true)}
                className="px-4 py-2.5 rounded-xl font-medium text-[#003B2D] bg-[#3CE6D0]/20 hover:bg-[#3CE6D0]/30 border border-[#3CE6D0]/50 transition-colors shadow-sm text-sm cursor-pointer"
              >
                Reconnect WhatsApp
              </button>
            )}
            
            <div className="relative">
              <button 
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                className="p-2.5 rounded-xl font-medium text-[#111816]/70 bg-white border border-[#111816]/10 hover:bg-[#F7F9F8] transition-colors shadow-sm cursor-pointer"
              >
                <SemanticIcon concept="menuVertical" />
              </button>
              {isActionsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsActionsOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-48 z-50">
                    <div className="bg-white rounded-xl shadow-lg border border-[#111816]/10 py-1 relative">
                      <button 
                        onClick={() => { setIsActionsOpen(false); router.push(`/admin/businesses/${businessId}`); }} 
                        className="w-full text-left px-4 py-2 text-sm text-[#111816]/70 hover:bg-[#F7F9F8] hover:text-[#003B2D] transition-colors cursor-pointer"
                      >
                        View Business
                      </button>
                      <button onClick={() => setIsActionsOpen(false)} className="w-full text-left px-4 py-2 text-sm text-[#111816]/70 hover:bg-[#F7F9F8] hover:text-[#003B2D] transition-colors cursor-pointer">
                        View Audit History
                      </button>
                      <button onClick={() => setIsActionsOpen(false)} className="w-full text-left px-4 py-2 text-sm text-[#111816]/70 hover:bg-[#F7F9F8] hover:text-[#003B2D] transition-colors cursor-pointer">
                        View Operations
                      </button>
                      {canManageConnection && (
                        <button 
                          onClick={() => { setIsActionsOpen(false); setIsDisconnectOpen(true); }}
                          className="w-full text-left px-4 py-2 text-sm text-[#FF7A66] hover:bg-[#FF7A66]/10 transition-colors border-t border-[#111816]/5 mt-1 pt-2 cursor-pointer"
                        >
                          Disconnect WhatsApp
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top Banner Status */}
        <div className="bg-white rounded-2xl border border-[#111816]/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-sm font-medium text-[#111816]/50 mb-1">Business</div>
              <div className="text-xl font-bold text-[#111816]">{WA_DETAIL_DATA.businessName}</div>
            </div>
            <div className="w-px h-10 bg-[#111816]/10 hidden md:block"></div>
            <div>
              <div className="text-sm font-medium text-[#111816]/50 mb-1">Connected Number</div>
              <div className="text-xl font-bold text-[#111816] font-mono">{WA_DETAIL_DATA.number}</div>
            </div>
            <div className="w-px h-10 bg-[#111816]/10 hidden md:block"></div>
            <div>
              <div className="text-sm font-medium text-[#111816]/50 mb-1">Status</div>
              <div className="mt-1">{getStatusBadge(WA_DETAIL_DATA.status)}</div>
            </div>
            <div className="w-px h-10 bg-[#111816]/10 hidden md:block"></div>
            <div>
              <div className="text-sm font-medium text-[#111816]/50 mb-1">Health</div>
              <div className="mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-green-500/10 text-green-700 text-[11px] font-bold border border-green-500/20">{WA_DETAIL_DATA.health}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-6">
            
            {/* Connection Details */}
            <div className="bg-white rounded-2xl border border-[#111816]/10 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-[#111816]/5">
                <h2 className="text-lg font-bold text-[#111816]">Connection Details</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm font-medium text-[#111816]/50 mb-1">Provider</div>
                    <div className="font-medium text-[#111816] text-sm">{WA_DETAIL_DATA.provider}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-[#111816]/50 mb-1">Connection Source</div>
                    <div className="font-medium text-[#111816] text-sm">{WA_DETAIL_DATA.source}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#111816]/50 mb-1">Connected At</div>
                    <div className="font-medium text-[#111816] text-sm">{WA_DETAIL_DATA.connectedAt}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-[#111816]/50 mb-1">Last Verified</div>
                    <div className="font-medium text-[#111816] text-sm">{WA_DETAIL_DATA.lastVerified}</div>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-[#111816]/5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-[#111816]/40 mb-1">WhatsApp Business Account ID</div>
                    <div className="font-mono text-xs text-[#111816]/60 bg-[#F7F9F8] p-1.5 rounded border border-[#111816]/5 inline-block">{WA_DETAIL_DATA.externalId}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#111816]/40 mb-1">Phone Number ID</div>
                    <div className="font-mono text-xs text-[#111816]/60 bg-[#F7F9F8] p-1.5 rounded border border-[#111816]/5 inline-block">{WA_DETAIL_DATA.phoneId}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Loop Health */}
            <div className="bg-white rounded-2xl border border-[#111816]/10 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-[#111816]/5">
                <h2 className="text-lg font-bold text-[#111816]">Message Loop Health</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-[#111816]/10 bg-[#F7F9F8]">
                    <div className="text-sm font-medium text-[#111816]/60 mb-2">Inbound message</div>
                    <div className={`font-bold mb-1 ${getLoopHealthColor(WA_DETAIL_DATA.loopHealth.inbound.status)}`}>{WA_DETAIL_DATA.loopHealth.inbound.status}</div>
                    <div className="text-xs text-[#111816]/50">Last received {WA_DETAIL_DATA.loopHealth.inbound.lastActivity}</div>
                  </div>
                  <div className="p-4 rounded-xl border border-[#111816]/10 bg-[#F7F9F8]">
                    <div className="text-sm font-medium text-[#111816]/60 mb-2">Outbound send</div>
                    <div className={`font-bold mb-1 ${getLoopHealthColor(WA_DETAIL_DATA.loopHealth.outbound.status)}`}>{WA_DETAIL_DATA.loopHealth.outbound.status}</div>
                    <div className="text-xs text-[#111816]/50">Last accepted {WA_DETAIL_DATA.loopHealth.outbound.lastActivity}</div>
                  </div>
                  <div className="p-4 rounded-xl border border-[#111816]/10 bg-[#F7F9F8]">
                    <div className="text-sm font-medium text-[#111816]/60 mb-2">Delivery callback</div>
                    <div className={`font-bold mb-1 ${getLoopHealthColor(WA_DETAIL_DATA.loopHealth.delivery.status)}`}>{WA_DETAIL_DATA.loopHealth.delivery.status}</div>
                    <div className="text-xs text-[#111816]/50">Last received {WA_DETAIL_DATA.loopHealth.delivery.lastActivity}</div>
                  </div>
                  <div className="p-4 rounded-xl border border-[#111816]/10 bg-[#F7F9F8]">
                    <div className="text-sm font-medium text-[#111816]/60 mb-2">Read callback</div>
                    <div className={`font-bold mb-1 ${getLoopHealthColor(WA_DETAIL_DATA.loopHealth.read.status)}`}>{WA_DETAIL_DATA.loopHealth.read.status}</div>
                    <div className="text-xs text-[#111816]/50">Last received {WA_DETAIL_DATA.loopHealth.read.lastActivity}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Outbound Delivery Health & Events */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Outbound Delivery Health */}
              <div className="bg-white rounded-2xl border border-[#111816]/10 overflow-hidden shadow-sm flex flex-col">
                <div className="p-6 border-b border-[#111816]/5">
                  <h2 className="text-lg font-bold text-[#111816]">Outbound Delivery Health</h2>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 mb-6">
                    <div>
                      <div className="text-xs font-medium text-[#111816]/50">Accepted</div>
                      <div className="font-semibold text-[#111816] text-lg">{WA_DETAIL_DATA.outboundHealth.accepted}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#111816]/50">Sent</div>
                      <div className="font-semibold text-[#111816] text-lg">{WA_DETAIL_DATA.outboundHealth.sent}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#111816]/50">Delivered</div>
                      <div className="font-semibold text-[#111816] text-lg">{WA_DETAIL_DATA.outboundHealth.delivered}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#111816]/50">Failed</div>
                      <div className="font-semibold text-[#FF7A66] text-lg">{WA_DETAIL_DATA.outboundHealth.failed}</div>
                    </div>
                  </div>

                  {WA_DETAIL_DATA.outboundHealth.recentFailure && (
                    <div className="mt-auto p-4 rounded-xl border border-[#FF7A66]/20 bg-[#FF7A66]/5">
                      <div className="text-xs font-bold text-[#FF7A66] mb-2 flex items-center gap-1">
                        <SemanticIcon concept="alert" /> Recent Failure
                      </div>
                      <div className="text-sm font-medium text-[#111816] mb-1">
                        Provider response: "{WA_DETAIL_DATA.outboundHealth.recentFailure.error}"
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs font-mono text-[#111816]/50">ID: {WA_DETAIL_DATA.outboundHealth.recentFailure.messageId}</div>
                        <div className="text-xs text-[#111816]/50">{WA_DETAIL_DATA.outboundHealth.recentFailure.time}</div>
                      </div>
                      <button className="mt-3 text-xs font-semibold text-[#003B2D] hover:underline">
                        View Operational Event
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Connection Events */}
              <div className="bg-white rounded-2xl border border-[#111816]/10 overflow-hidden shadow-sm flex flex-col">
                <div className="p-6 border-b border-[#111816]/5">
                  <h2 className="text-lg font-bold text-[#111816]">Recent Events</h2>
                </div>
                <div className="p-6 flex-1">
                  <div className="space-y-5 relative before:absolute before:inset-0 before:ml-1.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-[#111816]/5">
                    {WA_DETAIL_DATA.events.map((evt, idx) => (
                      <div key={idx} className="relative flex items-start gap-4">
                        <div className="w-3 h-3 mt-1 rounded-full border-2 border-white bg-[#003B2D] shrink-0 z-10 shadow-sm"></div>
                        <div>
                          <div className="text-sm font-medium text-[#111816] mb-0.5">{evt.event}</div>
                          <div className="text-xs text-[#111816]/50 mb-1">{evt.date} • by {evt.actor}</div>
                          {evt.meta && (
                            <div className="text-[10px] font-mono text-[#111816]/40">{evt.meta}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="space-y-6">
            
            {/* Last 24 Hours */}
            <div className="bg-white rounded-2xl border border-[#111816]/10 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#111816] mb-5">Last 24 Hours</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-[#111816]/5">
                  <span className="text-sm text-[#111816]/70">Inbound</span>
                  <span className="font-semibold text-[#111816]">{WA_DETAIL_DATA.last24Hours.inbound}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#111816]/5">
                  <span className="text-sm text-[#111816]/70">Outbound</span>
                  <span className="font-semibold text-[#111816]">{WA_DETAIL_DATA.last24Hours.outbound}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#111816]/5">
                  <span className="text-sm text-[#111816]/70">Delivered</span>
                  <span className="font-semibold text-[#111816]">{WA_DETAIL_DATA.last24Hours.delivered}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#111816]/5">
                  <span className="text-sm text-[#111816]/70">Read</span>
                  <span className="font-semibold text-[#111816]">{WA_DETAIL_DATA.last24Hours.read}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[#111816]/5">
                  <span className="text-sm text-[#111816]/70">Failed</span>
                  <span className="font-semibold text-[#FF7A66]">{WA_DETAIL_DATA.last24Hours.failed}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-[#111816]/70">Unsupported inbound</span>
                  <span className="font-semibold text-[#111816]/50">{WA_DETAIL_DATA.last24Hours.unsupportedInbound}</span>
                </div>
              </div>
            </div>

            {/* Webhook Health */}
            <div className="bg-white rounded-2xl border border-[#111816]/10 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-[#111816]">Webhook Health</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-green-500/10 text-green-700 text-[11px] font-bold border border-green-500/20">{WA_DETAIL_DATA.webhookHealth.status}</span>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-[#111816]/50 mb-1">Last inbound</div>
                    <div className="text-sm font-medium text-[#111816]">{WA_DETAIL_DATA.webhookHealth.lastInbound}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#111816]/50 mb-1">Last status</div>
                    <div className="text-sm font-medium text-[#111816]">{WA_DETAIL_DATA.webhookHealth.lastStatus}</div>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-[#111816]/5 flex justify-between items-center">
                  <div className="text-sm text-[#111816]/70">Failed processing events</div>
                  <div className="font-bold text-[#111816]">{WA_DETAIL_DATA.webhookHealth.failedEvents}</div>
                </div>
                <div className="pt-3 border-t border-[#111816]/5 flex justify-between items-center">
                  <div className="text-sm text-[#111816]/70">Unknown connection events</div>
                  <div className="font-bold text-[#111816]">{WA_DETAIL_DATA.webhookHealth.unknownEvents}</div>
                </div>
                <div className="pt-3 border-t border-[#111816]/5 flex justify-between items-center">
                  <div className="text-sm text-[#111816]/70">Duplicate events safely ignored</div>
                  <div className="font-bold text-[#111816]/50">{WA_DETAIL_DATA.webhookHealth.duplicateEvents}</div>
                </div>
                <div className="pt-3 border-t border-[#111816]/5 flex justify-between items-center">
                  <div className="text-sm text-[#111816]/70">Recent signature failures</div>
                  <div className="font-bold text-[#111816]">{WA_DETAIL_DATA.webhookHealth.signatureFailures}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 text-center text-xs font-medium text-[#003B2D] bg-[#F7F9F8] border border-[#111816]/10 py-2 rounded-xl hover:bg-[#111816]/5 transition-colors">
                  View Failed Events
                </button>
                <button className="flex-1 text-center text-xs font-medium text-[#003B2D] bg-[#F7F9F8] border border-[#111816]/10 py-2 rounded-xl hover:bg-[#111816]/5 transition-colors">
                  View Operations
                </button>
              </div>
            </div>
            
          </div>
        </div>
        
      </div>

      {/* Reconnect WhatsApp Modal */}
      {isReconnectOpen && (
        <div className="fixed inset-0 bg-[#111816]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#111816]/10 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-[#111816]">Reconnect WhatsApp</h3>
              <button 
                onClick={() => setIsReconnectOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F7F9F8] transition-colors"
              >
                <SemanticIcon concept="close" className="text-[#111816]/50" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6 p-4 rounded-xl bg-[#F7F9F8] border border-[#111816]/10 flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span className="text-[#111816]/60">Business</span>
                  <span className="font-semibold text-[#111816]">{WA_DETAIL_DATA.businessName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#111816]/60">Number</span>
                  <span className="font-semibold font-mono text-[#111816]">{WA_DETAIL_DATA.number}</span>
                </div>
                <div className="flex justify-between text-sm mt-2 pt-2 border-t border-[#111816]/10">
                  <span className="text-[#111816]/60">Current Status</span>
                  {getStatusBadge(WA_DETAIL_DATA.status)}
                </div>
              </div>

              <p className="text-sm text-[#111816]/70 mb-2">
                Reconnect this Business to restore WhatsApp messaging.
              </p>
              <p className="text-xs text-[#111816]/50">
                You will be redirected to complete the Meta Embedded Signup flow to refresh authorization tokens.
              </p>
            </div>
            <div className="p-6 border-t border-[#111816]/10 shrink-0 flex gap-3">
              <button 
                onClick={() => setIsReconnectOpen(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-[#111816]/70 hover:bg-[#F7F9F8] transition-colors border border-[#111816]/10"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsReconnectOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-[#003B2D] bg-[#3CE6D0]/30 hover:bg-[#3CE6D0]/50 transition-colors"
              >
                Start Reconnection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect WhatsApp Modal */}
      {isDisconnectOpen && (
        <div className="fixed inset-0 bg-[#111816]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#111816]/10 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#FF7A66]/10 flex items-center justify-center shrink-0">
                <SemanticIcon concept="alert" className="text-[#FF7A66]" />
              </div>
              <h3 className="text-xl font-bold text-[#111816]">Disconnect WhatsApp?</h3>
            </div>
            <div className="p-6">
              <div className="mb-5 flex justify-between text-sm p-3 rounded-xl bg-[#F7F9F8] border border-[#111816]/5">
                <span className="font-semibold text-[#111816]">{WA_DETAIL_DATA.businessName}</span>
                <span className="font-mono text-[#111816]/70">{WA_DETAIL_DATA.number}</span>
              </div>
              
              <p className="text-[#111816]/70 mb-6 text-sm font-medium">
                SlotlyFlow will stop sending and receiving WhatsApp messages for this Business immediately.
              </p>
              
              <div className="space-y-4">
                <label className="block text-sm font-medium text-[#111816]">Reason for disconnect</label>
                <select 
                  value={disconnectReason}
                  onChange={(e) => setDisconnectReason(e.target.value)}
                  className="w-full bg-[#F7F9F8] border border-[#111816]/10 rounded-xl px-4 py-3 text-[#111816] focus:outline-none focus:border-[#003B2D] transition-colors appearance-none font-medium"
                >
                  <option value="" disabled>Select a reason...</option>
                  <option value="customer_requested">Customer requested</option>
                  <option value="compliance">Compliance / Policy violation</option>
                  <option value="moving_hosting">Moving to independent hosting</option>
                  <option value="billing_issues">Billing issues</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-[#111816]/10 shrink-0 flex gap-3">
              <button 
                onClick={() => setIsDisconnectOpen(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-[#111816]/70 hover:bg-[#F7F9F8] transition-colors border border-[#111816]/10"
              >
                Keep Connected
              </button>
              <button 
                disabled={!disconnectReason}
                onClick={() => setIsDisconnectOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-[#FF7A66] hover:bg-[#FF7A66]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Disconnect WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
