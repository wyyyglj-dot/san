
import { getSafeVideoModels } from '@/lib/db';

// Manually set env vars
process.env.DB_TYPE = 'mysql';
process.env.MYSQL_HOST = 'localhost';
process.env.MYSQL_PORT = '3306';
process.env.MYSQL_USER = 'sanhub';
process.env.MYSQL_PASSWORD = 'Qq1314520.';
process.env.MYSQL_DATABASE = 'sanhub';

async function main() {
  try {
    const models = await getSafeVideoModels();
    console.log(JSON.stringify(models, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
