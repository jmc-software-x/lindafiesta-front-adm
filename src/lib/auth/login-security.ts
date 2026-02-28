import { scryptSync, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_LOCK_MS = 15 * 60 * 1000;

interface LoginAttempt {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
}

const attemptsByKey = new Map<string, LoginAttempt>();

const encoder = new TextEncoder();

const safeEquals = (left: string, right: string): boolean => {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return timingSafeEqual(leftBytes, rightBytes);
};

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
  return forwardedIp || request.ip || 'unknown';
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

  if (!normalizedEmail || !normalizedPassword) {
    return false;
  }

  if (!normalizedEmail.includes('@')) {
    return false;
  }

  if (normalizedEmail.length > 200 || normalizedPassword.length > 200) {
    return false;
  }

  if (normalizedPassword.length < 10) {
    return false;
  }

  return true;
};

export const isConfiguredCredential = (email: string, password: string): boolean => {
  const configuredEmail = process.env.ADMIN_AUTH_EMAIL;
  const configuredPasswordSalt = process.env.ADMIN_AUTH_PASSWORD_SALT;
  const configuredPasswordHash = process.env.ADMIN_AUTH_PASSWORD_HASH;

  if (!configuredEmail || !configuredPasswordSalt || !configuredPasswordHash) {
    throw new Error(
      'Missing ADMIN_AUTH_EMAIL, ADMIN_AUTH_PASSWORD_SALT or ADMIN_AUTH_PASSWORD_HASH env vars.'
    );
  }

  const providedHash = scryptSync(password, configuredPasswordSalt, 64).toString('hex');

  return (
    safeEquals(email.trim().toLowerCase(), configuredEmail.trim().toLowerCase()) &&
    safeEquals(providedHash, configuredPasswordHash)
  );
};
