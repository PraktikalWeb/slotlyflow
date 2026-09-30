"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { BusinessSwitcherMenuContent } from './DashboardMenuContent';
import type { MobileMenu } from './mobile-menu';
import { useDashboardContext } from '@/src/dashboard/dashboard-context';
import { businessInitial } from '@/src/dashboard/dashboard-types';
import { SemanticIcon } from '@/src/icons/semantic-icon';
import { PortalMenu } from '@/components/feedback/PortalMenu';
import {
  getDashboardNotifications,
  getUnreadNotificationCount,
  markDashboardNotificationRead,
  type DashboardNotification,
} from '@/src/notifications/notification-client';

export const MobileHeader = ({ openMenu, setOpenMenu }: {
  readonly openMenu: MobileMenu;
  readonly setOpenMenu: React.Dispatch<React.SetStateAction<MobileMenu>>;
}) => {
  const router = useRouter();
  const { selectedMembership } = useDashboardContext();
  const selectedBusiness = selectedMembership.organization;
  const organizationId = selectedBusiness.id;
  const [isMobile, setIsMobile] = React.useState(false);
  const [notifications, setNotifications] = React.useState<readonly DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loadedOrganizationId, setLoadedOrganizationId] = React.useState(organizationId);
  const [isLoadingNotifications, setLoadingNotifications] = React.useState(false);
  const [notificationsUnavailable, setNotificationsUnavailable] = React.useState(false);
  const notificationRequestId = React.useRef(0);
  const activeOrganizationId = React.useRef(organizationId);
  const businessTriggerRef = React.useRef<HTMLButtonElement>(null);
  const notificationTriggerRef = React.useRef<HTMLButtonElement>(null);
  const notificationPanelRef = React.useRef<HTMLElement>(null);
  // eslint-disable-next-line react-hooks/refs -- In-flight notification actions must see a Business change immediately.
  activeOrganizationId.current = organizationId;

  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(media.matches);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The viewport breakpoint is read only after hydration.
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const refreshNotifications = React.useCallback(async () => {
    const requestId = ++notificationRequestId.current;
    setLoadedOrganizationId(organizationId);
    setNotifications([]);
    setUnreadCount(0);
    setNotificationsUnavailable(false);
    setLoadingNotifications(true);
    const [loadedNotifications, loadedUnreadCount] = await Promise.all([
      getDashboardNotifications(organizationId),
      getUnreadNotificationCount(organizationId),
    ]);
    if (requestId !== notificationRequestId.current) return;
    setLoadingNotifications(false);
    if (loadedNotifications === undefined || loadedUnreadCount === undefined) {
      setNotificationsUnavailable(true);
      return;
    }
    setNotifications(loadedNotifications);
    setUnreadCount(loadedUnreadCount);
  }, [organizationId]);

  React.useEffect(() => {
    if (!isMobile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Portal menus must close when the mobile shell is hidden.
      setOpenMenu(null);
      return;
    }
    /* eslint-disable react-hooks/set-state-in-effect -- A Business change closes stale menus and refreshes that Business's notifications. */
    setOpenMenu(null);
    void refreshNotifications();
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { notificationRequestId.current += 1; };
  }, [isMobile, refreshNotifications, setOpenMenu]);

  React.useEffect(() => {
    if (openMenu === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [openMenu, setOpenMenu]);

  React.useEffect(() => {
    if (openMenu !== 'notifications') return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!notificationTriggerRef.current?.contains(target) && !notificationPanelRef.current?.contains(target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [openMenu, setOpenMenu]);

  const visibleNotifications = loadedOrganizationId === organizationId ? notifications : [];
  const visibleUnreadCount = loadedOrganizationId === organizationId ? unreadCount : 0;

  async function openNotification(notification: DashboardNotification): Promise<void> {
    if (notification.readAt === null) {
      const marked = await markDashboardNotificationRead(organizationId, notification.id);
      if (activeOrganizationId.current !== organizationId) return;
      if (marked) {
        setNotifications((current) => current.map((entry) => (
          entry.id === notification.id ? { ...entry, readAt: new Date().toISOString() } : entry
        )));
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    }
    setOpenMenu(null);
    router.push(`/dashboard/conversations?conversationId=${encodeURIComponent(notification.resourceId)}`);
  }

  async function markAllRead(): Promise<void> {
    const unread = visibleNotifications.filter((notification) => notification.readAt === null);
    await Promise.all(unread.map((notification) => markDashboardNotificationRead(organizationId, notification.id)));
    if (activeOrganizationId.current !== organizationId) return;
    await refreshNotifications();
  }

  return (
    <header className="mobile-header">
      <Link href="/dashboard" aria-label="SlotlyFlow Home" onClick={() => setOpenMenu(null)} className="flex min-w-0 items-center">
        <img src="/slotlyflow-logo-transparent.png" alt="SlotlyFlow" className="h-10 w-auto max-w-[128px] object-contain object-left" />
      </Link>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div>
          <button
            type="button"
            ref={notificationTriggerRef}
            aria-label={`Notifications${visibleUnreadCount > 0 ? `, ${visibleUnreadCount} unread` : ''}`}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'notifications'}
            onClick={() => setOpenMenu((current) => current === 'notifications' ? null : 'notifications')}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
          >
            <SemanticIcon concept="bell" className="h-[18px] w-[18px]" size="control" />
            {visibleUnreadCount > 0 && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-[var(--surface)] bg-[var(--danger)]" />}
          </button>
          {openMenu === 'notifications' && (
            <section ref={notificationPanelRef} aria-label="Notifications" className="fixed inset-x-4 top-[calc(var(--mobile-header-height)+8px)] z-40 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] py-1 text-[var(--ink)] shadow-lg">
              <div className="mb-1 flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <h2 className="text-[14px] font-semibold">Notifications</h2>
                {visibleUnreadCount > 0 && <button type="button" onClick={() => { void markAllRead(); }} className="text-[11px] font-medium text-[var(--brand-green)] hover:underline">Mark all as read</button>}
              </div>
              <div className="max-h-[min(50dvh,300px)] overflow-y-auto" role="menu">
                {isLoadingNotifications && <p className="px-4 py-4 text-[13px] text-[var(--ink-secondary)]">Loading notifications…</p>}
                {!isLoadingNotifications && notificationsUnavailable && <p className="px-4 py-4 text-[13px] text-[var(--ink-secondary)]">Notifications are temporarily unavailable.</p>}
                {!isLoadingNotifications && !notificationsUnavailable && visibleNotifications.length === 0 && <p className="px-4 py-4 text-[13px] text-[var(--ink-secondary)]">You’re all caught up.</p>}
                {!isLoadingNotifications && !notificationsUnavailable && visibleNotifications.map((notification) => (
                  <button key={notification.id} type="button" role="menuitem" onClick={() => { void openNotification(notification); }} className="relative flex w-full items-start gap-3 py-3 pl-4 pr-8 text-left hover:bg-[var(--surface-subtle)]">
                    {notification.readAt === null && <span aria-label="Unread" className="absolute right-4 top-5 h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--ink-secondary)]"><SemanticIcon concept="bell" className="h-4 w-4" size="navigation" /></span>
                    <span><span className={`block text-[13px] ${notification.readAt === null ? 'font-semibold' : 'font-medium text-[var(--ink-secondary)]'}`}>{notification.title}</span><span className="mt-0.5 block text-[11px] text-[var(--ink-tertiary)]">{notification.body}</span></span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div>
          <button
            type="button"
            ref={businessTriggerRef}
            aria-label={`Switch Business: ${selectedBusiness.name}`}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'business'}
            onClick={() => setOpenMenu((current) => current === 'business' ? null : 'business')}
            className="flex h-9 items-center gap-1 rounded-[var(--radius-sm)] pl-1 pr-1.5 hover:bg-[var(--surface-subtle)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--flow-violet)] text-[12px] font-bold text-white">{businessInitial(selectedBusiness.name)}</span>
            <SemanticIcon concept="chevronDown" className="h-3 w-3 text-[var(--ink-secondary)]" size="metadata" />
          </button>
          <PortalMenu isOpen={openMenu === 'business'} onClose={() => setOpenMenu(null)} triggerRef={businessTriggerRef} placement="bottom-end" className="mobile-business-menu">
            <div role="menu" aria-label="Your Businesses">
              <BusinessSwitcherMenuContent onClose={() => setOpenMenu(null)} />
            </div>
          </PortalMenu>
        </div>
      </div>
    </header>
  );
};
