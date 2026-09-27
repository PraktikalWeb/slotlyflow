'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useDashboardContext } from '../../src/dashboard/dashboard-context';
import {
  getDashboardNotifications,
  getUnreadNotificationCount,
  markDashboardNotificationRead,
  type DashboardNotification,
} from '../../src/notifications/notification-client';
import { SemanticIcon } from '../../src/icons/semantic-icon';

export function DashboardHeader({ toggleSidebar, isSidebarCollapsed }: { toggleSidebar: () => void; isSidebarCollapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedMembership } = useDashboardContext();
  const organizationId = selectedMembership.organization.id;
  const [isNotificationMenuOpen, setNotificationMenuOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<readonly DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loadedOrganizationId, setLoadedOrganizationId] = React.useState(organizationId);
  const [isLoadingNotifications, setLoadingNotifications] = React.useState(false);
  const [notificationsUnavailable, setNotificationsUnavailable] = React.useState(false);
  const notificationRequestId = React.useRef(0);
  const activeOrganizationId = React.useRef(organizationId);
  activeOrganizationId.current = organizationId;

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
    setNotificationsUnavailable(false);
  }, [organizationId]);

  React.useEffect(() => {
    setNotificationMenuOpen(false);
    void refreshNotifications();
    return () => { notificationRequestId.current += 1; };
  }, [refreshNotifications]);

  const visibleNotifications = loadedOrganizationId === organizationId ? notifications : [];
  const visibleUnreadCount = loadedOrganizationId === organizationId ? unreadCount : 0;

  let activeTab = 'Home';
  if (pathname.includes('conversations')) activeTab = 'Inbox';
  else if (pathname.includes('automations')) activeTab = 'Automation';
  else if (pathname.includes('analytics')) activeTab = 'Analytics';
  else if (pathname.includes('team')) activeTab = 'Team';
  else if (pathname.includes('whatsapp')) activeTab = 'WhatsApp';
  else if (pathname.includes('settings')) activeTab = 'Settings';
  else if (pathname.includes('profile')) activeTab = 'Profile';

  const isInbox = activeTab === 'Inbox';
  if (isInbox) return null;

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
    setNotificationMenuOpen(false);
    router.push(`/dashboard/conversations?conversationId=${encodeURIComponent(notification.resourceId)}`);
  }

  async function markAllRead(): Promise<void> {
    const unread = visibleNotifications.filter((notification) => notification.readAt === null);
    await Promise.all(unread.map((notification) => markDashboardNotificationRead(organizationId, notification.id)));
    if (activeOrganizationId.current !== organizationId) return;
    await refreshNotifications();
  }

  return (
    <header className="h-[64px] bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between px-8 shrink-0 z-10 sticky top-0">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius)] text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
        >
          <span className={`transition-transform duration-300 flex items-center justify-center ${!isSidebarCollapsed ? 'rotate-180' : ''}`}>
            <SemanticIcon concept="expandSidebar" className="w-5 h-5" size="control" />
          </span>
        </button>
        <h1 className="text-[16px] font-semibold text-[var(--ink)] tracking-tight">
          {activeTab === 'Settings' ? 'Business Settings' : activeTab}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            aria-label={`Notifications${visibleUnreadCount > 0 ? `, ${visibleUnreadCount} unread` : ''}`}
            aria-expanded={isNotificationMenuOpen}
            aria-haspopup="menu"
            onClick={() => setNotificationMenuOpen((open) => !open)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--surface-subtle)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)]/20 relative cursor-pointer"
          >
            <SemanticIcon concept="bell" className="w-[18px] h-[18px]" size="control" />
            {visibleUnreadCount > 0 ? <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border border-[var(--surface)]" aria-hidden="true" /> : null}
          </button>

          {isNotificationMenuOpen ? (
            <section aria-label="Notifications" className="absolute right-0 top-full mt-1 w-[320px] bg-white rounded-[var(--radius)] shadow-lg py-1 z-50 text-[var(--ink)] border border-[var(--border)]">
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between mb-1">
                <h2 className="font-semibold text-[14px] text-[var(--ink)] tracking-tight">Notifications</h2>
                {visibleUnreadCount > 0 ? (
                  <button type="button" onClick={() => { void markAllRead(); }} className="text-[11px] text-[var(--brand-green)] font-medium hover:underline">
                    Mark all as read
                  </button>
                ) : null}
              </div>
              <div className="max-h-[300px] overflow-y-auto" role="menu">
                {isLoadingNotifications ? <p className="px-4 py-4 text-[13px] text-[var(--ink-secondary)]">Loading notifications…</p> : null}
                {!isLoadingNotifications && notificationsUnavailable ? <p className="px-4 py-4 text-[13px] text-[var(--ink-secondary)]">Notifications are temporarily unavailable.</p> : null}
                {!isLoadingNotifications && !notificationsUnavailable && visibleNotifications.length === 0 ? <p className="px-4 py-4 text-[13px] text-[var(--ink-secondary)]">You’re all caught up.</p> : null}
                {!isLoadingNotifications && !notificationsUnavailable ? visibleNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    role="menuitem"
                    onClick={() => { void openNotification(notification); }}
                    className="w-full text-left pl-4 pr-8 py-3 hover:bg-[var(--surface-subtle)] transition-colors flex items-start gap-3 relative"
                  >
                    {notification.readAt === null ? <span className="w-1.5 h-1.5 rounded-full bg-red-500 absolute right-4 top-5" aria-label="Unread" /> : null}
                    <span className="w-8 h-8 rounded-full bg-[var(--surface-strong)] flex items-center justify-center shrink-0 border border-[var(--border)] text-[var(--ink-secondary)]">
                      <SemanticIcon concept="bell" className="w-4 h-4" size="navigation" />
                    </span>
                    <span>
                      <span className={`block text-[13px] ${notification.readAt === null ? 'font-semibold text-[var(--ink)]' : 'font-medium text-[var(--ink-secondary)]'}`}>{notification.title}</span>
                      <span className="block text-[11px] text-[var(--ink-tertiary)] mt-0.5">{notification.body}</span>
                    </span>
                  </button>
                )) : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </header>
  );
}
