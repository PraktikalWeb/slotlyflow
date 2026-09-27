import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { LogoutProvider } from '@/src/auth/logout-provider';
import { resolveDashboardUser } from '@/src/dashboard/dashboard-data';

export default async function BusinessOnboardingLayout({ children }: { children: React.ReactNode }) {
  const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'slotlyflow_session';
  const sessionToken = (await cookies()).get(cookieName)?.value;
  const authentication = await resolveDashboardUser({ sessionToken });

  if (authentication.status !== 'authenticated') redirect('/sign-in');

  return <LogoutProvider redirectTo="/sign-in">{children}</LogoutProvider>;
}
