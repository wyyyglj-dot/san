import { NextResponse } from 'next/server';
import { getSystemConfig, updateSystemConfig } from '@/lib/db';
import { adminHandler } from '@/lib/api-handler';

async function loginSoraBackend(baseUrl: string, username: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || '登录 SORA 后台失败');
  }

  return data.token;
}

async function getTokensList(baseUrl: string, adminToken: string): Promise<any[]> {
  const res = await fetch(`${baseUrl}/api/tokens`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  return await res.json();
}

async function ensureAdminToken(config: {
  soraBackendUrl: string;
  soraBackendUsername: string;
  soraBackendPassword: string;
  soraBackendToken: string;
}): Promise<{ token: string | null; loginAttempted: boolean; loginError?: string }> {
  if (!config.soraBackendUrl) {
    return { token: null, loginAttempted: false };
  }

  if (config.soraBackendToken) {
    try {
      await getTokensList(config.soraBackendUrl, config.soraBackendToken);
      return { token: config.soraBackendToken, loginAttempted: false };
    } catch {
      // token invalid, try re-login
    }
  }

  if (!config.soraBackendUsername || !config.soraBackendPassword) {
    return { token: null, loginAttempted: false };
  }

  try {
    const newToken = await loginSoraBackend(
      config.soraBackendUrl,
      config.soraBackendUsername,
      config.soraBackendPassword
    );
    await updateSystemConfig({ soraBackendToken: newToken });
    return { token: newToken, loginAttempted: true };
  } catch (e) {
    return { token: null, loginAttempted: true, loginError: e instanceof Error ? e.message : String(e) };
  }
}

export const GET = adminHandler(async () => {
  const config = await getSystemConfig();

  let tokensResult = null;
  let tokensError = null;
  let loginInfo = null;

  if (config.soraBackendUrl) {
    const { token, loginAttempted, loginError } = await ensureAdminToken(config);

    loginInfo = {
      loginAttempted,
      loginError: loginError || null,
      tokenObtained: !!token,
    };

    if (token) {
      try {
        const tokens = await getTokensList(config.soraBackendUrl, token);
        let totalRemaining = 0;
        let activeCount = 0;
        if (Array.isArray(tokens)) {
          for (const t of tokens) {
            if (t.is_active && typeof t.sora2_remaining_count === 'number') {
              totalRemaining += t.sora2_remaining_count;
              activeCount++;
            }
          }
        }
        tokensResult = {
          totalTokens: Array.isArray(tokens) ? tokens.length : 0,
          activeCount,
          totalRemaining,
          video10sCount: totalRemaining,
          video15sCount: Math.floor(totalRemaining / 2),
        };
      } catch (e) {
        tokensError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  return NextResponse.json({
    success: true,
    config: {
      backendUrl: config.soraBackendUrl || '(empty)',
      backendToken: config.soraBackendToken ? `${config.soraBackendToken.substring(0, 20)}...` : '(empty)',
      hasUsername: !!config.soraBackendUsername,
      hasPassword: !!config.soraBackendPassword,
    },
    loginInfo,
    announcement: config.announcement,
    tokensResult,
    tokensError,
  });
}, { fallbackMessage: '查询失败', context: '[API] Debug quota' });
