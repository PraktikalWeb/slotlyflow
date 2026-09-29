"use client";

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { SemanticIcon } from '@/src/icons/semantic-icon';

const SUB_DATA = {
  id: 'sub_1',
  business: {
    id: 'b_wansati',
    name: 'Wansati Brands',
    owner: 'owner@wansati.com',
  },
  plan: 'Standard Plan',
  amount: 'R399',
  cycle: 'Monthly',
  status: 'ACTIVE',
  startedDate: '17 Sep 2026',
  nextBillingDate: '17 Oct 2026',
  paymentProvider: 'Paystack',
  providerRef: 'sub_paystack_892jdn1',
  createdDate: '17 Sep 2026, 09:12 AM',
  hasFailedPayment: false,
  paymentMethod: {
    type: 'Visa',
    last4: '4242',
    expires: '08/28'
  },
  paymentHistory: [
    { id: 'p1', date: '17 Sep 2026', amount: 'R399.00', status: 'PAID', type: 'Subscription payment', ref: 'inv_12345' },
    { id: 'p2', date: '17 Aug 2026', amount: 'R399.00', status: 'PAID', type: 'Subscription payment', ref: 'inv_12344' },
    { id: 'p3', date: '17 Jul 2026', amount: 'R399.00', status: 'PAID', type: 'Subscription payment', ref: 'inv_12343' },
  ],
  timeline: [
    { id: 't1', action: 'Payment received', date: '17 Sep 2026, 14:02' },
    { id: 't2', action: 'Subscription automatically renewed', date: '17 Sep 2026, 14:01' },
    { id: 't3', action: 'Subscription created', date: '17 Jul 2026, 09:12', user: 'Alex Rivera' }
  ]
};

export default function AdminSubscriptionDetailPage({ params }: { params: Promise<{ subscriptionId: string }> }) {
  const router = useRouter();
  use(params);
  
  // Modals
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  
  const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false);
  const [changePlanForm, setChangePlanForm] = useState({ plan: 'Standard', cycle: 'Monthly' });

  return (
    <>
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-[1000px] mx-auto space-y-6">
          
          <button 
            onClick={() => router.push('/admin/subscriptions')}
            className="flex items-center gap-2 text-[13px] font-semibold text-[#111816]/60 hover:text-[#111816] w-fit mb-2 transition-colors cursor-pointer"
          >
            <SemanticIcon concept="back" className="w-4 h-4" />
            Back to Subscriptions
          </button>

          {/* Profile Header */}
          <div className="bg-white rounded-[16px] border border-[#111816]/10 p-6 flex flex-col md:flex-row md:items-start justify-between gap-6 shadow-sm">
            <div>
              <h1 className="text-[24px] font-bold text-[#111816] tracking-tight mb-2">{SUB_DATA.business.name}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[14px] font-medium text-[#111816]">{SUB_DATA.plan}</span>
                <span className="w-1 h-1 rounded-full bg-[#111816]/20"></span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-[#B7F34A]/20 text-[#003B2D] border border-[#B7F34A]/50 text-[11px] font-bold tracking-wide">
                  {SUB_DATA.status}
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => setIsCancelModalOpen(true)}
                className="px-4 py-2 bg-white border border-[#111816]/20 text-[#FF7A66] rounded-[6px] text-[13px] font-semibold hover:bg-[#FF7A66]/5 hover:border-[#FF7A66]/30 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-white border border-[#111816]/20 text-[#111816] rounded-[6px] text-[13px] font-semibold hover:bg-[#F7F9F8] transition-colors cursor-pointer">
                Pause
              </button>
              <button 
                onClick={() => setIsChangePlanModalOpen(true)}
                className="px-5 py-2 bg-[#003B2D] text-white rounded-[6px] text-[13px] font-semibold hover:bg-[#002B21] transition-colors cursor-pointer shadow-sm"
              >
                Change Plan
              </button>
            </div>
          </div>

          {/* Failed Payment Warning */}
          {SUB_DATA.hasFailedPayment && (
            <div className="bg-[#FF7A66]/10 border border-[#FF7A66]/20 rounded-[12px] p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-[#FF7A66]/20 shadow-sm">
                <SemanticIcon concept="warning" className="w-5 h-5 text-[#FF7A66]" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-[#FF7A66] mb-1">Payment Failed</h3>
                <p className="text-[14px] text-[#111816]/70 mb-3">
                  R399 payment could not be processed on 17 September 2026. Next automatic retry is scheduled for 19 September 2026.
                </p>
                <div className="flex gap-3">
                  <button className="px-3 py-1.5 bg-white border border-[#FF7A66]/20 rounded-[6px] text-[12px] font-semibold text-[#FF7A66] hover:bg-[#FF7A66]/5 transition-colors cursor-pointer shadow-sm">
                    Retry Payment
                  </button>
                  <button className="px-3 py-1.5 bg-transparent text-[12px] font-semibold text-[#111816]/70 hover:text-[#111816] hover:underline cursor-pointer">
                    Send Payment Link
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Details Card */}
              <div className="bg-white rounded-[12px] border border-[#111816]/10 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-[#111816]/10">
                  <h2 className="text-[16px] font-bold text-[#111816]">Subscription Details</h2>
                </div>
                <div className="p-6">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                    <div>
                      <dt className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-1.5">Business</dt>
                      <dd className="text-[14px] font-medium text-[#111816]">
                        <button className="text-[#003B2D] hover:underline cursor-pointer">{SUB_DATA.business.name}</button>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-1.5">Plan & Amount</dt>
                      <dd className="text-[14px] font-medium text-[#111816]">{SUB_DATA.plan} — {SUB_DATA.amount} / {SUB_DATA.cycle}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-1.5">Started</dt>
                      <dd className="text-[14px] font-medium text-[#111816]">{SUB_DATA.startedDate}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-1.5">Next Billing</dt>
                      <dd className="text-[14px] font-medium text-[#111816]">{SUB_DATA.nextBillingDate}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-1.5">Payment Provider</dt>
                      <dd className="text-[14px] font-medium text-[#111816]">{SUB_DATA.paymentProvider}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-1.5">Provider Reference</dt>
                      <dd className="text-[12px] font-mono font-medium text-[#111816] bg-[#F7F9F8] px-2 py-1 rounded border border-[#111816]/10 inline-block">{SUB_DATA.providerRef}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Payment History */}
              <div className="bg-white rounded-[12px] border border-[#111816]/10 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-[#111816]/10 flex items-center justify-between">
                  <h2 className="text-[16px] font-bold text-[#111816]">Payment History</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#111816]/5 bg-[#F7F9F8]/30">
                        <th className="py-2.5 px-5 text-[11px] font-semibold text-[#111816]/50 uppercase tracking-wider">Date</th>
                        <th className="py-2.5 px-5 text-[11px] font-semibold text-[#111816]/50 uppercase tracking-wider">Amount</th>
                        <th className="py-2.5 px-5 text-[11px] font-semibold text-[#111816]/50 uppercase tracking-wider">Status</th>
                        <th className="py-2.5 px-5 text-[11px] font-semibold text-[#111816]/50 uppercase tracking-wider">Type</th>
                        <th className="py-2.5 px-5 text-[11px] font-semibold text-[#111816]/50 uppercase tracking-wider text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#111816]/5">
                      {SUB_DATA.paymentHistory.map(payment => (
                        <tr key={payment.id} className="hover:bg-[#F7F9F8]/50 transition-colors">
                          <td className="py-3 px-5 text-[13px] text-[#111816]">{payment.date}</td>
                          <td className="py-3 px-5 text-[13px] font-medium text-[#111816]">{payment.amount}</td>
                          <td className="py-3 px-5">
                            <span className="text-[12px] font-bold text-[#003B2D]">{payment.status}</span>
                          </td>
                          <td className="py-3 px-5 text-[13px] text-[#111816]/60">{payment.type}</td>
                          <td className="py-3 px-5 text-right">
                            <button className="w-7 h-7 inline-flex items-center justify-center rounded-[4px] text-[#111816]/40 hover:text-[#111816] hover:bg-[#111816]/5 transition-colors cursor-pointer">
                              <SemanticIcon concept="download" className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              
              {/* Payment Method */}
              <div className="bg-white rounded-[12px] border border-[#111816]/10 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <SemanticIcon concept="creditCard" className="w-4 h-4 text-[#111816]/60" />
                  <h2 className="text-[14px] font-bold text-[#111816]">Payment Method</h2>
                </div>
                
                <div className="bg-[#F7F9F8] rounded-[8px] p-4 border border-[#111816]/5 flex items-center gap-3">
                  <div className="w-10 h-6 bg-white border border-[#111816]/10 rounded shadow-sm flex items-center justify-center text-[10px] font-bold text-[#111816] uppercase">
                    {SUB_DATA.paymentMethod.type}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[#111816]">•••• {SUB_DATA.paymentMethod.last4}</p>
                    <p className="text-[11px] text-[#111816]/50">Expires {SUB_DATA.paymentMethod.expires}</p>
                  </div>
                </div>
                
                <button className="w-full mt-4 py-2 bg-white border border-[#111816]/20 rounded-[6px] text-[13px] font-semibold text-[#111816] hover:bg-[#F7F9F8] transition-colors cursor-pointer">
                  Update Payment Method
                </button>
              </div>

              {/* Billing Adjustments (Internal Only) */}
              <div className="bg-[#F7F9F8] rounded-[12px] border border-[#111816]/10 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <SemanticIcon concept="shieldCheck" className="w-4 h-4 text-[#8B7CF6]" />
                  <h2 className="text-[14px] font-bold text-[#111816]">Manual Adjustments</h2>
                </div>
                <p className="text-[12px] text-[#111816]/60 mb-4">Staff actions for billing corrections or discounts.</p>
                
                <div className="space-y-2">
                  <button className="w-full text-left py-2 px-3 bg-white border border-[#111816]/10 rounded-[6px] text-[13px] font-semibold text-[#111816] hover:border-[#111816]/20 transition-colors cursor-pointer">
                    Apply Discount
                  </button>
                  <button className="w-full text-left py-2 px-3 bg-white border border-[#111816]/10 rounded-[6px] text-[13px] font-semibold text-[#111816] hover:border-[#111816]/20 transition-colors cursor-pointer">
                    Waive Next Payment
                  </button>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="bg-white rounded-[12px] border border-[#111816]/10 p-5 shadow-sm">
                <h2 className="text-[14px] font-bold text-[#111816] mb-4">Activity</h2>
                <div className="space-y-4">
                  {SUB_DATA.timeline.map((item, index) => (
                    <div key={item.id} className="flex gap-3 relative">
                      {index !== SUB_DATA.timeline.length - 1 && (
                        <div className="absolute left-[9px] top-5 bottom-[-16px] w-px bg-[#111816]/10"></div>
                      )}
                      <div className="w-[18px] h-[18px] rounded-full bg-[#F7F9F8] border border-[#111816]/20 flex items-center justify-center shrink-0 mt-0.5 z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#003B2D]"></div>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#111816] leading-tight">{item.action}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-[#111816]/50">{item.date}</span>
                          {item.user && (
                            <>
                              <span className="w-0.5 h-0.5 rounded-full bg-[#111816]/30"></span>
                              <span className="text-[11px] text-[#111816]/50">by {item.user}</span>
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

      {/* Change Plan Modal */}
      {isChangePlanModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#111816]/40 backdrop-blur-sm" onClick={() => setIsChangePlanModalOpen(false)}></div>
          <div className="relative bg-white rounded-[12px] shadow-2xl w-full max-w-[480px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#111816]/10">
              <h3 className="text-[18px] font-bold text-[#111816]">Change Plan</h3>
            </div>
            
            <div className="p-6">
              <div className="mb-6 p-4 rounded-[8px] bg-[#F7F9F8] border border-[#111816]/10 flex justify-between items-center">
                <div>
                  <p className="text-[12px] font-semibold text-[#111816]/50 uppercase tracking-wider mb-0.5">Current Plan</p>
                  <p className="text-[14px] font-medium text-[#111816]">{SUB_DATA.plan} ({SUB_DATA.cycle})</p>
                </div>
                <div className="text-right">
                  <p className="text-[16px] font-bold text-[#111816]">{SUB_DATA.amount}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#111816] mb-1.5">New Plan</label>
                  <select 
                    value={changePlanForm.plan}
                    onChange={(e) => setChangePlanForm({...changePlanForm, plan: e.target.value})}
                    className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23111816%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#111816] mb-1.5">Billing Cycle</label>
                  <select 
                    value={changePlanForm.cycle}
                    onChange={(e) => setChangePlanForm({...changePlanForm, cycle: e.target.value})}
                    className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23111816%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 p-4 bg-[#003B2D]/5 rounded-[6px] border border-[#003B2D]/10">
                <p className="text-[13px] text-[#003B2D] font-medium">This change will take effect immediately. The customer will be charged a prorated amount on their next invoice.</p>
              </div>
            </div>

            <div className="p-4 bg-[#F7F9F8] border-t border-[#111816]/10 flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsChangePlanModalOpen(false)}
                className="px-4 py-2 text-[14px] font-semibold text-[#111816]/70 hover:text-[#111816] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsChangePlanModalOpen(false)}
                className="px-5 py-2 bg-[#003B2D] text-white rounded-[6px] text-[14px] font-semibold hover:bg-[#002B21] transition-colors cursor-pointer shadow-sm"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#111816]/40 backdrop-blur-sm" onClick={() => setIsCancelModalOpen(false)}></div>
          <div className="relative bg-white rounded-[12px] shadow-2xl w-full max-w-[440px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-[#FF7A66]/10 flex items-center justify-center mb-4">
                <SemanticIcon concept="warning" className="w-6 h-6 text-[#FF7A66]" />
              </div>
              <h3 className="text-[18px] font-bold text-[#111816] mb-2">Cancel Subscription?</h3>
              <p className="text-[14px] text-[#111816]/60 leading-relaxed mb-6">
                You are about to cancel the subscription for <strong>{SUB_DATA.business.name}</strong>. Access will remain active until the end of the current billing cycle on {SUB_DATA.nextBillingDate}.
              </p>

              <div>
                <label className="block text-[13px] font-semibold text-[#111816] mb-1.5">Reason for cancellation</label>
                <select 
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#111816]/20 rounded-[6px] text-[14px] text-[#111816] focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23111816%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
                >
                  <option value="" disabled>Select a reason...</option>
                  <option value="Customer requested">Customer requested</option>
                  <option value="Payment issues">Payment issues</option>
                  <option value="Business closed">Business closed</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            
            <div className="p-4 bg-[#F7F9F8] border-t border-[#111816]/10 flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 text-[14px] font-semibold text-[#111816]/70 hover:text-[#111816] transition-colors cursor-pointer"
              >
                Keep Active
              </button>
              <button 
                disabled={!cancelReason}
                onClick={() => setIsCancelModalOpen(false)}
                className={`px-5 py-2 bg-[#FF7A66] text-white rounded-[6px] text-[14px] font-semibold transition-colors shadow-sm ${!cancelReason ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#e66d5b] cursor-pointer'}`}
              >
                Cancel Subscription
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
