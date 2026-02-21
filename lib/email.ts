/* eslint-disable no-console */
import { getSystemConfig } from './db';

/**
 * Send a verification email with a 6-digit code.
 * Uses nodemailer with SMTP settings from system config.
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  type: 'register' | 'reset'
): Promise<void> {
  const config = await getSystemConfig();
  const { smtp } = config;

  if (!smtp.host || !smtp.user || !smtp.pass) {
    throw new Error('SMTP 未配置，请联系管理员在后台设置邮件服务');
  }

  // Dynamic import to avoid bundling nodemailer on client
  const nodemailer = await import('nodemailer');

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 465,
    secure: smtp.secure !== false,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  const siteName = config.siteConfig?.siteName || 'SanHub';
  const subject = type === 'register'
    ? `${siteName} 注册验证码`
    : `${siteName} 密码重置验证码`;

  const html = `
    <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h2 style="color: #333;">${subject}</h2>
      <p style="color: #666; font-size: 14px;">您的验证码是：</p>
      <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 16px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
      </div>
      <p style="color: #999; font-size: 12px;">验证码有效期 10 分钟，请勿泄露给他人。</p>
      <p style="color: #999; font-size: 12px;">如果这不是您的操作，请忽略此邮件。</p>
    </div>
  `;

  await transporter.sendMail({
    from: smtp.from || smtp.user,
    to: email,
    subject,
    html,
  });

  console.log(`[Email] Verification code sent to ${email} (type: ${type})`);
}
