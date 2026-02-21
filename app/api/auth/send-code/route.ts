/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';
import { saveVerificationCode, getRecentVerificationCode, getUserByEmail } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, type } = await request.json();

    if (!email || !type || !['register', 'reset'].includes(type)) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }

    // Rate limit: 60s per email+type
    const recent = await getRecentVerificationCode(email, type);
    if (recent && Date.now() - recent.createdAt < 60000) {
      return NextResponse.json({ error: '请稍后再试（60秒内只能发送一次）' }, { status: 429 });
    }

    // Check email existence based on type
    const existingUser = await getUserByEmail(email);
    if (type === 'register' && existingUser) {
      return NextResponse.json({ error: '该邮箱已注册' }, { status: 400 });
    }
    if (type === 'reset' && !existingUser) {
      return NextResponse.json({ error: '该邮箱未注册' }, { status: 400 });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    await saveVerificationCode(email, code, type);
    await sendVerificationEmail(email, code, type);

    return NextResponse.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    console.error('[API] Send verification code error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '发送验证码失败' },
      { status: 500 }
    );
  }
}
