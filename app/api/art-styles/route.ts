import { NextResponse } from 'next/server';
import { getActiveArtStyles } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const styles = await getActiveArtStyles();
    return NextResponse.json({ success: true, data: styles });
  } catch (error) {
    console.error('[API] Get active art styles error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取画风列表失败' },
      { status: 500 }
    );
  }
}
