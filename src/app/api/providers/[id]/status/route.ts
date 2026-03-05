import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiBaseUrl, isOriginAllowed } from '@/lib/auth/login-security';
import { parseJsonSafe } from '@/lib/common/api-response';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { ok: false, message: 'Solicitud no permitida.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const accessToken = request.cookies.get('lf_access_token')?.value;
  const { id } = await context.params;

  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, message: 'Id de proveedor invalido.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

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
    const upstreamResponse = await fetch(`${getBackendApiBaseUrl()}/providers/${id}/status`, {
      method: 'PATCH',
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
      { ok: false, message: 'No se pudo conectar con backend para cambiar estado del proveedor.' },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}
