import type { NextRequest } from 'next/server';

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_LOCK_MS = 15 * 60 * 1000;
const DEFAULT_MIN_PASSWORD_LENGTH = process.env.NODE_ENV === 'production' ? 12 : 8;

interface LoginAttempt {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
}

const attemptsByKey = new Map<string, LoginAttempt>();

const clearExpiredAttempts = (nowMs: number) => {
  attemptsByKey.forEach((value, key) => {
    const isWindowExpired = nowMs - value.firstAttemptAt > AUTH_WINDOW_MS;
    const isLockExpired = !value.blockedUntil || nowMs > value.blockedUntil;

    if (isWindowExpired && isLockExpired) {
      attemptsByKey.delete(key);
    }
  });
};

const getClientKey = (request: NextRequest): string => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const forwardedIp = forwardedFor?.split(',')[0]?.trim();
  return forwardedIp || 'unknown';
};

export const isOriginAllowed = (request: NextRequest): boolean => {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  if (!origin || !host) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
};

export const isLoginRateLimited = (request: NextRequest): boolean => {
  const nowMs = Date.now();
  clearExpiredAttempts(nowMs);

  const key = getClientKey(request);
  const attempt = attemptsByKey.get(key);

  if (!attempt) {
    return false;
  }

  if (attempt.blockedUntil && nowMs < attempt.blockedUntil) {
    return true;
  }

  return false;
};

export const registerFailedLoginAttempt = (request: NextRequest): void => {
  const nowMs = Date.now();
  const key = getClientKey(request);
  const attempt = attemptsByKey.get(key);

  if (!attempt || nowMs - attempt.firstAttemptAt > AUTH_WINDOW_MS) {
    attemptsByKey.set(key, {
      count: 1,
      firstAttemptAt: nowMs,
      blockedUntil: null,
    });
    return;
  }

  const updatedCount = attempt.count + 1;
  const isBlocked = updatedCount >= AUTH_MAX_ATTEMPTS;

  attemptsByKey.set(key, {
    count: updatedCount,
    firstAttemptAt: attempt.firstAttemptAt,
    blockedUntil: isBlocked ? nowMs + AUTH_LOCK_MS : null,
  });
};

export const clearFailedLoginAttempts = (request: NextRequest): void => {
  const key = getClientKey(request);
  attemptsByKey.delete(key);
};

export const validateLoginInput = (email: string, password: string): boolean => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const configuredMinPasswordLength = Number(process.env.ADMIN_AUTH_MIN_PASSWORD_LENGTH);
  const minPasswordLength = Number.isFinite(configuredMinPasswordLength)
    ? Math.max(8, Math.min(configuredMinPasswordLength, 128))
    : DEFAULT_MIN_PASSWORD_LENGTH;

  if (!normalizedEmail || !normalizedPassword) {
    return false;
  }

  if (!normalizedEmail.includes('@')) {
    return false;
  }

  if (normalizedEmail.length > 200 || normalizedPassword.length > 200) {
    return false;
  }

  if (normalizedPassword.length < minPasswordLength) {
    return false;
  }

  return true;
};

export const normalizeTenantId = (tenantId?: string): string => {
  return tenantId?.trim() || '';
};

export const isTenantIdValid = (tenantId: string): boolean => {
  if (!tenantId) {
    return false;
  }

  if (tenantId.length < 2 || tenantId.length > 120) {
    return false;
  }

  return /^[a-zA-Z0-9._-]+$/.test(tenantId);
};

export const getBackendApiBaseUrl = (): string => {
  const configured = process.env.BACKEND_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  return 'http://127.0.0.1:3000/v100';
};

export const getDefaultTenantId = (): string => {
  return process.env.AUTH_DEFAULT_TENANT_ID?.trim() || 'lindafiestas';
};

export const appendSetCookieHeaders = (headers: Headers, targetHeaders: Headers): void => {
  const anyHeaders = headers as unknown as { getSetCookie?: () => string[] };
  const setCookies =
    typeof anyHeaders.getSetCookie === 'function' ? anyHeaders.getSetCookie() : [];

  setCookies.forEach((cookieValue) => {
    targetHeaders.append('set-cookie', cookieValue);
  });

  if (setCookies.length > 0) {
    return;
  }

  const mergedSetCookie = headers.get('set-cookie');
  if (!mergedSetCookie) {
    return;
  }

  targetHeaders.append('set-cookie', mergedSetCookie);
};

export const extractCookieValueFromSetCookie = (
  headers: Headers,
  cookieName: string
): string | null => {
  const anyHeaders = headers as unknown as { getSetCookie?: () => string[] };
  const fromSetCookieMethod =
    typeof anyHeaders.getSetCookie === 'function' ? anyHeaders.getSetCookie() : [];

  const candidates = [...fromSetCookieMethod];
  const merged = headers.get('set-cookie');
  if (merged) {
    candidates.push(merged);
  }

  for (const candidate of candidates) {
    const pattern = new RegExp(`${cookieName}=([^;]+)`);
    const match = candidate.match(pattern);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
};
