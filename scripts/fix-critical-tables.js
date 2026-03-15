const mysql = require('mysql2/promise');
const fs = require('fs');

async function fix() {
  const env = {};
  fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const [key, ...val] = line.split('=');
    if (key && val.length) env[key.trim()] = val.join('=').trim();
  });

  const conn = await mysql.createConnection({
    host: (env.MYSQL_HOST || 'localhost').split('?')[0],
    port: parseInt(env.MYSQL_PORT || '3306'),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sanhub',
  });

  console.log('转换 generations 表...');
  await conn.execute('ALTER TABLE generations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  console.log('✅ generations 表转换完成\n');

  console.log('转换 users 表...');
  await conn.execute('ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  console.log('✅ users 表转换完成\n');

  const [rows] = await conn.execute(`
    SELECT TABLE_NAME, TABLE_COLLATION
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('generations', 'users')
  `, [env.MYSQL_DATABASE || 'sanhub']);

  console.log('验证结果:');
  console.table(rows);

  await conn.end();
}

fix().catch(console.error);
