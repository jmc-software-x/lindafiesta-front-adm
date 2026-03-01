import { NextResponse } from 'next/server';
import { getBackendApiBaseUrl } from '@/lib/auth/login-security';

interface PublicTenant {
  id: string;
  name: string;
}

const isPublicTenant = (value: unknown): value is PublicTenant => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const tenant = value as Record<string, unknown>;
  return typeof tenant.id === 'string' && typeof tenant.name === 'string';
};

export async function GET() {
  const backendBaseUrl = getBackendApiBaseUrl();
  const upstreamUrl = `${backendBaseUrl}/tenants/public`;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { ok: false, message: 'No se pudo obtener lista de tenants.' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const upstreamBody = (await upstreamResponse.json()) as unknown;
    const tenants = Array.isArray(upstreamBody)
      ? upstreamBody.filter(isPublicTenant).map((tenant) => ({
          id: tenant.id.trim(),
          name: tenant.name.trim(),
        }))
      : [];

    return NextResponse.json(
      { ok: true, tenants },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: 'No se pudo conectar con backend para obtener tenants.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
