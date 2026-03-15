import { NextRequest, NextResponse } from 'next/server';
import { createUser, getSystemConfig, verifyCode, markCodeUsed } from '@/lib/db';
import { checkRateLimit, RateLimitConfig } from '@/lib/rate-limit';
import { buildErrorResponse } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, RateLimitConfig.AUTH, 'auth-register');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const { name, email, password, verificationCode } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: '请填写所有必填字段' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码至少需要 6 个字符' },
        { status: 400 }
      );
    }

    // 检查是否允许注册
    const config = await getSystemConfig();
    if (!config.registerEnabled) {
      return NextResponse.json(
        { error: '当前不开放注册' },
        { status: 403 }
      );
    }

    // 校验邮箱验证码（如果 SMTP 已配置则必须验证）
    if (config.smtp?.host) {
      if (!verificationCode) {
        return NextResponse.json(
          { error: '请输入邮箱验证码' },
          { status: 400 }
        );
      }

      const isValid = await verifyCode(email, verificationCode, 'register');
      if (!isValid) {
        return NextResponse.json(
          { error: '验证码无效或已过期' },
          { status: 400 }
        );
      }

      await markCodeUsed(email, verificationCode, 'register');
    }

    // 创建用户
    const user = await createUser(email, password, name);

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return buildErrorResponse(error, {
      fallbackMessage: '注册失败',
      context: '[API] Registration',
    });
  }
}
