import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/api-handler';

export const POST = adminHandler(async (request: Request) => {
  const { smtp } = await request.json();

  if (!smtp?.host || !smtp?.user || !smtp?.pass) {
    return NextResponse.json({ error: '请填写完整的 SMTP 配置' }, { status: 400 });
  }

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 465,
    secure: smtp.secure !== false,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const to = smtp.user;
  await transporter.sendMail({
    from: smtp.from || smtp.user,
    to,
    subject: 'SanHub SMTP 测试邮件',
    html: `<div style="font-family:sans-serif;padding:20px">
      <h2>SMTP 配置测试成功</h2>
      <p>如果您收到此邮件，说明 SMTP 配置正确。</p>
      <p style="color:#888;font-size:12px">此邮件由 SanHub 管理后台发送</p>
    </div>`,
  });

  return NextResponse.json({ success: true, message: `测试邮件已发送到 ${to}` });
}, { fallbackMessage: 'SMTP 测试失败', context: '[API] test-email' });
