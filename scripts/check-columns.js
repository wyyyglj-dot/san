const mysql = require('mysql2/promise');
const fs = require('fs');

async function check() {
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

  console.log('检查 generations 表的字段字符集...\n');

  const [rows] = await conn.execute(`
    SELECT COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME, COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'generations'
    AND COLUMN_NAME IN ('prompt', 'error_message')
  `, [env.MYSQL_DATABASE || 'sanhub']);

  console.table(rows);

  await conn.end();
}

check();
