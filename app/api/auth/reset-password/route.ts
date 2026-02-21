import { NextRequest, NextResponse } from 'next/server';
import { verifyCode, markCodeUsed, getUserByEmail, updateUser } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, verificationCode, newPassword } = await request.json();

    if (!email || !verificationCode || !newPassword) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const isValid = await verifyCode(email, verificationCode, 'reset');
    if (!isValid) {
      return NextResponse.json(
        { error: '验证码无效或已过期' },
        { status: 400 }
      );
    }

    await markCodeUsed(email, verificationCode, 'reset');

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    await updateUser(user.id, { password: newPassword });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Reset password error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '密码重置失败' },
      { status: 500 }
    );
  }
}
