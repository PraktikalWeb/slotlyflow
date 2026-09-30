"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { PortalMenu } from '@/components/feedback/PortalMenu';
import { NavLink } from '@/components/navigation/NavLink';
import { useDashboardContext } from '@/src/dashboard/dashboard-context';
import { dashboardDisplayName, dashboardUserInitials } from '@/src/dashboard/dashboard-types';
import { SemanticIcon } from '@/src/icons/semantic-icon';
import { AccountMenuContent } from './DashboardMenuContent';
import type { MobileMenu } from './mobile-menu';

const MORE_ITEMS = [
  { label: 'Analytics', href: '/dashboard/analytics', icon: 'chart' },
  { label: 'Team', href: '/dashboard/team', icon: 'profile' },
  { label: 'WhatsApp', href: '/dashboard/whatsapp', icon: 'whatsappConnection' },
  { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
] as const;

export const MobileBottomNav = ({ openMenu, setOpenMenu }: {
  readonly openMenu: MobileMenu;
  readonly setOpenMenu: React.Dispatch<React.SetStateAction<MobileMenu>>;
}) => {
  const pathname = usePathname();
  const { user } = useDashboardContext();
  const accountTriggerRef = React.useRef<HTMLButtonElement>(null);
  const moreTriggerRef = React.useRef<HTMLButtonElement>(null);
  const accountActive = pathname === '/dashboard/profile' || pathname.startsWith('/dashboard/profile/');
  const moreActive = MORE_ITEMS.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`));

  React.useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktopQuery.matches) setOpenMenu(null);
    };
    desktopQuery.addEventListener('change', closeOnDesktop);
    return () => desktopQuery.removeEventListener('change', closeOnDesktop);
  }, [setOpenMenu]);

  return (
    <nav aria-label="Primary dashboard navigation" className="mobile-bottom-nav">
      <NavLink href="/dashboard" className="mobile-nav-item" activeClassName="mobile-nav-item--active">
        <SemanticIcon concept="overview" size="control" />
        <span className="text-[10px] font-medium">Home</span>
      </NavLink>
      <NavLink href="/dashboard/conversations" className="mobile-nav-item" activeClassName="mobile-nav-item--active">
        <SemanticIcon concept="conversations" size="control" />
        <span className="text-[10px] font-medium">Inbox</span>
      </NavLink>
      <NavLink href="/dashboard/automations" className="mobile-nav-item" activeClassName="mobile-nav-item--active">
        <SemanticIcon concept="bot" size="control" />
        <span className="text-[10px] font-medium">Automation</span>
      </NavLink>
      <button
        type="button"
        ref={accountTriggerRef}
        aria-label={`Account menu for ${dashboardDisplayName(user)}`}
        aria-haspopup="menu"
        aria-expanded={openMenu === 'account'}
        aria-current={accountActive ? 'page' : undefined}
        onClick={() => setOpenMenu((current) => current === 'account' ? null : 'account')}
        className={`mobile-nav-item ${accountActive || openMenu === 'account' ? 'mobile-nav-item--active' : ''}`}
      >
        <span className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-[#8b7cf6] text-[10px] font-bold text-white shadow-sm ${accountActive ? 'ring-2 ring-[var(--brand-green)] ring-offset-1' : ''}`}>{dashboardUserInitials(user)}</span>
        <span className="text-[10px] font-medium">Profile</span>
      </button>
      <PortalMenu isOpen={openMenu === 'account'} onClose={() => setOpenMenu(null)} triggerRef={accountTriggerRef} placement="bottom-end" className="mobile-account-menu">
        <div role="menu" aria-label="Account">
          <AccountMenuContent onClose={() => setOpenMenu(null)} />
        </div>
      </PortalMenu>
      <button
        type="button"
        ref={moreTriggerRef}
        aria-label="More dashboard pages"
        aria-haspopup="menu"
        aria-expanded={openMenu === 'more'}
        aria-current={moreActive ? 'page' : undefined}
        onClick={() => setOpenMenu((current) => current === 'more' ? null : 'more')}
        className={`mobile-nav-item ${moreActive || openMenu === 'more' ? 'mobile-nav-item--active' : ''}`}
      >
        <SemanticIcon concept="menuHorizontal" size="control" />
        <span className="text-[10px] font-medium">More</span>
      </button>
      <PortalMenu isOpen={openMenu === 'more'} onClose={() => setOpenMenu(null)} triggerRef={moreTriggerRef} placement="bottom-end" className="mobile-more-menu">
        <div role="menu" aria-label="More dashboard pages">
          {MORE_ITEMS.map(({ label, href, icon }) => (
            <Link key={href} href={href} role="menuitem" onClick={() => setOpenMenu(null)} className="portal-menu-item text-[var(--ink)]">
              <SemanticIcon concept={icon} size="navigation" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </PortalMenu>
    </nav>
  );
};
