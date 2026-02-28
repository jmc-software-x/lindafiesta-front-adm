import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const AUTH_SESSION_COOKIE = 'lf_admin_session';
const AUTH_SESSION_TTL_SECONDS = 60 * 60 * 8;

type UserRole = 'ADMIN';

interface SessionPayload {
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
  sid: string;
}

export interface AuthSession {
  email: string;
  role: UserRole;
}

interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict';
  path: '/';
  maxAge: number;
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const base64UrlToBuffer = (value: string) => {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const normalized = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
};

const getSessionSecret = () => {
  const secret = process.env.AUTH_SESSION_SECRET;

  if (!secret) {
    throw new Error('Missing AUTH_SESSION_SECRET env var.');
  }

  return secret;
};

const safeEquals = (left: string, right: string) => {
  const leftBuffer = encoder.encode(left);
  const rightBuffer = encoder.encode(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const signPayload = (payloadBase64Url: string) => {
  return createHmac('sha256', getSessionSecret())
    .update(payloadBase64Url)
    .digest('base64url');
};

export const getSessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: AUTH_SESSION_TTL_SECONDS,
});

export const getExpiredSessionCookieOptions = (): CookieOptions => ({
  ...getSessionCookieOptions(),
  maxAge: 0,
});

export const createSessionToken = (email: string): string => {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    email,
    role: 'ADMIN',
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + AUTH_SESSION_TTL_SECONDS,
    sid: randomBytes(16).toString('hex'),
  };

  const serializedPayload = JSON.stringify(payload);
  const payloadBase64Url = Buffer.from(serializedPayload, 'utf8').toString('base64url');
  const signature = signPayload(payloadBase64Url);

  return `${payloadBase64Url}.${signature}`;
};

export const parseSessionToken = (tokenValue?: string | null): AuthSession | null => {
  if (!tokenValue) {
    return null;
  }

  const [payloadPart, signaturePart] = tokenValue.split('.');

  if (!payloadPart || !signaturePart) {
    return null;
  }

  const expectedSignature = signPayload(payloadPart);

  if (!safeEquals(signaturePart, expectedSignature)) {
    return null;
  }

  try {
    const payloadJson = decoder.decode(base64UrlToBuffer(payloadPart));
    const payload = JSON.parse(payloadJson) as SessionPayload;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
      return null;
    }

    if (typeof payload.email !== 'string' || !payload.email.includes('@')) {
      return null;
    }

    if (payload.role !== 'ADMIN') {
      return null;
    }

    return {
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
};
