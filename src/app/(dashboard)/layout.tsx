import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { AUTH_SESSION_COOKIE, parseSessionToken } from '@/lib/auth/session';

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  const accessToken = cookieStore.get('lf_access_token')?.value;
  const session = parseSessionToken(token);

  if (!session || !accessToken) {
    redirect('/login');
  }

  return (
    <AppShell userEmail={session.email} userRole={session.role}>
      {children}
    </AppShell>
  );
}
