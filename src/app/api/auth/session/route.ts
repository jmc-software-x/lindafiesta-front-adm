import { NextRequest, NextResponse } from 'next/server';
import { AUTH_SESSION_COOKIE, parseSessionToken } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const hasAccessToken = Boolean(request.cookies.get('lf_access_token')?.value);
  const session = parseSessionToken(token);

  if (!session) {
    return NextResponse.json(
      { authenticated: false, hasAccessToken },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      hasAccessToken,
      user: session,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
