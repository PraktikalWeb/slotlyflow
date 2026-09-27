"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SemanticIcon } from '@/src/icons/semantic-icon';

const STAFF_DATA = {
  id: 'staff_1',
  name: 'Sarah Jenkins',
  email: 'sarah@slotlyflow.com',
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
  invitedDate: '01 Jan 2024, 09:00',
  activatedDate: '01 Jan 2024, 09:15',
  lastActive: '2 mins ago',
  invitedBy: 'System',
  timeline: [
    { id: 't1', action: 'Logged in', date: '17 Sep 2026, 08:30' },
    { id: 't2', action: 'Changed role for Amira Patel to BILLING_ADMIN', date: '10 Feb 2024, 14:22' },
    { id: 't3', action: 'Account activated', date: '01 Jan 2024, 09:15' },
    { id: 't4', action: 'Invited to platform', date: '01 Jan 2024, 09:00', by: 'System' }
  ]
};

const PERMISSIONS_MAP = {
  SUPER_ADMIN: {
    Businesses: ['View Businesses', 'Manage Businesses'],
    Users: ['View Users', 'Manage Users'],
    WhatsApp: ['View WhatsApp connections', 'Manage WhatsApp operations'],
    Billing: ['View subscriptions', 'Manage subscriptions'],
    Operations: ['View operational health', 'Manage operational issues'],
    Audit: ['View audit logs'],
    Staff: ['View staff', 'Manage staff']
  },
  SUPPORT: {
    Businesses: ['View Businesses'],
    Users: ['View Users'],
    WhatsApp: ['View WhatsApp connections'],
    Billing: ['View subscriptions'],
    Operations: ['View operational health'],
    Audit: ['View audit logs'],
    Staff: ['View staff']
  },
  BILLING_ADMIN: {
    Businesses: ['View Businesses'],
    Users: ['View Users'],
    WhatsApp: ['View WhatsApp connections'],
    Billing: ['View subscriptions', 'Manage subscriptions'],
    Operations: ['View operational health'],
    Audit: ['View audit logs'],
    Staff: []
  },
  OPERATIONS: {
    Businesses: ['View Businesses'],
    Users: ['View Users'],
    WhatsApp: ['View WhatsApp connections', 'Manage WhatsApp operations'],
    Billing: ['View subscriptions'],
    Operations: ['View operational health', 'Manage operational issues'],
    Audit: ['View audit logs'],
    Staff: []
  }
};

export default function PlatformStaffDetailPage() {
  const router = useRouter();
  
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleForm, setRoleForm] = useState(STAFF_DATA.role);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-[#8B7CF6]/20 text-[#8B7CF6] border-[#8B7CF6]/50';
      case 'SUPPORT': return 'bg-[#3CE6D0]/20 text-[#003B2D] border-[#3CE6D0]/50';
      case 'BILLING_ADMIN': return 'bg-[#B7F34A]/20 text-[#003B2D] border-[#B7F34A]/50';
      case 'OPERATIONS': return 'bg-[#FF7A66]/20 text-[#FF7A66] border-[#FF7A66]/50';
      default: return 'bg-[#111816]/10 text-[#111816]/70 border-[#111816]/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-700';
      case 'SUSPENDED': return 'bg-[#FF7A66]/20 text-[#FF7A66] border-[#FF7A66]/50';
      case 'INVITED': return 'bg-[#F7F9F8] text-[#111816]/70 border-[#111816]/20';
      default: return 'bg-[#F7F9F8] text-[#111816]/70 border-[#111816]/20';
    }
  };

  const [currentUserRole, setCurrentUserRole] = useState('SUPER_ADMIN');

  const permissions = PERMISSIONS_MAP[STAFF_DATA.role as keyof typeof PERMISSIONS_MAP];
  const canManageStaff = currentUserRole === 'SUPER_ADMIN';

  return (
    <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#F7F9F8] font-['Spline_Sans']">
      <header className="h-16 bg-white border-b border-[#111816]/10 flex items-center justify-between px-8 sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-[12px] text-[#111816]/50 font-medium uppercase tracking-wider">Viewing As:</span>
            <select 
              value={currentUserRole}
              onChange={(e) => setCurrentUserRole(e.target.value)}
              className="h-8 px-2 bg-[#F7F9F8] border border-[#111816]/10 rounded-[6px] text-[13px] font-semibold text-[#111816] focus:outline-none focus:border-[#003B2D] cursor-pointer"
            >
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="SUPPORT">SUPPORT</option>
              <option value="BILLING_ADMIN">BILLING_ADMIN</option>
              <option value="OPERATIONS">OPERATIONS</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-[14px]">
            <button 
              onClick={() => router.push('/admin/platform-staff')}
              className="text-[#111816]/50 hover:text-[#111816] font-medium transition-colors"
            >
              Platform Staff
            </button>
            <span className="text-[#111816]/30">/</span>
            <span className="text-[#111816] font-semibold">{STAFF_DATA.name}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-[1000px] mx-auto space-y-6">
          <button 
            onClick={() => router.push('/admin/platform-staff')}
            className="flex items-center gap-2 text-[13px] font-semibold text-[#111816]/60 hover:text-[#111816] w-fit mb-2 transition-colors cursor-pointer"
          >
            <SemanticIcon concept="back" className="w-4 h-4" />
            Back to Staff
          </button>

          {/* Profile Header */}
          <div className="bg-white rounded-[16px] border border-[#111816]/10 p-6 flex flex-col md:flex-row md:items-start justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-[#F7F9F8] border border-[#111816]/10 flex items-center justify-center text-[24px] font-bold text-[#111816]">
                {STAFF_DATA.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-[24px] font-bold text-[#111816] tracking-tight mb-2">{STAFF_DATA.name}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[14px] font-medium text-[#111816]/70">{STAFF_DATA.email}</span>
                  <span className="w-1 h-1 rounded-full bg-[#111816]/20"></span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border text-[11px] font-bold tracking-wide ${getRoleColor(STAFF_DATA.role)}`}>
                    {STAFF_DATA.role}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border text-[11px] font-bold tracking-wide ${getStatusColor(STAFF_DATA.status)}`}>
                    {STAFF_DATA.status}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {canManageStaff ? (
                <>
                  {STAFF_DATA.status === 'SUSPENDED' ? (
                    <button 
                      onClick={() => {}} 
                      className="px-4 py-2 bg-white border border-[#111816]/20 text-[#003B2D] rounded-[6px] text-[13px] font-semibold hover:bg-[#F7F9F8] transition-colors cursor-pointer"
                    >
                      Reactivate Staff
                    </button>
                  ) : (
                    <button 
                      onClick={() => setIsSuspendModalOpen(true)}
                      className="px-4 py-2 bg-white border border-[#111816]/20 text-[#FF7A66] rounded-[6px] text-[13px] font-semibold hover:bg-[#FF7A66]/5 hover:border-[#FF7A66]/30 transition-colors cursor-pointer"
                    >
                      Suspend Staff
                    </button>
                  )}
                  <button 
                    onClick={() => setIsRoleModalOpen(true)}
                    className="px-5 py-2 bg-[#003B2D] text-white rounded-[6px] text-[13px] font-semibold hover:bg-[#002B21] transition-colors cursor-pointer shadow-sm"
                  >
                    Edit Role
                  </button>
                </>
              ) : (
                <div className="px-3 py-1.5 bg-[#F7F9F8] border border-[#111816]/10 rounded-[6px] flex items-center gap-2">
                  <SemanticIcon concept="shieldCheck" className="w-4 h-4 text-[#111816]/40" />
                  <span className="text-[12px] font-medium text-[#111816]/60">View Only</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              
              <div className="bg-white rounded-[12px] border border-[#111816]/10 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-[#111816]/10 flex items-center justify-between">
                  <h2 className="text-[16px] font-bold text-[#111816]">Platform Permissions</h2>
                  <SemanticIcon concept="shieldCheck" className="w-4 h-4 text-[#111816]/40" />
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {Object.entries(permissions).map(([group, perms]) => (
                      <div key={group}>
                        <h3 className="text-[13px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-3">{group}</h3>
                        {perms.length > 0 ? (
                          <ul className="space-y-2">
                            {perms.map((perm, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#003B2D] mt-1.5 shrink-0"></div>
                                <span className="text-[13px] text-[#111816] font-medium">{perm}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[13px] text-[#111816]/40 italic">No access</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[12px] border border-[#111816]/10 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-[#111816]/10">
                  <h2 className="text-[16px] font-bold text-[#111816]">Staff Details</h2>
                </div>
                <div className="p-6">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                    <div>
                      <dt className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-1.5">Invited Date</dt>
                      <dd className="text-[14px] font-medium text-[#111816]">{STAFF_DATA.invitedDate}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-1.5">Activated Date</dt>
                      <dd className="text-[14px] font-medium text-[#111816]">{STAFF_DATA.activatedDate}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-1.5">Last Active</dt>
                      <dd className="text-[14px] font-medium text-[#111816]">{STAFF_DATA.lastActive}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-1.5">Invited By</dt>
                      <dd className="text-[14px] font-medium text-[#111816]">{STAFF_DATA.invitedBy}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              
            </div>

            <div className="space-y-6">
              
              <div className="bg-[#F7F9F8] rounded-[12px] border border-[#111816]/10 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <SemanticIcon concept="key" className="w-4 h-4 text-[#8B7CF6]" />
                  <h2 className="text-[14px] font-bold text-[#111816]">Security Status</h2>
                </div>
                <div className="space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#111816]/60">2FA Enabled</span>
                    <span className="text-[13px] font-semibold text-[#003B2D]">Yes</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#111816]/60">Email Verified</span>
                    <span className="text-[13px] font-semibold text-[#003B2D]">Yes</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[12px] border border-[#111816]/10 p-5 shadow-sm">
                <h2 className="text-[14px] font-bold text-[#111816] mb-4">Activity Timeline</h2>
                <div className="space-y-4">
                  {STAFF_DATA.timeline.map((item, index) => (
                    <div key={item.id} className="flex gap-3 relative">
                      {index !== STAFF_DATA.timeline.length - 1 && (
                        <div className="absolute left-[9px] top-5 bottom-[-16px] w-px bg-[#111816]/10"></div>
                      )}
                      <div className="w-[18px] h-[18px] rounded-full bg-[#F7F9F8] border border-[#111816]/20 flex items-center justify-center shrink-0 mt-0.5 z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#003B2D]"></div>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#111816] leading-tight">{item.action}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-[#111816]/50">{item.date}</span>
                          {item.by && (
                            <>
                              <span className="w-0.5 h-0.5 rounded-full bg-[#111816]/30"></span>
                              <span className="text-[11px] text-[#111816]/50">by {item.by}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Edit Role Modal */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#111816]/40 backdrop-blur-sm" onClick={() => setIsRoleModalOpen(false)}></div>
          <div className="relative bg-white rounded-[12px] shadow-2xl w-full max-w-[480px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#111816]/10">
              <h3 className="text-[18px] font-bold text-[#111816]">Change Platform Role</h3>
            </div>
            
            <div className="p-6">
              <div className="mb-6 p-4 rounded-[8px] bg-[#F7F9F8] border border-[#111816]/10 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-1">Current Role</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border text-[11px] font-bold tracking-wide ${getRoleColor(STAFF_DATA.role)}`}>
                    {STAFF_DATA.role}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#111816] mb-3">New Role</label>
                <div className="space-y-2">
                  {['SUPER_ADMIN', 'SUPPORT', 'BILLING_ADMIN', 'OPERATIONS'].map(role => (
                    <label key={role} className={`block p-3 border rounded-[8px] cursor-pointer transition-all ${roleForm === role ? 'border-[#003B2D] bg-[#003B2D]/5 ring-1 ring-[#003B2D]' : 'border-[#111816]/10 hover:border-[#111816]/30'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-[#111816]">{role}</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${roleForm === role ? 'border-[#003B2D] bg-[#003B2D]' : 'border-[#111816]/30'}`}>
                          {roleForm === role && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                        </div>
                      </div>
                      <input type="radio" name="edit_role" value={role} className="sr-only" checked={roleForm === role} onChange={() => setRoleForm(role)} />
                    </label>
                  ))}
                </div>
              </div>
              
              {roleForm !== 'SUPER_ADMIN' && STAFF_DATA.role === 'SUPER_ADMIN' && (
                <div className="mt-4 p-4 rounded-[8px] bg-[#FF7A66]/10 border border-[#FF7A66]/20 flex items-start gap-3">
                  <SemanticIcon concept="warning" className="w-5 h-5 text-[#FF7A66] shrink-0" />
                  <div>
                    <p className="text-[13px] font-bold text-[#FF7A66] mb-1">Cannot Demote Last SUPER_ADMIN</p>
                    <p className="text-[12px] text-[#111816]/70">This will remove their full platform administration access. At least one active SUPER_ADMIN must remain.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-[#F7F9F8] border-t border-[#111816]/10 flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsRoleModalOpen(false)}
                className="px-4 py-2 text-[14px] font-semibold text-[#111816]/70 hover:text-[#111816] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                disabled={roleForm !== 'SUPER_ADMIN' && STAFF_DATA.role === 'SUPER_ADMIN'}
                onClick={() => setIsRoleModalOpen(false)}
                className={`px-5 py-2 rounded-[6px] text-[14px] font-semibold transition-colors shadow-sm ${roleForm !== 'SUPER_ADMIN' && STAFF_DATA.role === 'SUPER_ADMIN' ? 'bg-[#111816]/10 text-[#111816]/40 cursor-not-allowed' : 'bg-[#003B2D] text-white hover:bg-[#002B21] cursor-pointer'}`}
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {isSuspendModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#111816]/40 backdrop-blur-sm" onClick={() => setIsSuspendModalOpen(false)}></div>
          <div className="relative bg-white rounded-[12px] shadow-2xl w-full max-w-[440px] overflow-hidden animate-in zoom-in-95 duration-200">
            {STAFF_DATA.role === 'SUPER_ADMIN' ? (
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-[#FF7A66]/10 flex items-center justify-center mb-4">
                  <SemanticIcon concept="warning" className="w-6 h-6 text-[#FF7A66]" />
                </div>
                <h3 className="text-[18px] font-bold text-[#111816] mb-2">Cannot Suspend Staff</h3>
                <p className="text-[14px] text-[#111816]/60 leading-relaxed mb-6">
                  You cannot suspend <strong>{STAFF_DATA.name}</strong> because they are the last active <strong>SUPER_ADMIN</strong>. At least one active SUPER_ADMIN must remain on the platform.
                </p>
                <div className="flex justify-end">
                  <button 
                    onClick={() => setIsSuspendModalOpen(false)}
                    className="px-5 py-2 bg-[#F7F9F8] border border-[#111816]/10 text-[#111816] rounded-[6px] text-[14px] font-semibold hover:bg-[#111816]/5 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-6">
                  <div className="w-12 h-12 rounded-full bg-[#FF7A66]/10 flex items-center justify-center mb-4">
                    <SemanticIcon concept="warning" className="w-6 h-6 text-[#FF7A66]" />
                  </div>
                  <h3 className="text-[18px] font-bold text-[#111816] mb-2">Suspend Staff Member?</h3>
                  <p className="text-[14px] text-[#111816]/60 leading-relaxed mb-6">
                    You are about to suspend <strong>{STAFF_DATA.name}</strong>. This person will lose access to the SlotlyFlow admin platform immediately. Their activity history will be preserved.
                  </p>

                  <div>
                    <label className="block text-[13px] font-semibold text-[#111816] mb-1.5">Reason for suspension</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. No longer employed"
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#FF7A66] focus:ring-1 focus:ring-[#FF7A66]"
                    />
                  </div>
                </div>
                
                <div className="p-4 bg-[#F7F9F8] border-t border-[#111816]/10 flex items-center justify-end gap-3">
                  <button 
                    onClick={() => setIsSuspendModalOpen(false)}
                    className="px-4 py-2 text-[14px] font-semibold text-[#111816]/70 hover:text-[#111816] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={!suspendReason}
                    onClick={() => setIsSuspendModalOpen(false)}
                    className={`px-5 py-2 bg-[#FF7A66] text-white rounded-[6px] text-[14px] font-semibold transition-colors shadow-sm ${!suspendReason ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#e66d5b] cursor-pointer'}`}
                  >
                    Suspend Staff
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
