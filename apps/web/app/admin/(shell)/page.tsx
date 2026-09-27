"use client";

import { SemanticIcon } from "@/src/icons/semantic-icon";
import { NEEDS_ATTENTION, RECENT_BUSINESSES, RECENT_ACTIVITY } from "@/mocks/admin";

export default function AdminDashboardPage() {
  return (
    <main className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        {/* Page Header */}
        <div>
          <h1 className="text-[28px] font-bold text-[#111816] tracking-tight mb-1">Dashboard</h1>
          <p className="text-[15px] text-[#111816]/60">A live view of your SlotlyFlow platform.</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Businesses', value: '1,248', trend: '+12 this week' },
            { label: 'Active WhatsApp', value: '1,192', trend: '95.5% connect rate' },
            { label: 'Active Subscriptions', value: '1,105', trend: '88.5% paid rate' },
            { label: 'Issues Requiring Attention', value: '12', trend: '4 high severity', alert: true }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-[8px] border border-[#111816]/10">
              <p className="text-[13px] font-medium text-[#111816]/60 mb-2">{stat.label}</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-[28px] font-bold ${stat.alert ? 'text-[#FF7A66]' : 'text-[#111816]'}`}>
                  {stat.value}
                </span>
              </div>
              <p className="text-[12px] font-medium text-[#111816]/40">{stat.trend}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Needs Attention (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-[16px] font-bold text-[#111816] flex items-center gap-2">
              <SemanticIcon concept="alert" className="text-[#FF7A66]" />
              Needs Attention
            </h2>
            <div className="bg-white border border-[#111816]/10 rounded-[8px] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#111816]/10 bg-[#F7F9F8]">
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Business</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Problem</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Time</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#111816]/10">
                  {NEEDS_ATTENTION.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F7F9F8]/50 transition-colors">
                      <td className="py-4 px-5 text-[14px] font-medium text-[#111816]">{item.business}</td>
                      <td className="py-4 px-5 text-[14px] text-[#111816]/80 flex items-center gap-2">
                        {item.severity === 'high' ? (
                          <SemanticIcon concept="error" className="text-[#FF7A66]" />
                        ) : (
                          <SemanticIcon concept="alert" className="text-[#F5A623]" />
                        )}
                        {item.problem}
                      </td>
                      <td className="py-4 px-5 text-[13px] text-[#111816]/50">{item.time}</td>
                      <td className="py-4 px-5 text-right">
                        <button className="text-[13px] font-medium text-[#003B2D] hover:underline">
                          Resolve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recent Businesses */}
            <h2 className="text-[16px] font-bold text-[#111816] mt-8 mb-4">Recent Businesses</h2>
            <div className="bg-white border border-[#111816]/10 rounded-[8px] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#111816]/10 bg-[#F7F9F8]">
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Business & Owner</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Joined</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#111816]/10">
                  {RECENT_BUSINESSES.map((biz) => (
                    <tr key={biz.id} className="hover:bg-[#F7F9F8]/50 transition-colors">
                      <td className="py-3 px-5">
                        <div className="text-[14px] font-medium text-[#111816]">{biz.name}</div>
                        <div className="text-[13px] text-[#111816]/50">{biz.owner}</div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex gap-2">
                          {biz.whatsapp === 'connected' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#B7F34A]/20 text-[#003B2D] text-[11px] font-semibold tracking-wide">
                              <SemanticIcon concept="success" size="metadata" className="text-[#003B2D]" /> WA
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#111816]/5 text-[#111816]/60 text-[11px] font-semibold tracking-wide">
                              <SemanticIcon concept="clock" size="metadata" className="text-[#111816]/60" /> WA
                            </span>
                          )}
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#8B7CF6]/10 text-[#8B7CF6] text-[11px] font-semibold tracking-wide">
                            {biz.sub}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-[13px] text-[#111816]/50">{biz.joined}</td>
                      <td className="py-3 px-5 text-right">
                        <button className="p-1.5 text-[#111816]/40 hover:text-[#111816] hover:bg-[#111816]/5 rounded-[4px] transition-colors">
                          <SemanticIcon concept="menuHorizontal" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 border-t border-[#111816]/10 text-center">
                <button className="text-[13px] font-semibold text-[#003B2D] hover:underline flex items-center justify-center gap-1 w-full">
                  View all businesses <SemanticIcon concept="arrowRight" className="ml-1" />
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar content (1/3 width) */}
          <div className="space-y-8">
            
            {/* WhatsApp Health */}
            <div>
              <h2 className="text-[16px] font-bold text-[#111816] mb-4">WhatsApp Health</h2>
              <div className="bg-white border border-[#111816]/10 rounded-[8px] p-5">
                <div className="flex items-end justify-between mb-6">
                  <div>
                    <div className="text-[32px] font-bold text-[#111816] leading-none mb-1">1,248</div>
                    <div className="text-[13px] font-medium text-[#111816]/60">Total Numbers</div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#B7F34A]/20 flex items-center justify-center">
                    <SemanticIcon concept="conversations" className="text-[#003B2D]" />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-[#111816]/70">
                      <span className="w-2 h-2 rounded-full bg-[#3CE6D0]"></span> Connected
                    </span>
                    <span className="font-semibold text-[#111816]">1,192</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-[#111816]/70">
                      <span className="w-2 h-2 rounded-full bg-[#F5A623]"></span> Pending
                    </span>
                    <span className="font-semibold text-[#111816]">41</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-[#111816]/70">
                      <span className="w-2 h-2 rounded-full bg-[#FF7A66]"></span> Failed / Offline
                    </span>
                    <span className="font-semibold text-[#111816]">15</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Feed */}
            <div>
              <h2 className="text-[16px] font-bold text-[#111816] mb-4">Platform Activity</h2>
              <div className="bg-white border border-[#111816]/10 rounded-[8px] p-5">
                <div className="space-y-4">
                  {RECENT_ACTIVITY.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#111816]/20 mt-1.5 shrink-0"></div>
                      <div>
                        <p className="text-[13px] text-[#111816] leading-snug">{activity.text}</p>
                        <p className="text-[11px] font-medium text-[#111816]/40 mt-0.5">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="text-[13px] font-semibold text-[#003B2D] hover:underline mt-6 flex items-center justify-center gap-1 w-full">
                  View audit log <SemanticIcon concept="arrowRight" className="ml-1" />
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}
