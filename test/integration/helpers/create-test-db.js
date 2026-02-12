/**
 * Script tạo database test (perfume_gpt_ai_test) nếu chưa tồn tại.
 * Chạy: node test/integration/helpers/create-test-db.js
 */
const { Client } = require('pg');

async function main() {
  // Đọc config từ host-config.mjs
  let config;
  try {
    const mod = await import('../../../host-config.mjs');
    config = mod.host_config;
  } catch {
    config = { host: 'localhost', port: 5432, user: 'postgres', password: 'password' };
  }

  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres',
  });

  try {
    await client.connect();
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'perfume_gpt_ai_test'"
    );

    if (res.rows.length === 0) {
      await client.query('CREATE DATABASE perfume_gpt_ai_test');
      console.log('Created database: perfume_gpt_ai_test');
    } else {
      console.log('Database perfume_gpt_ai_test already exists');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
