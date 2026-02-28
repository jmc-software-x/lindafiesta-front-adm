import { NextRequest, NextResponse } from 'next/server';
import { isOriginAllowed } from '@/lib/auth/login-security';
import {
  AUTH_SESSION_COOKIE,
  getExpiredSessionCookieOptions,
} from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { ok: false, message: 'Solicitud no permitida.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );

  response.cookies.set(AUTH_SESSION_COOKIE, '', getExpiredSessionCookieOptions());
  return response;
}
