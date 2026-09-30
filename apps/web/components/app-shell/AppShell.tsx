"use client";
import React, { useState, useEffect } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { DashboardHeader } from './DashboardHeader';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import type { MobileMenu } from './mobile-menu';
import { DashboardProvider } from '@/src/dashboard/dashboard-context';
import type { DashboardBusinessMembership, DashboardUser } from '@/src/dashboard/dashboard-types';
import { WhatsAppConnectionProvider } from '@/src/whatsapp/whatsapp-connection-context';

export default function AppShell({
  children,
  memberships,
  user,
}: {
  children: React.ReactNode;
  memberships: readonly DashboardBusinessMembership[];
  user: DashboardUser;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [openMobileMenu, setOpenMobileMenu] = useState<MobileMenu>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- Mount hydration and stored sidebar preference are intentionally synchronized after the client mounts. */
    setMounted(true);
    const stored = localStorage.getItem('slotlyflow_sidebar_collapsed');
    if (stored === 'true') {
      setIsSidebarCollapsed(true);
    }
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const updateDesktop = () => setIsDesktop(desktopQuery.matches);
    updateDesktop();
    desktopQuery.addEventListener('change', updateDesktop);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => desktopQuery.removeEventListener('change', updateDesktop);
  }, []);

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('slotlyflow_sidebar_collapsed', newState.toString());
  };

  return (
    <DashboardProvider memberships={memberships} user={user}>
      <WhatsAppConnectionProvider>
        <div className="flex h-screen bg-[var(--canvas)] font-['Spline_Sans'] overflow-hidden text-[var(--ink)] [height:100dvh] lg:[height:100vh]">
      
      <DesktopSidebar 
        isCollapsed={mounted ? isSidebarCollapsed : false} 
        setIsCollapsed={setIsSidebarCollapsed} 
      />
      
      <main className="flex-1 flex flex-col min-w-0 bg-[var(--canvas)] overflow-hidden">
        <MobileHeader openMenu={openMobileMenu} setOpenMenu={setOpenMobileMenu} />
        
        {mounted && isDesktop && (
          <div className="hidden lg:block">
            <DashboardHeader 
              toggleSidebar={toggleSidebar} 
              isSidebarCollapsed={isSidebarCollapsed} 
            />
          </div>
        )}
        
        <div className="mobile-dashboard-scroll min-h-0 flex-1 overflow-y-auto pt-1 lg:pt-0">
          {children}
        </div>
      </main>
      
      <MobileBottomNav openMenu={openMobileMenu} setOpenMenu={setOpenMobileMenu} />
        </div>
      </WhatsAppConnectionProvider>
    </DashboardProvider>
  );
}
