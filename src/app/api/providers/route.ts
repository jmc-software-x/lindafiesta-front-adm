import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiBaseUrl, isOriginAllowed } from '@/lib/auth/login-security';
import { parseJsonSafe } from '@/lib/common/api-response';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const backendUrl = new URL(`${getBackendApiBaseUrl()}/providers`);
  const accessToken = request.cookies.get('lf_access_token')?.value;

  request.nextUrl.searchParams.forEach((value, key) => {
    backendUrl.searchParams.set(key, value);
  });

  try {
    const upstreamResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        Cookie: request.headers.get('cookie') ?? '',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      cache: 'no-store',
    });

    const body = await parseJsonSafe(upstreamResponse);

    return NextResponse.json(
      body ?? { ok: false, message: 'Respuesta invalida del backend.' },
      { status: upstreamResponse.status, headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: 'No se pudo conectar con backend para listar proveedores.' },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { ok: false, message: 'Solicitud no permitida.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const accessToken = request.cookies.get('lf_access_token')?.value;
  let body: Record<string, unknown> = {};

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Body invalido.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const upstreamResponse = await fetch(`${getBackendApiBaseUrl()}/providers`, {
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
      { status: upstreamResponse.status, headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: 'No se pudo conectar con backend para crear proveedor.' },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}
