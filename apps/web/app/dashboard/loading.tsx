import React from 'react';

export default function DashboardLoading() {
  return (
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
  );
}
