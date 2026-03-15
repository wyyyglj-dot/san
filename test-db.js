// 测试数据库连接
const { createDatabaseAdapter } = require('./lib/db-adapter.ts');

async function test() {
  try {
    console.log('Testing database connection...');
    console.log('DB_TYPE:', process.env.DB_TYPE || 'sqlite');
    
    const adapter = createDatabaseAdapter();
    
    // 测试简单查询
    const testSQL = `
      CREATE TABLE IF NOT EXISTS test_table (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `;
    
    await adapter.execute(testSQL);
    console.log('✓ Table created successfully');
    
    // 插入测试数据
    await adapter.execute(
      'INSERT INTO test_table (id, name, created_at) VALUES (?, ?, ?)',
      ['test-1', 'Test Name', Date.now()]
    );
    console.log('✓ Data inserted successfully');
    
    // 查询测试数据
    const [rows] = await adapter.execute('SELECT * FROM test_table');
    console.log('✓ Data queried successfully:', rows);
    
    // 清理
    await adapter.execute('DROP TABLE test_table');
    console.log('✓ Table dropped successfully');
    
    await adapter.close();
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

test();
