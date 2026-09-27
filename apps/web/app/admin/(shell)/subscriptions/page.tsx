"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SemanticIcon } from '@/src/icons/semantic-icon';

const MOCK_SUBSCRIPTIONS = [
  { id: 'sub_1', business: 'Wansati Brands', ownerEmail: 'owner@wansati.com', plan: 'Standard', amount: 'R399', cycle: 'Monthly', status: 'ACTIVE', paymentStatus: 'PAID', nextBilling: '17 Oct 2026', started: '17 Sep 2026' },
  { id: 'sub_2', business: 'Peak Performance', ownerEmail: 'mike@peak.com', plan: 'Custom', amount: 'R899', cycle: 'Monthly', status: 'PAST_DUE', paymentStatus: 'FAILED', nextBilling: '15 Sep 2026', started: '15 Jan 2026' },
  { id: 'sub_3', business: 'Lumina Spas', ownerEmail: 'emma@luminaspas.com', plan: 'Standard', amount: 'R3,990', cycle: 'Yearly', status: 'ACTIVE', paymentStatus: 'PAID', nextBilling: '12 Oct 2027', started: '12 Oct 2023' },
  { id: 'sub_4', business: 'Velocity Auto', ownerEmail: 'james@velocity.com', plan: 'Standard', amount: 'R399', cycle: 'Monthly', status: 'PENDING', paymentStatus: 'PENDING', nextBilling: '20 Sep 2026', started: '20 Sep 2026' },
  { id: 'sub_5', business: 'Acme Dental', ownerEmail: 'john@acmedental.com', plan: 'Standard', amount: 'R399', cycle: 'Monthly', status: 'CANCELLED', paymentStatus: 'REFUNDED', nextBilling: '-', started: '01 Sep 2023' },
];

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);

  // Add Form State
  const [addForm, setAddForm] = useState({
    business: '',
    plan: 'Standard',
    amount: '399',
    cycle: 'Monthly',
    trial: false
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-700';
      case 'PENDING': return 'bg-[#F7F9F8] text-[#111816]/70 border-[#111816]/20';
      case 'TRIAL': return 'bg-[#8B7CF6]/20 text-[#8B7CF6] border-[#8B7CF6]/50';
      case 'PAST_DUE': return 'bg-[#FF7A66]/20 text-[#FF7A66] border-[#FF7A66]/50';
      case 'PAUSED': return 'bg-[#111816]/10 text-[#111816]/70 border-[#111816]/20';
      case 'CANCELLED': return 'bg-[#111816]/5 text-[#111816]/50 border-[#111816]/10';
      case 'EXPIRED': return 'bg-[#111816]/5 text-[#111816]/50 border-[#111816]/10';
      default: return 'bg-[#F7F9F8] text-[#111816]/70 border-[#111816]/20';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'text-[#003B2D]';
      case 'PENDING': return 'text-[#111816]/50';
      case 'FAILED': return 'text-[#FF7A66] font-semibold';
      case 'REFUNDED': return 'text-[#8B7CF6]';
      default: return 'text-[#111816]/50';
    }
  };

  return (
    <>
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-[1200px] mx-auto space-y-8">
          
          {/* Page Header */}
          <div>
            <h2 className="text-[24px] font-bold text-[#111816] tracking-tight mb-1">Subscriptions</h2>
            <p className="text-[14px] text-[#111816]/60">Monitor plans, billing status and recurring payments across SlotlyFlow.</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-[12px] border border-[#111816]/10">
              <p className="text-[13px] font-semibold text-[#111816]/60 uppercase tracking-wider mb-1">Active Subs</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-bold text-[#111816]">1,248</span>
                <span className="text-[12px] font-medium text-[#003B2D] bg-[#B7F34A]/20 px-1.5 py-0.5 rounded">+12 this week</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-[12px] border border-[#111816]/10">
              <p className="text-[13px] font-semibold text-[#111816]/60 uppercase tracking-wider mb-1">Trial / Pending</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-bold text-[#111816]">84</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-[12px] border border-[#111816]/10">
              <p className="text-[13px] font-semibold text-[#111816]/60 uppercase tracking-wider mb-1">Past Due</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-bold text-[#FF7A66]">12</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-[12px] border border-[#111816]/10">
              <p className="text-[13px] font-semibold text-[#111816]/60 uppercase tracking-wider mb-1">MRR</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-bold text-[#111816]">R495k</span>
              </div>
            </div>
          </div>

          {/* Data Table Area */}
          <div className="bg-white border border-[#111816]/10 rounded-[12px] overflow-hidden flex flex-col shadow-sm">
            {/* Toolbar */}
            <div className="p-4 border-b border-[#111816]/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F7F9F8]/50">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative max-w-md w-full">
                  <SemanticIcon concept="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111816]/40" />
                  <input 
                    type="text"
                    placeholder="Search business, email, or ref..."
                    className="w-full h-10 pl-9 pr-4 bg-white border border-[#111816]/20 rounded-[6px] text-[13px] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-all placeholder:text-[#111816]/40 text-[#111816]"
                  />
                </div>
                <button className="h-10 px-4 bg-white border border-[#111816]/20 rounded-[6px] flex items-center gap-2 text-[13px] font-medium text-[#111816]/70 hover:bg-[#F7F9F8] transition-colors cursor-pointer">
                  <SemanticIcon concept="filter" className="w-4 h-4" />
                  Filters
                </button>
                <button className="h-10 px-4 bg-white border border-[#111816]/20 rounded-[6px] flex items-center gap-2 text-[13px] font-medium text-[#111816]/70 hover:bg-[#F7F9F8] transition-colors cursor-pointer ml-auto md:ml-0 hidden md:flex">
                  <SemanticIcon concept="download" className="w-4 h-4" />
                  Export
                </button>
              </div>
              
              <button 
                onClick={() => setIsAddPanelOpen(true)}
                className="h-10 px-5 bg-[#003B2D] text-white rounded-[6px] flex items-center justify-center gap-2 text-[13px] font-semibold hover:bg-[#002B21] transition-colors cursor-pointer shrink-0"
              >
                <SemanticIcon concept="plus" className="w-4 h-4" />
                Add Subscription
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-[#111816]/10 bg-[#F7F9F8]/50">
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider w-[240px]">Business</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Plan</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Billing</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Payment</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider">Next Billing</th>
                    <th className="py-3 px-5 text-[12px] font-semibold text-[#111816]/60 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#111816]/5">
                  {MOCK_SUBSCRIPTIONS.map((sub) => (
                    <tr key={sub.id} className="hover:bg-[#F7F9F8]/50 transition-colors group">
                      <td className="py-3 px-5">
                        <p className="text-[14px] font-semibold text-[#111816]">{sub.business}</p>
                        <p className="text-[12px] text-[#111816]/50 truncate max-w-[200px]">{sub.ownerEmail}</p>
                      </td>
                      <td className="py-3 px-5">
                        <span className="text-[13px] font-medium text-[#111816] bg-[#F7F9F8] px-2 py-1 rounded border border-[#111816]/5">{sub.plan}</span>
                      </td>
                      <td className="py-3 px-5">
                        <p className="text-[13px] font-semibold text-[#111816]">{sub.amount}</p>
                        <p className="text-[12px] text-[#111816]/50">{sub.cycle}</p>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] border text-[11px] font-bold tracking-wide ${getStatusColor(sub.status)}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`text-[13px] font-medium ${getPaymentStatusColor(sub.paymentStatus)}`}>
                          {sub.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <p className="text-[13px] text-[#111816]">{sub.nextBilling}</p>
                        <p className="text-[11px] text-[#111816]/40">Started: {sub.started}</p>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button 
                          onClick={() => router.push(`/admin/subscriptions/${sub.id}`)}
                          className="text-[13px] font-semibold text-[#003B2D] hover:underline opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 cursor-pointer"
                        >
                          View
                        </button>
                        <button className="p-1.5 text-[#111816]/40 hover:text-[#111816] hover:bg-[#111816]/5 rounded-[4px] transition-colors ml-2 md:hidden">
                          <SemanticIcon concept="menuHorizontal" className="w-4 h-4" />
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
                Showing <strong className="text-[#111816]">1</strong> to <strong className="text-[#111816]">5</strong> of <strong className="text-[#111816]">1,344</strong> subscriptions
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
                <span className="px-1 text-[#111816]/40">...</span>
                <button className="px-3 py-1.5 rounded-[6px] border border-[#111816]/10 bg-white text-[13px] font-medium text-[#111816]/60 hover:text-[#111816] hover:bg-[#F7F9F8] transition-colors">
                  Next
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Add Subscription Side Panel */}
      {isAddPanelOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-[#111816]/20 backdrop-blur-sm cursor-pointer transition-opacity" onClick={() => setIsAddPanelOpen(false)}></div>
          <div className="relative w-full max-w-[480px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="h-16 px-6 border-b border-[#111816]/10 flex items-center justify-between shrink-0">
              <h2 className="text-[16px] font-semibold text-[#111816] tracking-tight">Add Subscription</h2>
              <button onClick={() => setIsAddPanelOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-[#111816]/40 hover:text-[#111816] hover:bg-[#F7F9F8] transition-colors cursor-pointer">
                <SemanticIcon concept="close" className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-[14px] text-[#111816]/60 mb-6 leading-relaxed">
                Create a new subscription for a business. If a payment method is not on file, customer authorization will be required.
              </p>
              
              <form className="space-y-5">
                <div>
                  <label className="block text-[13px] font-semibold text-[#111816] mb-1.5">Business</label>
                  <select 
                    value={addForm.business}
                    onChange={(e) => setAddForm({...addForm, business: e.target.value})}
                    className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23111816%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
                  >
                    <option value="" disabled>Search and select business...</option>
                    <option value="b1">Starlight Studio</option>
                    <option value="b2">Acme Dental</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#111816] mb-1.5">Plan</label>
                    <select 
                      value={addForm.plan}
                      onChange={(e) => setAddForm({...addForm, plan: e.target.value})}
                      className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23111816%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
                    >
                      <option value="Standard">Standard</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#111816] mb-1.5">Billing Cycle</label>
                    <select 
                      value={addForm.cycle}
                      onChange={(e) => setAddForm({...addForm, cycle: e.target.value})}
                      className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23111816%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#111816] mb-1.5">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#111816]/40 font-medium">R</span>
                    <input 
                      type="number"
                      value={addForm.amount}
                      onChange={(e) => setAddForm({...addForm, amount: e.target.value})}
                      className="w-full h-10 pl-7 pr-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D]"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center cursor-pointer group w-fit">
                    <div className="relative flex items-center justify-center w-4 h-4 mr-3 border border-[#111816]/20 rounded-[4px] bg-white group-hover:border-[#003B2D] transition-colors">
                      <input 
                        type="checkbox"
                        checked={addForm.trial}
                        onChange={(e) => setAddForm({...addForm, trial: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="absolute inset-0 bg-[#003B2D] rounded-[3px] scale-0 peer-checked:scale-100 transition-transform flex items-center justify-center">
                        <SemanticIcon concept="check" className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <span className="text-[13px] text-[#111816] select-none">Include 14-day trial period</span>
                  </label>
                </div>

                <div className="mt-6 p-4 rounded-[8px] bg-[#FF7A66]/10 border border-[#FF7A66]/20">
                  <p className="text-[13px] font-bold text-[#FF7A66] mb-1">Customer payment authorization required</p>
                  <p className="text-[12px] text-[#111816]/70">This business has no active payment method. Creating this subscription will generate a payment link that must be completed by the customer.</p>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-[#111816]/10 bg-[#F7F9F8] flex items-center justify-end gap-3 shrink-0">
              <button 
                onClick={() => setIsAddPanelOpen(false)}
                className="px-4 py-2 rounded-[6px] text-[14px] font-semibold text-[#111816]/70 hover:text-[#111816] hover:bg-[#111816]/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                className="px-6 py-2 bg-[#003B2D] text-white rounded-[6px] text-[14px] font-semibold hover:bg-[#002B21] transition-colors cursor-pointer"
              >
                Generate Payment Link
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
