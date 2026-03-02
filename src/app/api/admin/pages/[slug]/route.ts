import { NextRequest, NextResponse } from 'next/server';
import { parseJsonSafe } from '@/lib/common/api-response';
import { getBackendApiBaseUrl } from '@/lib/auth/login-security';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const accessToken = request.cookies.get('lf_access_token')?.value;
  const { slug } = await context.params;

  if (!slug?.trim()) {
    return NextResponse.json(
      { ok: false, message: 'Slug de pagina invalido.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const backendUrl = new URL(`${getBackendApiBaseUrl()}/admin/pages/${slug}`);

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
      {
        status: upstreamResponse.status,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: 'No se pudo conectar con backend para obtener la pagina.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
