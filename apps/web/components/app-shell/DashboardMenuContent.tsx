'use client';

import Link from 'next/link';

import { useLogout } from '@/src/auth/logout-provider';
import { useDashboardContext } from '@/src/dashboard/dashboard-context';
import { businessInitial, dashboardDisplayName, dashboardUserInitials } from '@/src/dashboard/dashboard-types';
import { SemanticIcon } from '@/src/icons/semantic-icon';

export function BusinessSwitcherMenuContent({ onClose }: { readonly onClose: () => void }) {
  const { activeMemberships, selectBusiness, selectedMembership } = useDashboardContext();
  const activeBusiness = selectedMembership.organization;

  return (
    <>
      <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
        <p className="text-[11px] font-semibold text-[var(--ink-secondary)] uppercase tracking-wider">Your Businesses</p>
      </div>
      {activeMemberships.map((membership) => {
        const business = membership.organization;
        const isActive = activeBusiness.id === business.id;
        return (
          <div
            key={business.id}
            className={`group w-full flex items-center transition-all duration-200 ${
              isActive ? 'bg-[var(--flow-lime)] text-[#002B21]' : 'hover:bg-gray-100'
            }`}
          >
            <button
              onClick={() => {
                selectBusiness(business.id);
                onClose();
              }}
              className={`flex-1 flex items-center px-3 py-2 text-[13px] text-left cursor-pointer transition-all duration-200 ${
                !isActive ? 'group-hover:pl-4' : ''
              }`}
            >
              <div className="w-5 h-5 rounded-[var(--radius-xs)] bg-[#8b7cf6] flex items-center justify-center mr-2.5 shrink-0">
                <span className="text-white text-[10px] font-bold">{businessInitial(business.name)}</span>
              </div>
              <span className={`flex-1 truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>{business.name}</span>
            </button>
            <Link
              href="/dashboard/settings"
              onClick={onClose}
              className={`relative p-1.5 mr-2 rounded-md transition-all group/tooltip shrink-0 flex items-center justify-center ${
                isActive
                  ? 'text-[#002B21]/80 hover:text-[#002B21] hover:bg-[#002B21]/10 opacity-100'
                  : 'text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-gray-200 opacity-70 group-hover:opacity-100'
              }`}
            >
              <SemanticIcon concept="settings" className="w-[15px] h-[15px]" size="navigation" />
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-[var(--ink)] text-white text-[11px] font-medium rounded shadow-sm opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible whitespace-nowrap z-50 pointer-events-none">
                Business settings
              </div>
            </Link>
          </div>
        );
      })}
      <div className="px-3 py-2 mt-1 border-t border-[var(--border)] hidden">
        <Link
          href="/onboarding/business"
          onClick={onClose}
          className="w-full flex items-center px-3 py-2 text-[13px] text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--surface-subtle)] transition-colors rounded-[var(--radius-sm)] cursor-pointer"
        >
          <div className="w-4 h-4 mr-2.5 flex items-center justify-center"><SemanticIcon concept="plus" size="navigation" /></div>
          <span className="font-medium">Add a Business</span>
        </Link>
      </div>
    </>
  );
}

export function AccountMenuContent({ onClose }: { readonly onClose: () => void }) {
  const { user } = useDashboardContext();
  const { error: logoutError, isPending: isSigningOut, logout } = useLogout();
  const displayName = dashboardDisplayName(user);
  const userInitials = dashboardUserInitials(user);

  const handleSignOut = async () => {
    const completed = await logout();
    if (completed) onClose();
  };

  return (
    <>
      <div className="px-3 py-2 flex items-center mb-1 border-b border-[var(--border)] pb-3">
        <div className="w-8 h-8 rounded-full bg-[#8b7cf6] flex items-center justify-center shrink-0 shadow-sm border border-black/5 mr-3">
          <span className="text-[11px] font-bold text-white">{userInitials}</span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-[13px] font-semibold text-[var(--ink)] truncate">{displayName}</span>
          <span className="text-[12px] text-[var(--ink-tertiary)] truncate mt-0.5">Growthflow</span>
        </div>
      </div>

      <Link
        href="/dashboard/profile"
        onClick={onClose}
        className="w-full flex items-center px-3 py-2 text-[13px] text-[var(--ink-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] transition-colors cursor-pointer"
      >
        <div className="w-4 h-4 mr-2.5 flex items-center justify-center"><SemanticIcon concept="profile" size="navigation" /></div>
        Profile
      </Link>

      <button className="w-full flex items-center px-3 py-2 text-[13px] text-[var(--ink-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] transition-colors mb-1 border-b border-[var(--border)] pb-3 cursor-pointer">
        <div className="w-4 h-4 mr-2.5 flex items-center justify-center"><SemanticIcon concept="help" size="navigation" /></div>
        Help & Support
      </button>

      <button
        type="button"
        onClick={() => { void handleSignOut(); }}
        disabled={isSigningOut}
        className="w-full flex items-center px-3 py-2 mt-1 text-[13px] text-[var(--danger)] hover:bg-[#FEF2F2] transition-colors disabled:opacity-70 disabled:hover:bg-transparent cursor-pointer"
      >
        {isSigningOut ? (
          <>
            <div className="w-4 h-4 mr-2.5 flex items-center justify-center animate-spin"><SemanticIcon concept="loader" size="navigation" /></div>
            Signing out...
          </>
        ) : (
          <>
            <div className="w-4 h-4 mr-2.5 flex items-center justify-center"><SemanticIcon concept="logout" size="navigation" /></div>
            Sign Out
          </>
        )}
      </button>
      {logoutError !== undefined && (
        <p role="alert" className="mx-3 mt-1 text-[12px] leading-4 text-[var(--danger)]">
          {logoutError}
        </p>
      )}
    </>
  );
}
