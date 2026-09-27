import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import AppShell from "@/components/app-shell/AppShell";
import { LogoutProvider } from '@/src/auth/logout-provider';
import {
  resolveDashboardBusinesses,
  resolveDashboardUser,
} from '@/src/dashboard/dashboard-data';
import { activeBusinessMemberships } from '@/src/dashboard/dashboard-types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'slotlyflow_session';
  const sessionToken = (await cookies()).get(cookieName)?.value;
  const authentication = await resolveDashboardUser({ sessionToken });

  if (authentication.status !== 'authenticated') redirect('/sign-in');

  const businesses = await resolveDashboardBusinesses({ sessionToken });
  if (businesses.status === 'unauthenticated') redirect('/sign-in');
  if (businesses.status !== 'ready') redirect('/sign-in');
  if (activeBusinessMemberships(businesses.memberships).length === 0) redirect('/onboarding/business');

  return (
    <LogoutProvider redirectTo="/sign-in">
      <AppShell user={authentication.user} memberships={businesses.memberships}>{children}</AppShell>
    </LogoutProvider>
  );
}
