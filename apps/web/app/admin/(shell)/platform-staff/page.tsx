"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { SemanticIcon } from '@/src/icons/semantic-icon';

const MOCK_STAFF = [
  { id: 'staff_1', name: 'Sarah Jenkins', email: 'sarah@slotlyflow.com', role: 'SUPER_ADMIN', status: 'ACTIVE', added: '01 Jan 2024', lastActive: '2 mins ago' },
  { id: 'staff_2', name: 'David Chen', email: 'david@slotlyflow.com', role: 'SUPPORT', status: 'ACTIVE', added: '15 Mar 2024', lastActive: '1 hr ago' },
  { id: 'staff_3', name: 'Amira Patel', email: 'amira@slotlyflow.com', role: 'BILLING_ADMIN', status: 'ACTIVE', added: '10 Feb 2024', lastActive: 'Yesterday' },
  { id: 'staff_4', name: 'James Wilson', email: 'james.w@slotlyflow.com', role: 'OPERATIONS', status: 'SUSPENDED', added: '05 Apr 2024', lastActive: '12 Sep 2026' },
  { id: 'staff_5', name: 'Pending User', email: 'new.hire@slotlyflow.com', role: 'SUPPORT', status: 'INVITED', added: '17 Sep 2026', lastActive: '-' },
];

export default function PlatformStaffPage() {
  const [isInvitePanelOpen, setIsInvitePanelOpen] = useState(false);
  const [isInviteSuccess, setIsInviteSuccess] = useState(false);
  
  // Invite Form State
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'SUPPORT'
  });
  
  // Hardcoded to SUPER_ADMIN since the shell header toggle is stripped
  const currentUserRole = 'SUPER_ADMIN';
  const canManageStaff = currentUserRole === 'SUPER_ADMIN';

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email) return;
    
    // Simulate successful invite
    setIsInviteSuccess(true);
  };

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

  return (
    <>
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        {/* Page Header */}
        <div>
          <h2 className="text-[24px] font-bold text-[#111816] tracking-tight mb-1">Platform Staff</h2>
          <p className="text-[14px] text-[#111816]/60">Manage internal SlotlyFlow staff access and platform permissions.</p>
        </div>

        {/* Data Table Area */}
        <div className="bg-white border border-[#111816]/10 rounded-[12px] overflow-hidden flex flex-col shadow-sm">
          {/* Toolbar */}
          <div className="p-4 border-b border-[#111816]/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F7F9F8]/50">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative max-w-md w-full">
                <SemanticIcon concept="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#111816]/40" size="navigation" />
                <input 
                  type="text"
                  placeholder="Search name, email, or role..."
                  className="w-full h-10 pl-9 pr-4 bg-white border border-[#111816]/20 rounded-[6px] text-[13px] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-all placeholder:text-[#111816]/40 text-[#111816]"
                />
              </div>
              <div className="relative group">
                <button className="h-10 px-4 bg-white border border-[#111816]/20 rounded-[6px] flex items-center gap-2 text-[13px] font-medium text-[#111816]/70 hover:bg-[#F7F9F8] transition-colors cursor-pointer">
                  <SemanticIcon concept="filter" className="w-4 h-4" size="navigation" />
                  Filters
                </button>
                {/* Simulated Filter Dropdown Hover */}
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-[#111816]/10 rounded-[8px] shadow-lg py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="px-3 py-1 text-[11px] font-bold text-[#111816]/40 uppercase tracking-wider">Status</div>
                  <button className="w-full text-left px-4 py-1.5 text-[13px] text-[#111816] hover:bg-[#F7F9F8]">Active</button>
                  <button className="w-full text-left px-4 py-1.5 text-[13px] text-[#111816] hover:bg-[#F7F9F8]">Suspended</button>
                  <div className="px-3 py-1 mt-2 text-[11px] font-bold text-[#111816]/40 uppercase tracking-wider">Role</div>
                  <button className="w-full text-left px-4 py-1.5 text-[13px] text-[#111816] hover:bg-[#F7F9F8]">SUPER_ADMIN</button>
                  <button className="w-full text-left px-4 py-1.5 text-[13px] text-[#111816] hover:bg-[#F7F9F8]">SUPPORT</button>
                  <button className="w-full text-left px-4 py-1.5 text-[13px] text-[#111816] hover:bg-[#F7F9F8]">BILLING_ADMIN</button>
                  <button className="w-full text-left px-4 py-1.5 text-[13px] text-[#111816] hover:bg-[#F7F9F8]">OPERATIONS</button>
                </div>
              </div>
            </div>
            
            {canManageStaff && (
              <button 
                onClick={() => setIsInvitePanelOpen(true)}
                className="h-10 px-5 bg-[#003B2D] text-white rounded-[6px] flex items-center justify-center gap-2 text-[13px] font-semibold hover:bg-[#002B21] transition-colors cursor-pointer shrink-0"
              >
                <SemanticIcon concept="userPlus" className="w-4 h-4" size="navigation" />
                Invite Staff
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-[#111816]/10 bg-[#F7F9F8]/50">
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider w-[280px]">Staff Member</th>
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Role</th>
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Added</th>
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Last Active</th>
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111816]/5">
                {MOCK_STAFF.map((staff) => (
                  <tr key={staff.id} className="hover:bg-[#F7F9F8]/50 transition-colors group">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#F7F9F8] border border-[#111816]/10 flex items-center justify-center text-[12px] font-bold text-[#111816]">
                          {staff.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-[#111816]">{staff.name}</p>
                          <p className="text-[12px] text-[#111816]/50 truncate max-w-[200px]">{staff.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border text-[11px] font-bold tracking-wide ${getRoleColor(staff.role)}`}>
                        {staff.role}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border text-[11px] font-bold tracking-wide ${getStatusColor(staff.status)}`}>
                        {staff.status}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <p className="text-[13px] text-[#111816]">{staff.added}</p>
                    </td>
                    <td className="py-3 px-5">
                      <p className="text-[13px] text-[#111816]">{staff.lastActive}</p>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canManageStaff && (
                          <>
                            <button 
                              className="text-[13px] font-semibold text-[#111816]/50 hover:text-[#111816] transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button 
                              className={`text-[13px] font-semibold transition-colors cursor-pointer ${staff.status === 'SUSPENDED' ? 'text-[#003B2D] hover:text-[#002B21]' : 'text-[#FF7A66]/70 hover:text-[#FF7A66]'}`}
                            >
                              {staff.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                            </button>
                          </>
                        )}
                        <Link 
                          href={`/admin/platform-staff/${staff.id}`}
                          className="text-[13px] font-semibold text-[#003B2D] hover:underline cursor-pointer ml-2"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Invite Staff Side Panel */}
      {isInvitePanelOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-[#111816]/20 backdrop-blur-sm cursor-pointer transition-opacity" onClick={() => {
            setIsInvitePanelOpen(false);
            setIsInviteSuccess(false);
          }}></div>
          <div className="relative w-full max-w-[480px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {isInviteSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-[#B7F34A]/20 flex items-center justify-center mb-6">
                  <SemanticIcon concept="success" className="w-8 h-8 text-[#003B2D]" size="feature" />
                </div>
                <h2 className="text-[24px] font-bold text-[#111816] mb-2">Invitation Sent!</h2>
                <p className="text-[15px] text-[#111816]/70 leading-relaxed mb-8">
                  An invitation has been sent to <strong>{inviteForm.email}</strong>. They will need to confirm their account to activate the <strong className="text-[#111816]">{inviteForm.role}</strong> role.
                </p>
                <button 
                  onClick={() => {
                    setIsInvitePanelOpen(false);
                    setTimeout(() => setIsInviteSuccess(false), 300);
                  }}
                  className="h-12 px-8 bg-[#003B2D] text-white rounded-[6px] text-[15px] font-bold hover:bg-[#002B21] transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="h-16 px-6 border-b border-[#111816]/10 flex items-center justify-between shrink-0">
                  <h2 className="text-[16px] font-semibold text-[#111816] tracking-tight">Invite Staff</h2>
                  <button onClick={() => setIsInvitePanelOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-[#111816]/40 hover:text-[#111816] hover:bg-[#F7F9F8] transition-colors cursor-pointer">
                    <SemanticIcon concept="close" size="control" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  <p className="text-[14px] text-[#111816]/60 mb-6 leading-relaxed">
                    Invite someone to join the SlotlyFlow internal admin team.
                  </p>
                  
                  <form id="invite-form" onSubmit={handleInviteSubmit} className="space-y-5">
                    <div>
                      <label className="block text-[13px] font-semibold text-[#111816] mb-1.5">Full Name</label>
                      <input 
                        type="text"
                        required
                        value={inviteForm.name}
                        onChange={(e) => setInviteForm({...inviteForm, name: e.target.value})}
                        className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D]"
                        placeholder="e.g. Jane Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-[#111816] mb-1.5">Email Address</label>
                      <input 
                        type="email"
                        required
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                        className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D]"
                        placeholder="jane@slotlyflow.com"
                      />
                    </div>

                    <div className="pt-2">
                      <label className="block text-[13px] font-semibold text-[#111816] mb-3">Platform Role</label>
                      <div className="space-y-3">
                        
                        <label className={`block p-4 border rounded-[8px] cursor-pointer transition-all ${inviteForm.role === 'SUPER_ADMIN' ? 'border-[#8B7CF6] bg-[#8B7CF6]/5 ring-1 ring-[#8B7CF6]' : 'border-[#111816]/10 hover:border-[#111816]/30'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] font-bold text-[#111816]">SUPER_ADMIN</span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${inviteForm.role === 'SUPER_ADMIN' ? 'border-[#8B7CF6] bg-[#8B7CF6]' : 'border-[#111816]/30'}`}>
                              {inviteForm.role === 'SUPER_ADMIN' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                            </div>
                          </div>
                          <p className="text-[12px] text-[#111816]/60">Full platform administration access. Can manage all resources, staff, and billing.</p>
                          <input type="radio" name="role" value="SUPER_ADMIN" className="sr-only" checked={inviteForm.role === 'SUPER_ADMIN'} onChange={() => setInviteForm({...inviteForm, role: 'SUPER_ADMIN'})} />
                        </label>

                        <label className={`block p-4 border rounded-[8px] cursor-pointer transition-all ${inviteForm.role === 'SUPPORT' ? 'border-[#3CE6D0] bg-[#3CE6D0]/5 ring-1 ring-[#3CE6D0]' : 'border-[#111816]/10 hover:border-[#111816]/30'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] font-bold text-[#111816]">SUPPORT</span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${inviteForm.role === 'SUPPORT' ? 'border-[#3CE6D0] bg-[#3CE6D0]' : 'border-[#111816]/30'}`}>
                              {inviteForm.role === 'SUPPORT' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                            </div>
                          </div>
                          <p className="text-[12px] text-[#111816]/60">Can assist customers, view Businesses and operational information. No destructive access.</p>
                          <input type="radio" name="role" value="SUPPORT" className="sr-only" checked={inviteForm.role === 'SUPPORT'} onChange={() => setInviteForm({...inviteForm, role: 'SUPPORT'})} />
                        </label>

                        <label className={`block p-4 border rounded-[8px] cursor-pointer transition-all ${inviteForm.role === 'BILLING_ADMIN' ? 'border-[#B7F34A] bg-[#B7F34A]/10 ring-1 ring-[#B7F34A]' : 'border-[#111816]/10 hover:border-[#111816]/30'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] font-bold text-[#111816]">BILLING_ADMIN</span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${inviteForm.role === 'BILLING_ADMIN' ? 'border-[#B7F34A] bg-[#B7F34A]' : 'border-[#111816]/30'}`}>
                              {inviteForm.role === 'BILLING_ADMIN' && <div className="w-1.5 h-1.5 rounded-full bg-[#003B2D]"></div>}
                            </div>
                          </div>
                          <p className="text-[12px] text-[#111816]/60">Can manage subscriptions, payments and billing operations. No general staff management.</p>
                          <input type="radio" name="role" value="BILLING_ADMIN" className="sr-only" checked={inviteForm.role === 'BILLING_ADMIN'} onChange={() => setInviteForm({...inviteForm, role: 'BILLING_ADMIN'})} />
                        </label>

                        <label className={`block p-4 border rounded-[8px] cursor-pointer transition-all ${inviteForm.role === 'OPERATIONS' ? 'border-[#FF7A66] bg-[#FF7A66]/5 ring-1 ring-[#FF7A66]' : 'border-[#111816]/10 hover:border-[#111816]/30'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[13px] font-bold text-[#111816]">OPERATIONS</span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${inviteForm.role === 'OPERATIONS' ? 'border-[#FF7A66] bg-[#FF7A66]' : 'border-[#111816]/30'}`}>
                              {inviteForm.role === 'OPERATIONS' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                            </div>
                          </div>
                          <p className="text-[12px] text-[#111816]/60">Can manage platform operations, WhatsApp connection health and system issues.</p>
                          <input type="radio" name="role" value="OPERATIONS" className="sr-only" checked={inviteForm.role === 'OPERATIONS'} onChange={() => setInviteForm({...inviteForm, role: 'OPERATIONS'})} />
                        </label>

                      </div>
                    </div>
                  </form>
                </div>
                
                <div className="p-6 border-t border-[#111816]/10 bg-[#F7F9F8] flex items-center justify-end gap-3 shrink-0">
                  <button 
                    onClick={() => setIsInvitePanelOpen(false)}
                    className="px-4 py-2 rounded-[6px] text-[14px] font-semibold text-[#111816]/70 hover:text-[#111816] hover:bg-[#111816]/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    form="invite-form"
                    type="submit"
                    className="px-6 py-2 bg-[#003B2D] text-white rounded-[6px] text-[14px] font-semibold hover:bg-[#002B21] transition-colors cursor-pointer"
                  >
                    Send Invite
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
