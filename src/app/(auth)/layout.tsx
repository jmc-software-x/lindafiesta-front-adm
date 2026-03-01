import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_SESSION_COOKIE, parseSessionToken } from '@/lib/auth/session';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  const accessToken = cookieStore.get('lf_access_token')?.value;
  const session = parseSessionToken(token);

  if (session && accessToken) {
    redirect('/dashboard');
  }

  return <div className="min-h-screen bg-slate-100">{children}</div>;
}
