import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiBaseUrl, isOriginAllowed } from '@/lib/auth/login-security';

async function parseJsonSafe(response: Response): Promise<unknown | null> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { ok: false, message: 'Solicitud no permitida.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const accessToken = request.cookies.get('lf_access_token')?.value;

  let body: Record<string, unknown> = {};

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Body invalido.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const upstreamResponse = await fetch(`${getBackendApiBaseUrl()}/files/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') ?? '',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const upstreamBody = await parseJsonSafe(upstreamResponse);

    return NextResponse.json(
      upstreamBody ?? { ok: false, message: 'Respuesta invalida del backend.' },
      {
        status: upstreamResponse.status,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: 'No se pudo conectar con backend para presign.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
