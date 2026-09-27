"use client";

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SemanticIcon } from '@/src/icons/semantic-icon';
import Link from 'next/link';

// Mock user data based on ID 1
const USER_DATA = {
  id: '1',
  name: 'Emma Watson',
  email: 'emma@luminaspas.com',
  initial: 'E',
  emailVerified: true,
  status: 'active',
  joined: 'Oct 12, 2023',
  platformRole: null as string | null, // 'SUPER_ADMIN', 'SUPPORT', or null
  businesses: [
    { id: 'b1', name: 'Lumina Spas', role: 'OWNER', status: 'active', addedDate: 'Oct 12, 2023' },
    { id: 'b2', name: 'Lumina Downtown', role: 'ADMIN', status: 'active', addedDate: 'Nov 05, 2023' }
  ],
  activity: [
    { id: 1, action: 'Changed role in Lumina Downtown to ADMIN', date: 'Nov 05, 2023, 14:30' },
    { id: 2, action: 'Added to Lumina Downtown', date: 'Nov 05, 2023, 14:28' },
    { id: 3, action: 'Email verified', date: 'Oct 12, 2023, 09:15' },
    { id: 4, action: 'Account created', date: 'Oct 12, 2023, 09:12' }
  ]
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  use(params);
  const router = useRouter();
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [removingBusiness, setRemovingBusiness] = useState<string | null>(null);

  return (
    <>
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-[1000px] mx-auto space-y-8">
          
          {/* Back Button & Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Link 
              href="/admin/users"
              className="flex items-center text-[14px] font-semibold text-[#111816]/60 hover:text-[#111816] transition-colors w-fit group"
            >
              <SemanticIcon concept="back" className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
              Back to Users
            </Link>
            
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 rounded-[6px] border border-[#111816]/20 bg-white text-[13px] font-semibold text-[#111816] hover:bg-[#F7F9F8] transition-colors">
                Edit User
              </button>
              <button className="px-4 py-2 rounded-[6px] border border-[#FF7A66]/30 bg-[#FF7A66]/5 text-[13px] font-semibold text-[#FF7A66] hover:bg-[#FF7A66]/10 transition-colors flex items-center">
                Suspend User
              </button>
            </div>
          </div>

          {/* Profile Header Card */}
          <div className="bg-white rounded-[12px] border border-[#111816]/10 p-8 flex flex-col md:flex-row md:items-center gap-6 relative overflow-hidden">
            <div className="w-[88px] h-[88px] rounded-full bg-[#8B7CF6]/10 text-[#8B7CF6] flex items-center justify-center text-[36px] font-bold shrink-0">
              {USER_DATA.initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-[28px] font-bold text-[#111816] tracking-tight truncate">{USER_DATA.name}</h1>
                {USER_DATA.status === 'active' ? (
                  <span className="px-2.5 py-1 rounded-[6px] bg-[#B7F34A]/20 text-[#003B2D] text-[12px] font-bold uppercase tracking-wide flex items-center gap-1.5 border border-[#B7F34A]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#003B2D]"></span>
                    Active
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-[6px] bg-[#FF7A66]/10 text-[#FF7A66] text-[12px] font-bold uppercase tracking-wide flex items-center gap-1.5 border border-[#FF7A66]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A66]"></span>
                    Suspended
                  </span>
                )}
              </div>
              <p className="text-[15px] text-[#111816]/60 flex items-center gap-2 mb-3">
                <SemanticIcon concept="mail" className="w-4 h-4" />
                {USER_DATA.email}
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
                <div className="flex items-center gap-1.5 text-[#111816]/60">
                  <SemanticIcon concept="calendar" className="w-4 h-4 text-[#111816]/40" />
                  Joined {USER_DATA.joined}
                </div>
                {USER_DATA.emailVerified ? (
                  <div className="flex items-center gap-1.5 text-[#003B2D] font-medium">
                    <SemanticIcon concept="success" className="w-4 h-4 text-[#B7F34A]" />
                    Email Verified
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[#111816]/50">
                    <SemanticIcon concept="error" className="w-4 h-4 text-[#111816]/30" />
                    Email Unverified
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2 space-y-6">
              {/* Business Memberships */}
              <div className="bg-white rounded-[12px] border border-[#111816]/10 overflow-hidden">
                <div className="p-5 border-b border-[#111816]/10 flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold text-[#111816]">Business Memberships</h2>
                    <p className="text-[13px] text-[#111816]/60 mt-0.5">Businesses this user has access to.</p>
                  </div>
                  <button className="text-[13px] font-semibold text-[#003B2D] hover:underline">
                    Add to Business
                  </button>
                </div>
                
                {USER_DATA.businesses.length > 0 ? (
                  <div className="divide-y divide-[#111816]/10">
                    {USER_DATA.businesses.map(business => (
                      <div key={business.id} className="p-5 flex items-center justify-between hover:bg-[#F7F9F8]/50 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-[8px] bg-[#F7F9F8] border border-[#111816]/10 flex items-center justify-center text-[#111816]/40">
                            <SemanticIcon concept="organization" className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[#111816] mb-0.5">{business.name}</p>
                            <p className="text-[12px] text-[#111816]/50">Added {business.addedDate}</p>
                          </div>
                        </div>
                        
                          <div className="flex items-center gap-4 relative">
                            <span className="px-2 py-1 rounded-[4px] bg-[#003B2D]/5 text-[#003B2D] border border-[#003B2D]/10 text-[11px] font-bold tracking-wide">
                              {business.role}
                            </span>
                            <button 
                              onClick={() => setMenuOpenFor(menuOpenFor === business.id ? null : business.id)}
                              className="w-8 h-8 flex items-center justify-center text-[#111816]/40 hover:text-[#111816] hover:bg-[#111816]/5 rounded-[6px] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                            >
                              <SemanticIcon concept="menuVertical" className="w-4 h-4" />
                            </button>
                            
                            {/* Action Menu */}
                            {menuOpenFor === business.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setMenuOpenFor(null)}></div>
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-[6px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#111816]/10 py-1.5 z-50">
                                  <button className="w-full text-left px-4 py-2 text-[13px] font-medium text-[#111816]/70 hover:bg-[#F7F9F8] hover:text-[#111816] transition-colors cursor-pointer">
                                    Change Role
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setMenuOpenFor(null);
                                      setRemovingBusiness(business.id);
                                    }}
                                    className="w-full text-left px-4 py-2 text-[13px] font-medium text-[#FF7A66] hover:bg-[#F7F9F8] transition-colors cursor-pointer"
                                  >
                                    Remove from Business
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#F7F9F8] mx-auto flex items-center justify-center text-[#111816]/30 mb-3">
                      <SemanticIcon concept="organization" className="w-6 h-6" />
                    </div>
                    <p className="text-[14px] font-medium text-[#111816]">No Business Memberships</p>
                    <p className="text-[13px] text-[#111816]/50 mt-1">This user doesn't belong to any businesses.</p>
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              <div className="bg-white rounded-[12px] border border-[#111816]/10 overflow-hidden">
                <div className="p-5 border-b border-[#111816]/10">
                  <h2 className="text-[16px] font-bold text-[#111816]">Recent Activity</h2>
                  <p className="text-[13px] text-[#111816]/60 mt-0.5">Account-level actions and changes.</p>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {USER_DATA.activity.map((item, index) => (
                      <div key={item.id} className="flex gap-4 relative">
                        {index !== USER_DATA.activity.length - 1 && (
                          <div className="absolute left-2.5 top-6 bottom-[-24px] w-px bg-[#111816]/10"></div>
                        )}
                        <div className="w-5 h-5 rounded-full bg-[#F7F9F8] border border-[#111816]/10 flex items-center justify-center shrink-0 mt-0.5 z-10">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#003B2D]"></div>
                        </div>
                        <div>
                          <p className="text-[14px] font-medium text-[#111816]">{item.action}</p>
                          <p className="text-[12px] text-[#111816]/50 mt-0.5">{item.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (Side info) */}
            <div className="space-y-6">
              
              {/* Platform Access */}
              <div className="bg-white rounded-[12px] border border-[#111816]/10 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <SemanticIcon concept="warning" className="w-5 h-5 text-[#003B2D]" />
                  <h2 className="text-[15px] font-bold text-[#111816]">Platform Access</h2>
                </div>
                
                {USER_DATA.platformRole ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-[6px] bg-[#F7F9F8] border border-[#111816]/5">
                      <p className="text-[12px] text-[#111816]/60 mb-1 uppercase tracking-wide font-semibold">Current Role</p>
                      <p className="text-[14px] font-bold text-[#111816] flex items-center gap-2">
                        {USER_DATA.platformRole === 'SUPER_ADMIN' ? (
                          <span className="w-2 h-2 rounded-full bg-[#8B7CF6]"></span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#3CE6D0]"></span>
                        )}
                        {USER_DATA.platformRole}
                      </p>
                    </div>
                    <p className="text-[12px] text-[#111816]/60">This user is internal SlotlyFlow staff.</p>
                    <button className="text-[13px] font-semibold text-[#003B2D] hover:underline w-full text-left mt-2 block">
                      Manage in Platform Staff &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[14px] font-medium text-[#111816]">None</p>
                    <p className="text-[13px] text-[#111816]/60">This is a regular customer account.</p>
                  </div>
                )}
              </div>

              {/* Security & Account Info */}
              <div className="bg-white rounded-[12px] border border-[#111816]/10 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <SemanticIcon concept="shield" className="w-5 h-5 text-[#003B2D]" />
                  <h2 className="text-[15px] font-bold text-[#111816]">Security</h2>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-[#111816]/5">
                    <span className="text-[13px] text-[#111816]/60">2FA Enabled</span>
                    <span className="text-[13px] font-medium text-[#111816]">No</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#111816]/5">
                    <span className="text-[13px] text-[#111816]/60">Last Sign In</span>
                    <span className="text-[13px] font-medium text-[#111816]">Nov 05, 2023</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[13px] text-[#111816]/60">User ID</span>
                    <span className="text-[12px] font-mono text-[#111816] bg-[#F7F9F8] px-1.5 py-0.5 rounded border border-[#111816]/10">usr_{USER_DATA.id}82j9d</span>
                  </div>
                </div>
                
                <div className="mt-5 pt-5 border-t border-[#111816]/10">
                  <button className="text-[13px] font-semibold text-[#003B2D] hover:underline w-full text-left">
                    Send password reset email
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
      
      {/* Confirmation Modal */}
      {removingBusiness && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#111816]/40 backdrop-blur-sm" onClick={() => setRemovingBusiness(null)}></div>
          <div className="relative bg-white rounded-[12px] shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-[#FF7A66]/10 flex items-center justify-center mb-4">
                <SemanticIcon concept="warning" className="w-6 h-6 text-[#FF7A66]" />
              </div>
              <h3 className="text-[18px] font-bold text-[#111816] mb-2">Remove from Business?</h3>
              <p className="text-[14px] text-[#111816]/60 leading-relaxed">
                Are you sure you want to remove <strong>{USER_DATA.name}</strong> from this business? They will lose all access immediately.
              </p>
            </div>
            <div className="p-4 bg-[#F7F9F8] border-t border-[#111816]/10 flex items-center justify-end gap-3">
              <button 
                onClick={() => setRemovingBusiness(null)}
                className="px-4 py-2 text-[14px] font-semibold text-[#111816]/70 hover:text-[#111816] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => setRemovingBusiness(null)}
                className="px-5 py-2 bg-[#FF7A66] text-white rounded-[6px] text-[14px] font-semibold hover:bg-[#e66d5b] transition-colors cursor-pointer shadow-sm"
              >
                Remove User
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
