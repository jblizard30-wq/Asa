// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'cpcana',
    timestamp: new Date().toISOString(),
  });
}
