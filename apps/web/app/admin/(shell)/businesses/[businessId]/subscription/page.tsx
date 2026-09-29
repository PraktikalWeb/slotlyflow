"use client";

import { use, useState } from 'react';
import { SemanticIcon } from '@/src/icons/semantic-icon';

// Mock Subscription Data
const SUBSCRIPTION_DATA = {
  businessName: 'Wansati Brands',
  plan: 'Growth',
  status: 'ACTIVE',
  cycle: 'Monthly',
  price: 'ZAR 2,499.00',
  startDate: '12 Sep 2026',
  nextBillingDate: '12 Oct 2026',
  providerRef: 'sub_1Pqxyz2eZvKYlo2C9abc',
  paymentMethod: {
    type: 'card',
    brand: 'Visa',
    last4: '4242',
    expiry: '12/28'
  },
  discount: {
    code: 'BETA_LAUNCH_50',
    amountOff: 'ZAR 1,249.50',
    duration: 'Forever'
  },
  latestInvoiceStatus: 'PAID'
};

export default function AdminBusinessSubscriptionPage({ params }: { params: Promise<{ businessId: string }> }) {
  use(params);
  
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [actionReason, setActionReason] = useState('');

  const currentUserRole = 'SUPER_ADMIN'; // Mock role
  const canModifyBilling = currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'BILLING_ADMIN';

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        
        {/* Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <h1 className="text-[28px] font-bold text-[#111816] tracking-tight">Subscription</h1>
          
          <div className="flex items-center gap-3">
            {canModifyBilling && (
              <button 
                onClick={() => setIsChangeModalOpen(true)}
                className="px-4 py-2.5 rounded-[6px] font-medium text-[#111816] bg-white border border-[#111816]/10 hover:bg-[#F7F9F8] transition-colors shadow-sm text-sm cursor-pointer"
              >
                Change Plan
              </button>
            )}
            <div className="relative">
              <button 
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                className="p-2.5 rounded-[6px] font-medium text-[#111816]/70 bg-white border border-[#111816]/10 hover:bg-[#F7F9F8] transition-colors shadow-sm cursor-pointer"
              >
                <SemanticIcon concept="menuVertical" className="w-5 h-5" />
              </button>
              {isActionsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsActionsOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-48 z-50">
                    <div className="bg-white rounded-xl shadow-lg border border-[#111816]/10 py-1">
                  <button onClick={() => setIsActionsOpen(false)} className="w-full text-left px-4 py-2 text-sm text-[#111816]/70 hover:bg-[#F7F9F8] hover:text-[#003B2D] transition-colors cursor-pointer">
                    View Audit Log
                  </button>
                  <button onClick={() => setIsActionsOpen(false)} className="w-full text-left px-4 py-2 text-sm text-[#111816]/70 hover:bg-[#F7F9F8] hover:text-[#003B2D] transition-colors cursor-pointer">
                    Sync with Stripe
                  </button>
                  {canModifyBilling && (
                    <button onClick={() => { setIsActionsOpen(false); setIsCancelModalOpen(true); }}
                      className="w-full text-left px-4 py-2 text-sm text-[#FF7A66] hover:bg-[#FF7A66]/10 transition-colors border-t border-[#111816]/5 mt-1 pt-2 cursor-pointer"
                    >
                      Cancel Subscription
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
          <div className="flex items-center gap-6">
            <div>
              <div className="text-sm font-medium text-[#111816]/50 mb-1">Plan</div>
              <div className="text-xl font-bold text-[#111816]">{SUBSCRIPTION_DATA.plan}</div>
            </div>
            <div className="w-px h-10 bg-[#111816]/10"></div>
            <div>
              <div className="text-sm font-medium text-[#111816]/50 mb-1">Status</div>
              <div className="mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-green-500/10 text-green-700 text-[11px] font-bold border border-green-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></div>
                  {SUBSCRIPTION_DATA.status}
                </span>
              </div>
            </div>
            <div className="w-px h-10 bg-[#111816]/10"></div>
            <div>
              <div className="text-sm font-medium text-[#111816]/50 mb-1">Billing Cycle</div>
              <div className="text-lg font-semibold text-[#111816]">{SUBSCRIPTION_DATA.cycle}</div>
            </div>
            <div className="w-px h-10 bg-[#111816]/10"></div>
            <div>
              <div className="text-sm font-medium text-[#111816]/50 mb-1">Price</div>
              <div className="text-lg font-semibold text-[#111816]">{SUBSCRIPTION_DATA.price}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Billing Details */}
          <div className="bg-white rounded-2xl border border-[#111816]/10 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-[#111816]/5">
              <h2 className="text-lg font-bold text-[#111816]">Billing Details</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-[#111816]/50 mb-1">Start Date</div>
                  <div className="font-medium text-[#111816]">{SUBSCRIPTION_DATA.startDate}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-[#111816]/50 mb-1">Next Billing Date</div>
                  <div className="font-medium text-[#111816]">{SUBSCRIPTION_DATA.nextBillingDate}</div>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-[#111816]/50 mb-1">Payment Method</div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-12 h-8 bg-[#F7F9F8] rounded border border-[#111816]/10 flex items-center justify-center font-bold text-[#003B2D] text-xs uppercase">
                    {SUBSCRIPTION_DATA.paymentMethod.brand}
                  </div>
                  <div>
                    <div className="font-medium text-[#111816] text-sm">•••• •••• •••• {SUBSCRIPTION_DATA.paymentMethod.last4}</div>
                    <div className="text-xs text-[#111816]/50">Expires {SUBSCRIPTION_DATA.paymentMethod.expiry}</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#111816]/5">
                <div className="text-xs font-medium text-[#111816]/40 mb-1">Provider Reference (Stripe)</div>
                <div className="font-mono text-xs text-[#111816]/60 bg-[#F7F9F8] p-1.5 rounded border border-[#111816]/5 inline-block">{SUBSCRIPTION_DATA.providerRef}</div>
              </div>
            </div>
          </div>

          {/* Discount & Health */}
          <div className="space-y-6">
            
            {SUBSCRIPTION_DATA.discount && (
              <div className="bg-[#B7F34A]/5 rounded-2xl border border-[#B7F34A]/30 overflow-hidden shadow-sm relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#B7F34A]"></div>
                <div className="p-6">
                  <h2 className="text-[14px] font-bold text-[#003B2D] mb-4 flex items-center gap-2">
                    Active Discount
                    <span className="bg-[#B7F34A]/20 text-[#003B2D] text-[10px] uppercase px-2 py-0.5 rounded-full font-bold">Applied</span>
                  </h2>
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-[#003B2D]/70">Code</span>
                      <span className="font-mono font-bold text-[#003B2D] text-sm bg-white px-2 py-1 rounded border border-[#B7F34A]/20">{SUBSCRIPTION_DATA.discount.code}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-[#003B2D]/70">Duration</span>
                      <span className="text-sm font-semibold text-[#003B2D]">{SUBSCRIPTION_DATA.discount.duration}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-[#B7F34A]/20 mt-1">
                      <span className="text-sm font-medium text-[#003B2D]/70">Amount Off</span>
                      <span className="font-bold text-[#003B2D]">{SUBSCRIPTION_DATA.discount.amountOff} / cycle</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-[#111816]/10 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#111816] mb-5">Latest Payment Status</h2>
              
              <div className="flex items-center gap-4 p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <SemanticIcon concept="success" className="text-green-700 w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-green-800">Successfully Paid</div>
                  <div className="text-sm text-green-700/80">The most recent invoice was cleared successfully.</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Cancel Subscription Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-[#111816]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#111816]/10 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#FF7A66]/10 flex items-center justify-center shrink-0">
                <SemanticIcon concept="alert" className="text-[#FF7A66] w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-[#111816]">Cancel Subscription</h3>
            </div>
            <div className="p-6">
              <p className="text-[#111816]/70 mb-4 text-sm font-medium">
                You are about to cancel the <strong className="text-[#111816]">Growth</strong> plan for <strong className="text-[#111816]">Wansati Brands</strong>.
              </p>
              
              <div className="space-y-4 mb-6">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-[#111816]/10 hover:bg-[#F7F9F8] cursor-pointer transition-colors">
                  <input type="radio" name="cancelType" className="mt-1 text-[#003B2D] focus:ring-[#003B2D]" defaultChecked />
                  <div>
                    <div className="font-semibold text-[#111816] text-sm">Cancel at end of billing cycle</div>
                    <div className="text-xs text-[#111816]/60 mt-0.5">They will have access until {SUBSCRIPTION_DATA.nextBillingDate}.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-xl border border-[#FF7A66]/30 bg-[#FF7A66]/5 cursor-pointer transition-colors">
                  <input type="radio" name="cancelType" className="mt-1 text-[#FF7A66] focus:ring-[#FF7A66]" />
                  <div>
                    <div className="font-semibold text-[#FF7A66] text-sm">Cancel immediately</div>
                    <div className="text-xs text-[#FF7A66]/80 mt-0.5">Access will be revoked immediately. Prorated refunds must be handled manually in Stripe.</div>
                  </div>
                </label>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#111816]">Reason for cancellation</label>
                <textarea 
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Required for audit logs..."
                  className="w-full bg-[#F7F9F8] border border-[#111816]/10 rounded-xl px-4 py-3 text-[#111816] focus:outline-none focus:border-[#003B2D] transition-colors font-medium h-24 resize-none text-sm"
                ></textarea>
              </div>
            </div>
            <div className="p-6 border-t border-[#111816]/10 shrink-0 flex gap-3">
              <button 
                onClick={() => setIsCancelModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-[#111816]/70 hover:bg-[#F7F9F8] transition-colors border border-[#111816]/10"
              >
                Go Back
              </button>
              <button 
                disabled={!actionReason}
                onClick={() => setIsCancelModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-[#FF7A66] hover:bg-[#FF7A66]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {isChangeModalOpen && (
        <div className="fixed inset-0 bg-[#111816]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#111816]/10 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-[#111816]">Change Plan</h3>
              <button 
                onClick={() => setIsChangeModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F7F9F8] transition-colors cursor-pointer"
              >
                <SemanticIcon concept="close" className="w-5 h-5 text-[#111816]/50" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-3 mb-6">
                <label className="flex items-center justify-between p-4 rounded-xl border border-[#111816]/10 hover:bg-[#F7F9F8] cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <input type="radio" name="newPlan" className="text-[#003B2D] focus:ring-[#003B2D]" />
                    <div>
                      <div className="font-semibold text-[#111816] text-sm">Starter</div>
                      <div className="text-xs text-[#111816]/60">ZAR 999.00 / mo</div>
                    </div>
                  </div>
                </label>
                <label className="flex items-center justify-between p-4 rounded-xl border border-[#003B2D] bg-[#003B2D]/5 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <input type="radio" name="newPlan" className="text-[#003B2D] focus:ring-[#003B2D]" defaultChecked />
                    <div>
                      <div className="font-semibold text-[#111816] text-sm flex items-center gap-2">
                        Growth
                        <span className="bg-[#111816]/10 text-[#111816]/70 text-[10px] uppercase px-2 py-0.5 rounded-full font-bold">Current</span>
                      </div>
                      <div className="text-xs text-[#111816]/60">ZAR 2,499.00 / mo</div>
                    </div>
                  </div>
                </label>
                <label className="flex items-center justify-between p-4 rounded-xl border border-[#111816]/10 hover:bg-[#F7F9F8] cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <input type="radio" name="newPlan" className="text-[#003B2D] focus:ring-[#003B2D]" />
                    <div>
                      <div className="font-semibold text-[#111816] text-sm">Scale</div>
                      <div className="text-xs text-[#111816]/60">ZAR 4,999.00 / mo</div>
                    </div>
                  </div>
                </label>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[#111816]">Reason for change</label>
                <input 
                  type="text"
                  placeholder="e.g. Customer requested upgrade..."
                  className="w-full bg-[#F7F9F8] border border-[#111816]/10 rounded-xl px-4 py-3 text-[#111816] focus:outline-none focus:border-[#003B2D] transition-colors font-medium text-sm"
                />
              </div>
            </div>
            <div className="p-6 border-t border-[#111816]/10 shrink-0 flex gap-3">
              <button 
                onClick={() => setIsChangeModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-[#111816]/70 hover:bg-[#F7F9F8] transition-colors border border-[#111816]/10 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsChangeModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-[#003B2D] bg-[#B7F34A] hover:bg-[#a5e138] transition-colors shadow-sm cursor-pointer"
              >
                Update Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
