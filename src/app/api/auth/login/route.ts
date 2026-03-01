import { NextRequest, NextResponse } from 'next/server';
import {
  appendSetCookieHeaders,
  clearFailedLoginAttempts,
  extractCookieValueFromSetCookie,
  getBackendApiBaseUrl,
  getDefaultTenantId,
  isTenantIdValid,
  isLoginRateLimited,
  isOriginAllowed,
  normalizeTenantId,
  registerFailedLoginAttempt,
  validateLoginInput,
} from '@/lib/auth/login-security';
import {
  AUTH_SESSION_COOKIE,
  createSessionToken,
  getSessionCookieOptions,
} from '@/lib/auth/session';

const ACCESS_TOKEN_COOKIE = 'lf_access_token';
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? '900');

interface LoginBody {
  email?: string;
  password?: string;
  tenantId?: string;
}

export async function POST(request: NextRequest) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { ok: false, message: 'Solicitud no permitida.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (isLoginRateLimited(request)) {
    return NextResponse.json(
      { ok: false, message: 'Demasiados intentos. Intenta mas tarde.' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let body: LoginBody = {};

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    registerFailedLoginAttempt(request);
    return NextResponse.json(
      { ok: false, message: 'Credenciales invalidas.' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const tenantId = normalizeTenantId(body.tenantId) || getDefaultTenantId();

  if (!validateLoginInput(email, password) || !isTenantIdValid(tenantId)) {
    registerFailedLoginAttempt(request);
    return NextResponse.json(
      { ok: false, message: 'Credenciales invalidas.' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const backendBaseUrl = getBackendApiBaseUrl();
  const upstreamLoginUrl = `${backendBaseUrl}/auth/login`;

  try {
    const upstreamResponse = await fetch(upstreamLoginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        tenantId,
      }),
      cache: 'no-store',
    });

    let upstreamBody: Record<string, unknown> | null = null;
    try {
      upstreamBody = (await upstreamResponse.json()) as Record<string, unknown>;
    } catch {
      upstreamBody = null;
    }

    if (!upstreamResponse.ok) {
      registerFailedLoginAttempt(request);
      const fallbackMessage =
        upstreamResponse.status === 429
          ? 'Demasiados intentos. Intenta mas tarde.'
          : 'Credenciales invalidas.';
      const upstreamMessage =
        upstreamBody && typeof upstreamBody.message === 'string' ? upstreamBody.message : fallbackMessage;

      return NextResponse.json(
        { ok: false, message: upstreamMessage },
        {
          status: upstreamResponse.status === 429 ? 429 : 401,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    clearFailedLoginAttempts(request);

    const response = NextResponse.json(
      {
        ok: true,
        accessToken:
          upstreamBody && typeof upstreamBody.accessToken === 'string'
            ? upstreamBody.accessToken
            : undefined,
        user:
          upstreamBody && typeof upstreamBody.user === 'object' && upstreamBody.user
            ? upstreamBody.user
            : { email, role: 'ADMIN', tenantId },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );

    appendSetCookieHeaders(upstreamResponse.headers, response.headers);
    try {
      const accessTokenFromBody =
        upstreamBody && typeof upstreamBody.accessToken === 'string'
          ? upstreamBody.accessToken
          : null;
      const accessToken =
        accessTokenFromBody ??
        extractCookieValueFromSetCookie(upstreamResponse.headers, ACCESS_TOKEN_COOKIE);
      if (accessToken) {
        response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: ACCESS_TOKEN_TTL_SECONDS,
        });
      }

      response.cookies.set(AUTH_SESSION_COOKIE, createSessionToken(email), getSessionCookieOptions());
    } catch {
      return NextResponse.json(
        { ok: false, message: 'Configuracion de sesion incompleta.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'No se pudo conectar con el backend de autenticacion.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
