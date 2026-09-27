"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { SemanticIcon } from "@/src/icons/semantic-icon";
import { useLogout } from '@/src/auth/logout-provider';
import Link from "next/link";
import Image from "next/image";

const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' as const, path: '/admin' },
  { id: 'businesses', label: 'Businesses', icon: 'organization' as const, path: '/admin/businesses' },
  { id: 'users', label: 'Users', icon: 'team' as const, path: '/admin/users' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'conversations' as const, path: '/admin/whatsapp' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'creditCard' as const, path: '/admin/subscriptions' },
  { id: 'operations', label: 'Operations', icon: 'activity' as const, path: '/admin/operations' },
  { id: 'audit', label: 'Audit Logs', icon: 'audit' as const, path: '/admin/audit' },
  { id: 'staff', label: 'Platform Staff', icon: 'userPlus' as const, path: '/admin/platform-staff' },
  { id: 'settings', label: 'Settings', icon: 'settings' as const, path: '/admin/settings' },
];

const NOTIFICATIONS = [
  { id: 1, title: 'New business registered', time: '5m ago', unread: true },
  { id: 2, title: 'Platform update completed', time: '2h ago', unread: false },
  { id: 3, title: 'High webhook failure rate', time: '1d ago', unread: false },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { error: logoutError, isPending: isSigningOut, logout } = useLogout();

  const handleSignOut = async (): Promise<void> => {
    const completed = await logout();
    if (completed) setIsProfileOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F7F9F8] font-['Spline_Sans'] flex">
      {/* Sidebar */}
      <div 
        onClick={() => {
          if (!isSidebarOpen) setIsSidebarOpen(true);
        }}
        className={`bg-[#003B2D] text-white flex-shrink-0 flex flex-col h-screen sticky top-0 transition-all duration-300 z-30 ${isSidebarOpen ? 'w-[260px]' : 'w-[72px] cursor-pointer'}`}
      >
        <div className={`h-[80px] flex items-center shrink-0 mb-6 ${isSidebarOpen ? 'pl-[20px] pr-6' : 'justify-center'}`}>
          {isSidebarOpen ? (
            <img src="/slotlyflow-logo-inverse.png" alt="SlotlyFlow" className="w-[150px] h-auto object-contain -ml-1" />
          ) : (
            <img src="/white_icon.png" alt="SlotlyFlow Icon" className="w-[36px] h-[36px] object-contain" />
          )}
        </div>
        
        <nav className={`flex-1 py-3 space-y-1 ${isSidebarOpen ? 'px-4' : 'px-3'}`}>
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/admin' && pathname?.startsWith(item.path));
            return (
              <Link
                key={item.id}
                href={item.path}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className={`w-full flex items-center py-2.5 rounded-[6px] text-[14.5px] font-medium transition-colors group relative ${
                  isSidebarOpen ? 'px-4' : 'justify-center px-0'
                } ${
                  isActive 
                    ? 'bg-white/10 text-white' 
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className={`w-[18px] h-[18px] flex items-center justify-center ${isSidebarOpen ? 'mr-3' : ''} ${isActive ? 'text-[#B7F34A]' : 'text-white/70'}`}>
                  <SemanticIcon concept={item.icon} size="navigation" className="w-full h-full" />
                </div>
                {isSidebarOpen && <span>{item.label}</span>}
                
                {!isSidebarOpen && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#B7F34A] text-[#002B21] text-[12px] font-bold rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#B7F34A] rotate-45"></div>
                    <span className="relative z-10">{item.label}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-[#111816]/10 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[#111816]/60 hover:text-[#111816] hover:bg-[#F7F9F8] transition-colors cursor-pointer"
            >
              <div className={`w-5 h-5 flex items-center justify-center transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : ''}`}>
                <SemanticIcon concept="expandSidebar" size="control" className="w-full h-full" />
              </div>
            </button>
            <div className="relative w-[360px]">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111816]/40 flex items-center justify-center">
                <SemanticIcon concept="search" size="navigation" className="w-full h-full" />
              </div>
              <input 
                type="text" 
                placeholder="Search businesses, users, or phone numbers..." 
                className="w-full h-10 pl-10 pr-4 bg-[#F7F9F8] border border-transparent rounded-[6px] text-[14px] text-[#111816] placeholder-[#111816]/40 focus:bg-white focus:border-[#003B2D] focus:outline-none transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <button className="relative w-8 h-8 rounded-full flex items-center justify-center text-[#111816]/60 hover:text-[#111816] group-hover:bg-[#F7F9F8] transition-colors focus:outline-none cursor-pointer">
                <SemanticIcon concept="bell" size="control" className="w-5 h-5" />
                <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF7A66] border-2 border-white"></div>
              </button>
              {/* Notification Dropdown (Hover) */}
              <div className="absolute right-0 top-full mt-1 w-[320px] bg-white rounded-[8px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] py-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-2 group-hover:translate-y-0 text-[#111816] border border-[#111816]/10">
                <div className="px-4 py-3 border-b border-[#111816]/5 flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-[14px] tracking-tight">Notifications</h3>
                  <span className="text-[11px] text-[#003B2D] font-medium cursor-pointer hover:underline">Mark all as read</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {NOTIFICATIONS.map(notification => (
                    <div key={notification.id} className="pl-4 pr-8 py-3 hover:bg-[#F7F9F8] transition-colors cursor-pointer flex items-start gap-3 relative">
                      {notification.unread && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF7A66] absolute right-4 top-5"></div>
                      )}
                      <div className="w-8 h-8 rounded-full bg-[#F7F9F8] flex items-center justify-center shrink-0 border border-[#111816]/5 text-[#111816]/60">
                        <SemanticIcon concept="bell" size="navigation" className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={`text-[13px] ${notification.unread ? 'font-semibold text-[#111816]' : 'font-medium text-[#111816]/60'}`}>
                          {notification.title}
                        </p>
                        <p className="text-[11px] text-[#111816]/40 mt-0.5">{notification.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 mt-1 border-t border-[#111816]/5 text-center">
                  <button className="text-[12px] font-medium text-[#111816]/60 hover:text-[#111816] transition-colors cursor-pointer w-full py-1">
                    View all notifications
                  </button>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center gap-2 hover:bg-[#F7F9F8] p-1.5 rounded-[8px] transition-colors focus:outline-none cursor-pointer ${isProfileOpen ? 'bg-[#F7F9F8]' : ''}`}
              >
                <div className="w-8 h-8 rounded-full bg-[#003B2D] text-white flex items-center justify-center text-[13px] font-bold">
                  SA
                </div>
                <div className="w-4 h-4 text-[#111816]/60 flex items-center justify-center">
                  <SemanticIcon concept="chevronDown" size="navigation" className="w-full h-full" />
                </div>
              </button>
              
              {isProfileOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProfileOpen(false)}
                  ></div>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-[6px] shadow-lg border border-[#111816]/10 py-1.5 z-50 overflow-hidden text-[#111816]">
                    <div className="px-4 py-2 border-b border-[#111816]/5 mb-1">
                      <p className="text-[13px] font-semibold">Super Admin</p>
                      <p className="text-[12px] text-[#111816]/60 truncate">admin@slotlyflow.com</p>
                    </div>
                    <button 
                      onClick={() => {
                        setIsProfileOpen(false);
                      }}
                      className="w-full flex items-center px-4 py-2 text-[13px] text-[#111816]/70 hover:bg-[#F7F9F8] hover:text-[#111816] transition-colors cursor-pointer font-medium"
                    >
                      <div className="w-4 h-4 mr-2.5 flex items-center justify-center">
                        <SemanticIcon concept="profile" size="navigation" className="w-full h-full" />
                      </div>
                      Profile
                    </button>
                    <button 
                      type="button"
                      onClick={() => { void handleSignOut(); }}
                      disabled={isSigningOut}
                      className="w-full flex items-center px-4 py-2 text-[13px] text-[#FF7A66] hover:bg-[#F7F9F8] transition-colors disabled:opacity-70 disabled:hover:bg-transparent cursor-pointer font-medium"
                    >
                      <div className="w-4 h-4 mr-2.5 flex items-center justify-center">
                        <SemanticIcon concept="logout" size="navigation" className="w-full h-full" />
                      </div>
                      {isSigningOut ? 'Signing out...' : 'Sign out'}
                    </button>
                    {logoutError !== undefined && (
                      <p role="alert" className="px-4 pt-1 text-[12px] leading-4 text-[#C85040]">
                        {logoutError}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
