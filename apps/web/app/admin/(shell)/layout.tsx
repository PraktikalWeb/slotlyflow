import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import AdminShell from "@/components/admin/AdminShell";
import { LogoutProvider } from '@/src/auth/logout-provider';
import { resolveServerSession } from '@/src/auth/server-session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'slotlyflow_session';
  const sessionToken = (await cookies()).get(cookieName)?.value;
  const authentication = await resolveServerSession({ endpoint: '/admin/me', sessionToken });

  if (authentication !== 'authenticated') redirect('/admin/sign-in');

  return (
    <LogoutProvider redirectTo="/admin/sign-in">
      <AdminShell>{children}</AdminShell>
    </LogoutProvider>
  );
}
