const mysql = require('mysql2/promise');
const fs = require('fs');

async function test() {
  const env = {};
  fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const [key, ...val] = line.split('=');
    if (key && val.length) env[key.trim()] = val.join('=').trim();
  });

  // 使用与 db-adapter.ts 完全相同的配置
  const pool = mysql.createPool({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306'),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sanhub',
  });

  // 在每个新连接上设置 utf8mb4
  pool.pool.on('connection', (connection) => {
    connection.query("SET NAMES 'utf8mb4'");
  });

  try {
    // 检查连接字符集
    const [charsetRows] = await pool.execute(`
      SELECT @@character_set_client AS client, @@character_set_connection AS conn, @@character_set_results AS results
    `);
    console.log('连接字符集:', charsetRows[0]);

    // 测试 emoji 插入
    const testId = 'pool_test_' + Date.now();
    const testPrompt = '猫 🖼️图片1和狗 🎬视频1';

    await pool.execute(`
      INSERT INTO generations (id, user_id, type, prompt, status, created_at, updated_at)
      VALUES (?, 'test_user', 'sora-video', ?, 'pending', NOW(), NOW())
    `, [testId, testPrompt]);

    console.log('✅ Pool 插入 emoji 成功!');

    // 读回验证
    const [rows] = await pool.execute('SELECT prompt FROM generations WHERE id = ?', [testId]);
    console.log('读回:', rows[0].prompt);
    console.log('匹配:', rows[0].prompt === testPrompt ? '✅' : '❌');

    // 清理
    await pool.execute('DELETE FROM generations WHERE id = ?', [testId]);
  } catch (error) {
    console.error('❌ 失败:', error.message);
  } finally {
    await pool.end();
  }
}

test();
