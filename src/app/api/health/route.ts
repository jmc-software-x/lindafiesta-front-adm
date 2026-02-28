import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'lindafiestas-front-admin',
    timestamp: new Date().toISOString(),
  });
}
