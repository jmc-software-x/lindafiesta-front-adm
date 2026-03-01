import { NextRequest, NextResponse } from 'next/server';
import {
  appendSetCookieHeaders,
  getBackendApiBaseUrl,
  isOriginAllowed,
} from '@/lib/auth/login-security';
import {
  AUTH_SESSION_COOKIE,
  getExpiredSessionCookieOptions,
} from '@/lib/auth/session';

const ACCESS_TOKEN_COOKIE = 'lf_access_token';

export async function POST(request: NextRequest) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { ok: false, message: 'Solicitud no permitida.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const backendBaseUrl = getBackendApiBaseUrl();
    const upstreamLogoutUrl = `${backendBaseUrl}/auth/logout`;

    const upstreamResponse = await fetch(upstreamLogoutUrl, {
      method: 'POST',
      headers: {
        Cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    });

    const response = NextResponse.json(
      { ok: upstreamResponse.ok },
      {
        status: upstreamResponse.ok ? 200 : 502,
        headers: { 'Cache-Control': 'no-store' },
      }
    );

    appendSetCookieHeaders(upstreamResponse.headers, response.headers);
    response.cookies.set(AUTH_SESSION_COOKIE, '', getExpiredSessionCookieOptions());
    response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch {
    const response = NextResponse.json(
      { ok: false, message: 'No se pudo conectar con el backend de autenticacion.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
    response.cookies.set(AUTH_SESSION_COOKIE, '', getExpiredSessionCookieOptions());
    response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  }
}
