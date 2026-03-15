# MySQL UTF8MB4 字符集升级指南

## 问题描述

当前数据库使用 `utf8` 字符集（最多 3 字节），无法存储 emoji 等 4 字节 Unicode 字符。
错误信息：`Incorrect string value: '\xF0\x9F\x96\xBC\xEF\xB8...' for column 'prompt'`

## 解决方案

升级数据库和相关表到 `utf8mb4` 字符集（支持 4 字节字符）。

## 修改内容

### 1. 代码修改

**文件**: `lib/db-adapter.ts`

在 MySQL 连接池配置中添加了 `charset: 'utf8mb4'`：

```typescript
this.pool = mysql.createPool({
  // ... 其他配置
  charset: 'utf8mb4',  // 新增
  // ... 其他配置
});
```

### 2. 数据库迁移

**迁移脚本**: `scripts/migrate-utf8mb4.sql`

执行以下命令升级数据库：

```bash
# 方式 1：直接执行 SQL 文件
mysql -h your_host -u sanhub -p sanhub < scripts/migrate-utf8mb4.sql

# 方式 2：登录后执行
mysql -h your_host -u sanhub -p
USE sanhub;
SOURCE scripts/migrate-utf8mb4.sql;
```

**影响的表**：
- `generations` - 生成记录（主要问题表）
- `users` - 用户信息
- `character_cards` - 角色卡
- `comic_projects` - 漫剧项目
- `comic_episodes` - 漫剧剧集
- `project_assets` - 项目素材

### 3. 回滚方案

如果需要回滚（不推荐），执行：

```bash
mysql -h your_host -u sanhub -p sanhub < scripts/rollback-utf8.sql
```

**警告**：回滚后将无法存储 emoji 等 4 字节字符。

## 部署步骤

### 生产环境部署

1. **备份数据库**（重要！）
   ```bash
   mysqldump -h your_host -u sanhub -p sanhub > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **执行数据库迁移**
   ```bash
   mysql -h your_host -u sanhub -p sanhub < scripts/migrate-utf8mb4.sql
   ```

3. **验证字符集**
   ```sql
   SELECT TABLE_NAME, TABLE_COLLATION
   FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = 'sanhub'
   AND TABLE_TYPE = 'BASE TABLE';
   ```

   确认所有表的 `TABLE_COLLATION` 为 `utf8mb4_unicode_ci`。

4. **更新代码**
   - 上传修改后的 `lib/db-adapter.ts`

5. **重启应用**
   ```bash
   # Docker 环境
   docker-compose restart

   # 或者
   docker-compose down
   docker-compose up -d
   ```

6. **测试验证**
   - 尝试生成包含 emoji 的视频
   - 检查是否还有字符集错误

## 注意事项

1. **数据库连接字符串**：
   - 如果使用 `MYSQL_DATABASE_URL`，确保包含 `charset=utf8mb4`
   - 示例：`mysql://user:pass@host:3306/sanhub?charset=utf8mb4`

2. **磁盘空间**：
   - `utf8mb4` 可能会增加存储空间（每个字符最多 4 字节 vs 3 字节）
   - 对于英文为主的数据，影响很小

3. **索引长度限制**：
   - MySQL 对索引长度有限制（InnoDB 默认 767 字节）
   - 如果有 `VARCHAR(255)` 的索引列，可能需要调整为 `VARCHAR(191)`
   - 当前项目未发现此问题

4. **性能影响**：
   - `utf8mb4` 对性能影响极小，可以忽略

## 验证测试

部署后，使用包含 emoji 的提示词测试：

```
猫 🖼️图片1和狗 🎬视频1
```

应该能够成功保存到数据库，不再报错。

## 故障排查

### 问题 1：迁移脚本执行失败

**可能原因**：表中已有数据包含无效的 UTF-8 序列

**解决方案**：
```sql
-- 先修复无效数据
UPDATE generations SET prompt = CONVERT(CAST(CONVERT(prompt USING latin1) AS BINARY) USING utf8mb4);

-- 再执行迁移
ALTER TABLE generations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 问题 2：连接后仍然报错

**可能原因**：连接未使用 utf8mb4

**解决方案**：
1. 检查 `.env` 中的 `MYSQL_DATABASE_URL` 是否包含 `charset=utf8mb4`
2. 重启应用确保新配置生效
3. 检查 MySQL 服务器的 `character_set_server` 配置

### 问题 3：部分表未升级

**解决方案**：
```sql
-- 查看所有表的字符集
SHOW TABLE STATUS WHERE Name LIKE '%';

-- 手动升级特定表
ALTER TABLE table_name CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 参考资料

- [MySQL UTF8MB4 官方文档](https://dev.mysql.com/doc/refman/8.0/en/charset-unicode-utf8mb4.html)
- [Emoji 和 MySQL 字符集问题](https://mathiasbynens.be/notes/mysql-utf8mb4)
