export function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const message = record.message;

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (Array.isArray(message)) {
    const joined = message.filter((item) => typeof item === 'string').join(' | ');
    if (joined) {
      return joined;
    }
  }

  return fallback;
}

export async function parseJsonSafe(response: Response): Promise<unknown | null> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}
