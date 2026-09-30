import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="flex h-screen bg-[var(--canvas)] font-['Spline_Sans'] overflow-hidden text-[var(--ink)] [height:100dvh] lg:[height:100vh]">
      
      {/* DESKTOP SIDEBAR SKELETON */}
      <aside className="bg-[var(--brand-green)] text-white flex-col shrink-0 rounded-r-[var(--radius)] shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 hidden lg:flex w-[244px]"></aside>
      
      <main className="flex-1 flex flex-col min-w-0 bg-[var(--canvas)] overflow-hidden">
        
        {/* MOBILE HEADER SKELETON */}
        <header className="lg:hidden sticky top-0 z-30 bg-[var(--canvas)] border-b border-[var(--border)] h-[60px] flex items-center justify-between px-4">
          <div className="w-[120px] h-6 bg-[var(--surface-subtle)] rounded-[var(--radius-sm)] animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] animate-pulse" />
          </div>
        </header>

        {/* DESKTOP HEADER SKELETON */}
        <div className="hidden lg:flex h-[72px] shrink-0 items-center justify-between border-b border-[var(--border)] bg-white px-8">
           <div className="w-6 h-6 bg-[var(--surface-subtle)] rounded-[var(--radius-sm)] animate-pulse" />
           <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] animate-pulse" />
             <div className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] animate-pulse" />
           </div>
        </div>
        
        {/* CONTENT SKELETON */}
        <div className="mobile-dashboard-scroll min-h-0 flex-1 overflow-y-auto pt-1 lg:pt-0">
          <div className="max-w-[1440px] mx-auto p-4 pt-5 space-y-6 sm:p-6 lg:px-8 lg:py-8">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="h-[120px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] animate-pulse" />
                <div className="h-[120px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] animate-pulse" />
                <div className="h-[120px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] animate-pulse" />
              </div>
              <div className="h-[360px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] animate-pulse" />
            </div>
          </div>
        </div>

      </main>

      {/* MOBILE BOTTOM NAV SKELETON */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="mx-4 mb-4 bg-[var(--surface)] border border-[var(--border-strong)] rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex items-center justify-around px-2 py-2 pointer-events-auto">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex flex-col items-center justify-center w-12 h-[52px]">
              <div className="w-6 h-6 rounded-full bg-[var(--surface-subtle)] animate-pulse mb-1" />
              <div className="w-8 h-1.5 rounded-[var(--radius-pill)] bg-[var(--surface-subtle)] animate-pulse" />
            </div>
          ))}
        </div>
      </nav>
      
    </div>
  );
}
