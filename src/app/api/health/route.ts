// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  let dbInfo: any = null;
  let navColumns: any = null;
  let error: string | null = null;

  try {
    const rawUrl = process.env.DATABASE_URL || '';
    const hostMatch = rawUrl.match(/@([^/]+)\/([^?]+)/);
    const host = hostMatch ? hostMatch[1] : 'unknown';
    const db = hostMatch ? hostMatch[2] : 'unknown';

    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name::text FROM information_schema.columns WHERE table_name = 'NavPreference'
    `;

    dbInfo = { host, db };
    navColumns = cols.map((c) => c.column_name);
  } catch (err: any) {
    error = err?.message || String(err);
  }

  return NextResponse.json({
    status: error ? 'degraded' : 'ok',
    app: 'cpcana',
    dbInfo,
    navColumns,
    error,
    timestamp: new Date().toISOString(),
  });
}

