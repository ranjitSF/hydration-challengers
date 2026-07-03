const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const connectionString = process.argv[2] || process.env.DATABASE_URL;
  const schemaFile = process.argv[3] || path.join(__dirname, 'server', 'database', 'schema.sql');

  if (!connectionString) {
    console.error('Usage: node run-migration.cjs <DATABASE_URL> [schema.sql]');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  const schema = fs.readFileSync(schemaFile, 'utf8');
  await client.query(schema);
  console.log(`✓ Ran ${schemaFile}`);
  await client.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
