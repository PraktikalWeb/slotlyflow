import React from 'react';

interface AlertProps {
  kind: 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function Alert({ kind, children, className = '', id }: AlertProps) {
  const isError = kind === 'error';
  const role = isError ? 'alert' : 'status';
  
  let styles = '';
  switch (kind) {
    case 'error':
      styles = 'border-[var(--danger)] bg-[#FFF6F4] text-[var(--ink)]';
      break;
    case 'success':
      styles = 'border-[var(--success)] bg-[var(--success)]/10 text-[var(--ink)]';
      break;
    case 'warning':
      styles = 'border-[var(--warning)] bg-[var(--warning)]/10 text-[var(--ink)]';
      break;
    case 'info':
      styles = 'border-[var(--brand-green)] bg-[var(--brand-green)]/10 text-[var(--ink)]';
      break;
  }

  return (
    <div
      id={id}
      role={role}
      className={"border-l-2 px-3 py-2 text-[13px] " + styles + (className ? " " + className : "")}
    >
      {children}
    </div>
  );
}
