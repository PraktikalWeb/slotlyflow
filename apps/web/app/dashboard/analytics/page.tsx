import React from 'react';
import { SemanticIcon } from '@/src/icons/semantic-icon';

export default function AnalyticsPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
      <div className="w-16 h-16 bg-[var(--surface)] rounded-full flex items-center justify-center text-[var(--ink-secondary)] mb-6 shadow-sm border border-[var(--border)]">
        <SemanticIcon concept="chart" size="control" className="w-8 h-8 opacity-70" />
      </div>
      
      <div className="flex flex-col items-center max-w-md">
        <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-strong)] text-[var(--ink-secondary)] text-[11px] font-bold tracking-wide uppercase mb-4">
          Coming Soon
        </div>
        
        <h1 className="text-[28px] font-semibold text-[var(--ink)] tracking-tight mb-3">
          Analytics
        </h1>
        
        <p className="text-[15px] text-[var(--ink-secondary)] leading-relaxed">
          Understand conversation activity, response performance, and how customers interact with your bot.
        </p>
      </div>
    </div>
  );
}
