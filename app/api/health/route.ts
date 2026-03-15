import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/db';
import { getSharedAdapter, getDbHealthState } from '@/lib/db-connection';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initializeDatabase();

    // Real-time DB connectivity probe
    const adapter = getSharedAdapter();
    await adapter.execute('SELECT 1');

    // Also check background health state
    const state = getDbHealthState();
    if (state === 'unhealthy') {
      return NextResponse.json({ status: 'error' }, { status: 503 });
    }

    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
