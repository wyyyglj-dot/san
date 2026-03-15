#!/usr/bin/env node
/**
 * MySQL UTF8MB4 字符集迁移脚本
 * 用途：将数据库和表从 utf8 升级到 utf8mb4 以支持 emoji
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });

  return env;
}

async function migrate() {
  console.log('🚀 开始 UTF8MB4 字符集迁移...\n');

  const env = loadEnv();
  const host = (env.MYSQL_HOST || 'localhost').split('?')[0];
  const port = parseInt(env.MYSQL_PORT || '3306');
  const user = env.MYSQL_USER || 'root';
  const password = env.MYSQL_PASSWORD || '';
  const database = env.MYSQL_DATABASE || 'sanhub';

  console.log(`连接信息: ${user}@${host}:${port}/${database}\n`);

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  try {
    console.log('✅ 数据库连接成功\n');

    const sqlFile = path.join(__dirname, 'migrate-utf8mb4.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (!statement) continue;

      console.log(`执行: ${statement.substring(0, 80)}...`);
      await connection.execute(statement);
      console.log('✅ 完成\n');
    }

    console.log('🎉 迁移完成！\n');
    console.log('验证结果：');

    const [rows] = await connection.execute(`
      SELECT TABLE_NAME, TABLE_COLLATION
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `, [database]);

    console.table(rows);

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
