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

  const conn = await mysql.createConnection({
    host: (env.MYSQL_HOST || 'localhost').split('?')[0],
    port: parseInt(env.MYSQL_PORT || '3306'),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sanhub',
    charset: 'utf8mb4',
  });

  // 显式设置字符集
  await conn.execute("SET NAMES 'utf8mb4'");

  console.log('🧪 测试 emoji 存储...\n');

  const testPrompt = '猫 🖼️图片1和狗 🎬视频1 测试 emoji 存储 ✅🎉🚀';
  const testId = 'test_' + Date.now();

  try {
    // 检查连接字符集
    console.log('检查连接字符集...');
    const [charsetRows] = await conn.execute(`
      SELECT @@character_set_client, @@character_set_connection, @@character_set_results, @@character_set_database
    `);
    console.table(charsetRows);

    console.log('\n插入测试数据...');
    console.log('Prompt:', testPrompt);

    await conn.execute(`
      INSERT INTO generations (id, user_id, type, prompt, status, created_at, updated_at)
      VALUES (?, 'test_user', 'sora-video', ?, 'pending', NOW(), NOW())
    `, [testId, testPrompt]);

    console.log('✅ 插入成功\n');

    console.log('读取测试数据...');
    const [rows] = await conn.execute(`
      SELECT id, prompt FROM generations WHERE id = ?
    `, [testId]);

    if (rows.length > 0) {
      console.log('✅ 读取成功');
      console.log('存储的 Prompt:', rows[0].prompt);

      if (rows[0].prompt === testPrompt) {
        console.log('\n🎉 测试通过！emoji 存储和读取完全正常！');
      } else {
        console.log('\n⚠️ 警告：读取的数据与原始数据不一致');
      }
    }

    console.log('\n清理测试数据...');
    await conn.execute('DELETE FROM generations WHERE id = ?', [testId]);
    console.log('✅ 清理完成');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error);
  } finally {
    await conn.end();
  }
}

test();
