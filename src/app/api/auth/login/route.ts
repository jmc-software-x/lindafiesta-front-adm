import { NextRequest, NextResponse } from 'next/server';
import {
  clearFailedLoginAttempts,
  isConfiguredCredential,
  isLoginRateLimited,
  isOriginAllowed,
  registerFailedLoginAttempt,
  validateLoginInput,
} from '@/lib/auth/login-security';
import {
  AUTH_SESSION_COOKIE,
  createSessionToken,
  getSessionCookieOptions,
} from '@/lib/auth/session';

interface LoginBody {
  email?: string;
  password?: string;
}

const unauthorizedResponse = () => {
  return NextResponse.json(
    { ok: false, message: 'Credenciales invalidas.' },
    {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
};

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
    return unauthorizedResponse();
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!validateLoginInput(email, password)) {
    registerFailedLoginAttempt(request);
    return unauthorizedResponse();
  }

  let isValidCredential = false;

  try {
    isValidCredential = isConfiguredCredential(email, password);
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Configuracion de autenticacion incompleta.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (!isValidCredential) {
    registerFailedLoginAttempt(request);
    return unauthorizedResponse();
  }

  clearFailedLoginAttempts(request);

  try {
    const response = NextResponse.json(
      {
        ok: true,
        user: { email, role: 'ADMIN' },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );

    response.cookies.set(AUTH_SESSION_COOKIE, createSessionToken(email), getSessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Configuracion de sesion incompleta.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
