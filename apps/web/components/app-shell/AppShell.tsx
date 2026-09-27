"use client";
import React, { useState, useEffect } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { DashboardHeader } from './DashboardHeader';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
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

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('slotlyflow_sidebar_collapsed');
    if (stored === 'true') {
      setIsSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('slotlyflow_sidebar_collapsed', newState.toString());
  };

  return (
    <DashboardProvider memberships={memberships} user={user}>
      <WhatsAppConnectionProvider>
        <div className="flex h-screen bg-[var(--canvas)] font-['Spline_Sans'] overflow-hidden text-[var(--ink)]">
      
      <DesktopSidebar 
        isCollapsed={mounted ? isSidebarCollapsed : false} 
        setIsCollapsed={setIsSidebarCollapsed} 
      />
      
      <main className="flex-1 flex flex-col min-w-0 bg-[var(--canvas)] overflow-hidden">
        <MobileHeader />
        
        {mounted && (
          <div className="hidden lg:block">
            <DashboardHeader 
              toggleSidebar={toggleSidebar} 
              isSidebarCollapsed={isSidebarCollapsed} 
            />
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
      
      <MobileBottomNav />
        </div>
      </WhatsAppConnectionProvider>
    </DashboardProvider>
  );
}
