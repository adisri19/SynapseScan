const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
let databaseUrl = '';
try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.startsWith('DATABASE_URL=')) {
        databaseUrl = line.split('DATABASE_URL=')[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
} catch (err) {
  console.error("Error reading .env.local manually:", err);
}

if (!databaseUrl) {
  console.error("No DATABASE_URL found in .env.local");
  process.exit(1);
}

const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function main() {
  console.log("Connecting directly to database IP...");
  const client = await pool.connect();
  try {
    console.log("Connected successfully! Checking tables...");

    const tables = ['tenants', 'repositories', 'analysis_runs', 'file_metrics', 'duplications', 'ingestion_sessions'];
    for (const table of tables) {
      try {
        const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`Table "${table}" exists. Row count: ${res.rows[0].count}`);
      } catch (err) {
        console.error(`Error checking table "${table}":`, err.message);
      }
    }

    console.log("\nChecking default tenant seed...");
    try {
      const res = await client.query(`SELECT id, name, slug FROM tenants WHERE id = 'd290f1ee-6c54-4b01-90e6-d701748f0851'`);
      if (res.rows.length > 0) {
        console.log("Default tenant seed exists:", res.rows[0]);
      } else {
        console.log("Default tenant seed DOES NOT exist! Seeding now...");
        await client.query(`INSERT INTO tenants (id, name, slug) VALUES ('d290f1ee-6c54-4b01-90e6-d701748f0851', 'Demo Workspace', 'demo-workspace') ON CONFLICT DO NOTHING`);
        console.log("Seeding successful!");
      }
    } catch (err) {
      console.error("Error checking default tenant seed:", err.message);
    }

  } catch (err) {
    console.error("Database connection/query error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
