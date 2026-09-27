"use client";
import Link from 'next/link';
import React from 'react';
import { SemanticIcon } from '../../src/icons/semantic-icon';
import { useDashboardContext } from '../../src/dashboard/dashboard-context';
import { businessInitial, dashboardUserInitials, dashboardDisplayName } from '../../src/dashboard/dashboard-types';

export const MobileHeader = () => {
  const [isBusinessMenuOpen, setIsBusinessMenuOpen] = React.useState(false);
  const { activeMemberships, selectBusiness, selectedMembership, user } = useDashboardContext();
  const selectedBusiness = selectedMembership.organization;

  return (
    <header className="mobile-header">
      <div className="flex items-center gap-2 font-bold text-white">
        {/* Placeholder Logo for mobile header */}
        <div className="h-8 w-8 border border-dashed border-white/30 flex items-center justify-center text-[10px]">Logo</div>
        <span className="text-sm">SlotlyFlow</span>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1.5 bg-black/15 px-3 py-1.5 rounded-sm text-sm"
            aria-haspopup="menu"
            aria-expanded={isBusinessMenuOpen}
            aria-label={`Switch Business: ${selectedBusiness.name}`}
            onClick={() => setIsBusinessMenuOpen((open) => !open)}
          >
            <SemanticIcon concept="organization" className="w-4 h-4" size="navigation" />
            <span className="font-medium max-w-[100px] truncate">{selectedBusiness.name}</span>
          </button>

          {isBusinessMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Close Business menu"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setIsBusinessMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-40 mt-2 w-[240px] overflow-hidden rounded-[var(--radius)] bg-white py-1.5 text-[var(--ink)] shadow-lg" role="menu" aria-label="Your Businesses">
                <div className="border-b border-[var(--border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)]">Your Businesses</div>
                {activeMemberships.map((membership) => {
                  const business = membership.organization;
                  const isSelected = business.id === selectedBusiness.id;
                  return (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      key={business.id}
                      onClick={() => {
                        selectBusiness(business.id);
                        setIsBusinessMenuOpen(false);
                      }}
                      className={`flex w-full items-center px-3 py-2 text-left text-[13px] ${isSelected ? 'bg-[var(--flow-lime)] font-semibold text-[#002B21]' : 'hover:bg-[var(--surface-subtle)]'}`}
                    >
                      <span className="mr-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[#8b7cf6] text-[10px] font-bold text-white">{businessInitial(business.name)}</span>
                      <span className="min-w-0 flex-1 truncate">{business.name}</span>
                    </button>
                  );
                })}
                <div className="mt-1 border-t border-[var(--border)] px-3 py-2 hidden">
                  <Link href="/onboarding/business" onClick={() => setIsBusinessMenuOpen(false)} className="flex items-center rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]">
                    <SemanticIcon concept="plus" className="mr-2.5 h-4 w-4" size="navigation" />
                    Add a Business
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
        
        <Link
          href="/dashboard/profile"
          className="h-8 w-8 rounded-full bg-[var(--flow-violet)] flex items-center justify-center text-xs font-semibold"
          aria-label={`Profile for ${dashboardDisplayName(user)}`}
        >
          {dashboardUserInitials(user)}
        </Link>
      </div>
    </header>
  );
};
