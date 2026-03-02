import { NextRequest, NextResponse } from 'next/server';
import { extractErrorMessage, parseJsonSafe } from '@/lib/common/api-response';
import { getBackendApiBaseUrl, isOriginAllowed } from '@/lib/auth/login-security';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  if (!isOriginAllowed(request)) {
    return NextResponse.json(
      { ok: false, message: 'Solicitud no permitida.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const accessToken = request.cookies.get('lf_access_token')?.value;
  const { slug } = await context.params;

  if (!slug?.trim()) {
    return NextResponse.json(
      { ok: false, message: 'Slug de pagina invalido.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

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
    const upstreamResponse = await fetch(`${getBackendApiBaseUrl()}/admin/pages/${slug}/draft`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') ?? '',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const upstreamBody = await parseJsonSafe(upstreamResponse);

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: extractErrorMessage(upstreamBody, 'No se pudo guardar draft de pagina.'),
        },
        { status: upstreamResponse.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      upstreamBody ?? { ok: true },
      { status: upstreamResponse.status, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: 'No se pudo conectar con backend para guardar draft.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
