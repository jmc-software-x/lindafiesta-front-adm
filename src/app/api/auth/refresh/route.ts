import { NextRequest, NextResponse } from 'next/server';
import {
  appendSetCookieHeaders,
  extractCookieValueFromSetCookie,
  getBackendApiBaseUrl,
  isOriginAllowed,
} from '@/lib/auth/login-security';

const ACCESS_TOKEN_COOKIE = 'lf_access_token';
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? '900');

export async function POST(request: NextRequest) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { ok: false, message: 'Solicitud no permitida.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const backendBaseUrl = getBackendApiBaseUrl();
    const upstreamRefreshUrl = `${backendBaseUrl}/auth/refresh`;
    const upstreamResponse = await fetch(upstreamRefreshUrl, {
      method: 'POST',
      headers: {
        Cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    });

    let upstreamBody: Record<string, unknown> | null = null;
    try {
      upstreamBody = (await upstreamResponse.json()) as Record<string, unknown>;
    } catch {
      upstreamBody = null;
    }

    const response = NextResponse.json(
      {
        ok: upstreamResponse.ok,
        ...(upstreamBody ?? {}),
      },
      {
        status: upstreamResponse.ok ? 200 : upstreamResponse.status,
        headers: { 'Cache-Control': 'no-store' },
      }
    );

    appendSetCookieHeaders(upstreamResponse.headers, response.headers);
    const accessTokenFromBody =
      upstreamBody && typeof upstreamBody.accessToken === 'string'
        ? upstreamBody.accessToken
        : null;
    const accessToken =
      accessTokenFromBody ??
      extractCookieValueFromSetCookie(upstreamResponse.headers, ACCESS_TOKEN_COOKIE);
    if (upstreamResponse.ok && accessToken) {
      response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: ACCESS_TOKEN_TTL_SECONDS,
      });
    }
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'No se pudo conectar con el backend de autenticacion.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
