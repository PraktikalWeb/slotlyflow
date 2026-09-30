"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SemanticIcon } from '../../src/icons/semantic-icon';
import { useDashboardContext } from '../../src/dashboard/dashboard-context';
import { AccountMenuContent, BusinessSwitcherMenuContent } from './DashboardMenuContent';
import {
  businessInitial,
  dashboardDisplayName,
  dashboardUserInitials,
} from '../../src/dashboard/dashboard-types';
import { useWhatsAppConnection } from '../../src/whatsapp/whatsapp-connection-context';

const NAV_ITEMS = [
  { name: 'Home', icon: 'overview' as const, path: '/dashboard' },
  { name: 'Inbox', icon: 'conversations' as const, badge: 2, path: '/dashboard/conversations' },
  { name: 'Automation', icon: 'bot' as const, path: '/dashboard/automations' },
  { name: 'Analytics', icon: 'chart' as const, path: '/dashboard/analytics' },
  { name: 'Team', icon: 'profile' as const, path: '/dashboard/team' },
  { name: 'WhatsApp', icon: 'whatsappConnection' as const, path: '/dashboard/whatsapp' },
];

export const DesktopSidebar = ({ isCollapsed, setIsCollapsed }: { isCollapsed: boolean, setIsCollapsed: (val: boolean) => void }) => {
  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOrgOpen, setIsOrgOpen] = useState(false);
  const { selectedMembership, user } = useDashboardContext();
  const { status: whatsappStatus } = useWhatsAppConnection();
  const activeBusiness = selectedMembership.organization;
  const displayName = dashboardDisplayName(user);
  const userInitials = dashboardUserInitials(user);

  const pathname = usePathname();

  let activeTab = 'Home';
  if (pathname.includes('conversations')) activeTab = 'Inbox';
  else if (pathname.includes('automations')) activeTab = 'Automation';
  else if (pathname.includes('analytics')) activeTab = 'Analytics';
  else if (pathname.includes('team')) activeTab = 'Team';
  else if (pathname.includes('whatsapp')) activeTab = 'WhatsApp';
  else if (pathname.includes('settings')) activeTab = 'Settings';
  else if (pathname.includes('profile')) activeTab = 'Profile';

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The existing client-only sidebar rendering begins after hydration.
    setMounted(true);
  }, []);

  const majorPageLoading = whatsappStatus === 'loading';
  const effectiveSidebarOpen = majorPageLoading ? false : (activeTab === 'Inbox' ? false : !isCollapsed);

  if (!mounted) {
    return <aside className="bg-[var(--brand-green)] text-white flex flex-col shrink-0 rounded-r-[var(--radius)] shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 w-[244px] hidden lg:flex"></aside>;
  }

  return (
    <aside 
      onClick={() => {
        if (!effectiveSidebarOpen && activeTab !== 'Inbox' && !majorPageLoading) setIsCollapsed(false);
      }}
      className={`bg-[var(--brand-green)] text-white flex-col shrink-0 rounded-r-[var(--radius)] shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-all duration-300 hidden lg:flex ${effectiveSidebarOpen ? 'w-[244px]' : 'w-[72px] cursor-pointer'} ${activeTab === 'Inbox' || majorPageLoading ? '!cursor-default' : ''}`}
    >
      
      {/* Logo */}
      <div className={`h-[80px] flex items-center shrink-0 ${effectiveSidebarOpen ? 'pl-[20px] pr-6' : 'justify-center'}`}>
        {effectiveSidebarOpen ? (
          <img 
            src="/slotlyflow-logo-inverse.png" 
            alt="SlotlyFlow" 
            className="w-[150px] h-auto object-contain -ml-1"
          />
        ) : (
          <img 
            src="/white_icon.png" 
            alt="SlotlyFlow Icon" 
            className="w-[36px] h-[36px] object-contain"
          />
        )}
      </div>
      
      {/* Organization / Business Switcher */}
      <div className="px-3 pb-3 relative">
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setIsOrgOpen(!isOrgOpen);
          }}
          className={`group relative flex items-center ${effectiveSidebarOpen ? 'px-2' : 'justify-center'} py-2 rounded-[var(--radius)] cursor-pointer transition-colors ${
            isOrgOpen ? 'bg-white/10 relative z-40' : 'hover:bg-white/10'
          }`}
        >
          <div className={`w-6 h-6 rounded-[var(--radius-xs)] bg-[#8b7cf6] flex items-center justify-center shrink-0 ${effectiveSidebarOpen ? 'mr-2.5' : ''}`}>
            <span className="text-white text-[11px] font-bold">{businessInitial(activeBusiness.name)}</span>
          </div>
          {effectiveSidebarOpen && (
            <>
              <div className="flex-1 min-w-0">
                <h2 className="text-[13px] font-semibold truncate text-white">{activeBusiness.name}</h2>
              </div>
              <div className={`shrink-0 transition-transform ${isOrgOpen ? 'rotate-180' : ''} flex items-center justify-center text-white/50 w-3.5 h-3.5`}>
                <SemanticIcon concept="chevronDown" className="w-3.5 h-3.5" size="metadata" />
              </div>
            </>
          )}

          {/* Tooltip for closed sidebar */}
          {!effectiveSidebarOpen && (
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[var(--flow-lime)] text-[#002B21] text-[12px] font-bold rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--flow-lime)] rotate-45"></div>
              <span className="relative z-10">{activeBusiness.name}</span>
            </div>
          )}
        </div>

        {/* Org Dropdown */}
        {isOrgOpen && (
          <>
            <div 
              className="fixed inset-0 z-30" 
              onClick={(e) => { e.stopPropagation(); setIsOrgOpen(false); }}
            ></div>
            <div className={`absolute ${effectiveSidebarOpen ? 'left-3 right-3 top-full mt-1' : 'left-[76px] top-0 w-[240px]'} bg-white rounded-[var(--radius)] shadow-lg py-1.5 z-40 overflow-hidden text-[var(--ink)]`}>
              <BusinessSwitcherMenuContent onClose={() => setIsOrgOpen(false)} />
            </div>
          </>
        )}
      </div>
      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.name;
          return (
            <Link 
              key={item.name} 
              href={item.path}
              onClick={(e) => { 
                e.stopPropagation();
              }} 
              className={`relative flex items-center ${effectiveSidebarOpen ? 'px-3' : 'justify-center'} py-2 rounded-[var(--radius)] text-[14px] transition-colors group cursor-pointer ${isActive ? 'bg-[var(--flow-lime)] text-[#002B21] font-bold shadow-sm' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
            >
              <div className={`relative flex items-center justify-center ${effectiveSidebarOpen ? 'mr-3' : ''}`}>
                <div className={`w-[18px] h-[18px] flex items-center justify-center ${isActive ? 'text-[#002B21]' : 'text-white/50 group-hover:text-white/80'}`}>
                  <SemanticIcon concept={item.icon} size="control" />
                </div>
                {item.badge && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#FF6B00] text-white text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] h-[16px] flex items-center justify-center shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>
              {effectiveSidebarOpen && (
                <span className="flex-1 truncate">{item.name}</span>
              )}

              {/* Tooltip for closed sidebar */}
              {!effectiveSidebarOpen && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[var(--flow-lime)] text-[#002B21] text-[12px] font-bold rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--flow-lime)] rotate-45"></div>
                  <span className="relative z-10">{item.name}</span>
                </div>
              )}
            </Link>
          );
        })}
      </nav>
      {/* User Profile at Bottom of Sidebar */}
      <div className="mt-auto px-3 pb-4 relative">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsProfileOpen(!isProfileOpen);
          }}
          className={`group w-full flex items-center ${effectiveSidebarOpen ? 'px-2' : 'justify-center'} py-2 rounded-[var(--radius)] border border-transparent transition-all cursor-pointer hover:bg-white/10 ${
            isProfileOpen ? 'bg-white/10 relative z-40' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-[#8b7cf6] flex items-center justify-center shrink-0 shadow-sm border border-white/10">
            <span className="text-[11px] font-bold text-white">{userInitials}</span>
          </div>
          {effectiveSidebarOpen && (
            <div className="flex-1 min-w-0 ml-3 text-left">
              <h2 className="text-[13px] font-semibold truncate text-white">{displayName}</h2>
            </div>
          )}

          {/* Tooltip for closed sidebar */}
          {!effectiveSidebarOpen && (
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[var(--flow-lime)] text-[#002B21] text-[12px] font-bold rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--flow-lime)] rotate-45"></div>
              <span className="relative z-10">{displayName}</span>
            </div>
          )}
        </button>

        {/* Profile Dropdown */}
        {isProfileOpen && (
          <>
            <div 
              className="fixed inset-0 z-30" 
              onClick={(e) => { e.stopPropagation(); setIsProfileOpen(false); }}
            ></div>
            <div className={`absolute ${effectiveSidebarOpen ? 'left-3 right-3 bottom-full mb-1' : 'left-[76px] bottom-0 w-[220px]'} bg-white rounded-[var(--radius)] shadow-lg py-1.5 z-40 overflow-hidden text-[var(--ink)] flex flex-col`}>
              <AccountMenuContent onClose={() => setIsProfileOpen(false)} />
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
