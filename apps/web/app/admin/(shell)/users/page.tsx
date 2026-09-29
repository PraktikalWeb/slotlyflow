"use client";

import { SemanticIcon } from "@/src/icons/semantic-icon";
import Link from "next/link";

const USERS_DATA = [
  { id: 1, name: 'Emma Watson', email: 'emma@luminaspas.com', initial: 'E', businesses: [{ name: 'Lumina Spas', role: 'OWNER' }], emailVerified: true, platformRole: null, joined: 'Oct 12, 2023', status: 'active' },
  { id: 2, name: 'James Smith', email: 'james@velocity.com', initial: 'J', businesses: [{ name: 'Velocity Auto', role: 'ADMIN' }, { name: 'Velocity Downtown', role: 'ADMIN' }], emailVerified: true, platformRole: null, joined: 'Oct 11, 2023', status: 'active' },
  { id: 3, name: 'Sarah Jenkins', email: 'sarah.j@slotlyflow.com', initial: 'S', businesses: [], emailVerified: true, platformRole: 'SUPER_ADMIN', joined: 'Jan 04, 2023', status: 'active' },
  { id: 4, name: 'Mike Ross', email: 'mike@peakperformance.com', initial: 'M', businesses: [{ name: 'Peak Performance', role: 'AGENT' }], emailVerified: false, platformRole: null, joined: 'Yesterday, 14:22', status: 'suspended' },
  { id: 5, name: 'Alex Rivera', email: 'arivera@slotlyflow.com', initial: 'A', businesses: [], emailVerified: true, platformRole: 'SUPPORT', joined: 'Mar 15, 2023', status: 'active' },
  { id: 6, name: 'John Doe', email: 'john@acmedental.com', initial: 'J', businesses: [{ name: 'Acme Dental', role: 'OWNER' }], emailVerified: true, platformRole: null, joined: 'Sep 01, 2023', status: 'active' },
  { id: 7, name: 'Lisa Chen', email: 'lisa.chen@starlight.io', initial: 'L', businesses: [{ name: 'Starlight Studio', role: 'AGENT' }], emailVerified: true, platformRole: null, joined: 'Aug 22, 2023', status: 'active' },
];

export default function AdminUsersPage() {
  return (
    <main className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-[#111816] tracking-tight mb-1">Users</h1>
            <p className="text-[15px] text-[#111816]/60">View and manage people using SlotlyFlow across all Businesses.</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-[8px] border border-[#111816]/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-[400px]">
            <SemanticIcon concept="search" size="navigation" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#111816]/40" />
            <input 
              type="text" 
              placeholder="Search users by name, email, or business..." 
              className="w-full h-9 pl-9 pr-4 bg-white border border-[#111816]/20 rounded-[6px] text-[13px] text-[#111816] placeholder-[#111816]/40 focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-colors"
            />
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
            <select className="h-9 px-3 pr-8 bg-white border border-[#111816]/20 rounded-[6px] text-[13px] font-medium text-[#111816] focus:outline-none focus:border-[#003B2D] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23111816%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat">
              <option>All Roles</option>
              <option>Platform Staff</option>
              <option>Business Owner</option>
              <option>Admin</option>
              <option>Agent</option>
            </select>
            <select className="h-9 px-3 pr-8 bg-white border border-[#111816]/20 rounded-[6px] text-[13px] font-medium text-[#111816] focus:outline-none focus:border-[#003B2D] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23111816%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat">
              <option>All Status</option>
              <option>Active</option>
              <option>Suspended</option>
            </select>
            <select className="h-9 px-3 pr-8 bg-white border border-[#111816]/20 rounded-[6px] text-[13px] font-medium text-[#111816] focus:outline-none focus:border-[#003B2D] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23111816%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat">
              <option>Email: All</option>
              <option>Verified</option>
              <option>Unverified</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white border border-[#111816]/10 rounded-[8px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-[#111816]/10 bg-[#F7F9F8]">
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">User</th>
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Businesses</th>
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Email Status</th>
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Platform Access</th>
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Joined</th>
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111816]/10">
                {USERS_DATA.map((user) => (
                  <tr key={user.id} className="hover:bg-[#F7F9F8]/50 transition-colors group">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[6px] bg-[#8B7CF6]/10 text-[#8B7CF6] flex items-center justify-center text-[14px] font-bold shrink-0">
                          {user.initial}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[#111816] truncate">{user.name}</p>
                          <p className="text-[13px] text-[#111816]/60 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      {user.businesses.length === 0 ? (
                        <span className="text-[13px] text-[#111816]/40">—</span>
                      ) : user.businesses.length === 1 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-medium text-[#111816] truncate max-w-[120px]">{user.businesses[0].name}</span>
                          <span className="px-2 py-0.5 rounded-[4px] bg-[#003B2D]/5 text-[#003B2D] border border-[#003B2D]/10 text-[10px] font-bold tracking-wide">
                            {user.businesses[0].role}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[13.5px] font-medium text-[#111816] bg-[#F7F9F8] px-2.5 py-1 rounded-[4px] border border-[#111816]/10">
                          {user.businesses.length} Businesses
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5">
                      {user.emailVerified ? (
                        <div className="flex items-center gap-1.5 text-[13px] text-[#111816]">
                          <SemanticIcon concept="success" size="navigation" className="text-[#B7F34A]" />
                          Verified
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[13px] text-[#111816]/50">
                          <SemanticIcon concept="error" size="navigation" className="text-[#111816]/30" />
                          Unverified
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-5">
                      {user.platformRole === 'SUPER_ADMIN' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#8B7CF6] text-white text-[11px] font-semibold tracking-wide">
                          SUPER_ADMIN
                        </span>
                      ) : user.platformRole === 'SUPPORT' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#3CE6D0]/20 text-[#003B2D] text-[11px] font-semibold tracking-wide">
                          SUPPORT
                        </span>
                      ) : (
                        <span className="text-[13px] text-[#111816]/40">None</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-[13px] text-[#111816]/60">
                      {user.joined}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-[#FF7A66]'}`}></span>
                        <span className="text-[13px] capitalize text-[#111816]">{user.status}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Link 
                        href={`/admin/users/${user.id}`}
                        className="text-[13px] font-semibold text-[#003B2D] hover:underline opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 cursor-pointer"
                      >
                        View User
                      </Link>
                      <button className="p-1.5 text-[#111816]/40 hover:text-[#111816] hover:bg-[#111816]/5 rounded-[4px] transition-colors ml-2 md:hidden">
                        <SemanticIcon concept="menuHorizontal" size="navigation" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="px-5 py-4 border-t border-[#111816]/10 flex items-center justify-between bg-[#F7F9F8]/50">
            <span className="text-[13px] text-[#111816]/60 font-medium">
              Showing <strong className="text-[#111816]">1</strong> to <strong className="text-[#111816]">7</strong> of <strong className="text-[#111816]">2,451</strong> users
            </span>
            <div className="flex items-center gap-1.5">
              <button className="px-3 py-1.5 rounded-[6px] border border-[#111816]/10 bg-white text-[13px] font-medium text-[#111816]/60 hover:text-[#111816] hover:bg-[#F7F9F8] transition-colors">
                Previous
              </button>
              <button className="w-8 h-8 rounded-[6px] bg-[#003B2D] text-white text-[13px] font-semibold flex items-center justify-center">
                1
              </button>
              <button className="w-8 h-8 rounded-[6px] border border-transparent hover:bg-[#111816]/5 text-[#111816] text-[13px] font-medium flex items-center justify-center transition-colors">
                2
              </button>
              <button className="w-8 h-8 rounded-[6px] border border-transparent hover:bg-[#111816]/5 text-[#111816] text-[13px] font-medium flex items-center justify-center transition-colors">
                3
              </button>
              <span className="px-1 text-[#111816]/40">...</span>
              <button className="px-3 py-1.5 rounded-[6px] border border-[#111816]/10 bg-white text-[13px] font-medium text-[#111816]/60 hover:text-[#111816] hover:bg-[#F7F9F8] transition-colors">
                Next
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
