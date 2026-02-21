const REQUIRED_VARS = ['NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'] as const;

const MYSQL_VARS = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) missing.push(key);
  }

  const dbType = process.env.DB_TYPE || 'sqlite';
  if (dbType === 'mysql') {
    for (const key of MYSQL_VARS) {
      if (!process.env[key]) missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `See .env.example for reference.`
    );
  }
}
