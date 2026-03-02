import { NextRequest, NextResponse } from 'next/server';
import { getBackendApiBaseUrl, isOriginAllowed } from '@/lib/auth/login-security';
import { parseJsonSafe } from '@/lib/common/api-response';

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
    const upstreamResponse = await fetch(`${getBackendApiBaseUrl()}/documents/render-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') ?? '',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!upstreamResponse.ok) {
      const errorBody = await parseJsonSafe(upstreamResponse);
      return NextResponse.json(
        errorBody ?? { ok: false, message: 'No se pudo renderizar PDF.' },
        {
          status: upstreamResponse.status,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    const contentType = upstreamResponse.headers.get('content-type') ?? 'application/pdf';
    const contentDisposition =
      upstreamResponse.headers.get('content-disposition') ?? 'attachment; filename="document.pdf"';
    const pdfBuffer = await upstreamResponse.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: 'No se pudo conectar con backend para render-pdf.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
