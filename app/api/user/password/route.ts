import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getUserById, updateUser, verifyPassword } from '@/lib/db';

export const POST = authHandler(async (req, ctx, session) => {
  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword) {
    return NextResponse.json({ error: '请输入当前密码' }, { status: 400 });
  }

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: '新密码至少 6 个字符' }, { status: 400 });
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  const valid = await verifyPassword(user.email, currentPassword);
  if (!valid) {
    return NextResponse.json({ error: '当前密码错误' }, { status: 401 });
  }

  await updateUser(session.user.id, { password: newPassword });

  return NextResponse.json({ success: true, message: '密码修改成功' });
});
