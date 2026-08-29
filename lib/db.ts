import { Pool, QueryResult, QueryResultRow, PoolClient } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is missing.');
}

const isLocalDb = process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (err) {
    console.error('PostgreSQL query execution failed:', { text, params, error: err });
    throw err;
  }
}

// Background auto-migration helper running via your permitted dev server session
let isMigrated = false;
export async function runAutoMigrations() {
  if (isMigrated) return;
  const client = await pool.connect();
  try {
    console.log('[CodePulse Engine] Booting auto-migration routines for RAG layers...');
    
    // Enable uuid-ossp and vector extensions safely
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS "vector"');
    } catch (e: any) {
      console.warn('[CodePulse Engine] PgVector extension enable skipped (handled by cloud provider):', e.message);
    }

    // Ensure code_chunks table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS code_chunks (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        run_id       UUID NOT NULL,
        file_path    VARCHAR NOT NULL,
        chunk_index  INTEGER NOT NULL,
        start_line   INTEGER NOT NULL,
        end_line     INTEGER NOT NULL,
        symbol_name  VARCHAR(100),
        symbol_type  VARCHAR(50),
        content      TEXT NOT NULL,
        embedding    vector(64)
      );
    `);

    // Add missing RAG columns if not present
    await client.query(`
      ALTER TABLE code_chunks 
        ADD COLUMN IF NOT EXISTS symbol_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS symbol_type VARCHAR(50);
    `);

    // Add indices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_code_chunks_symbol_name ON code_chunks(symbol_name);
    `);
    
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_code_chunks_run_id ON code_chunks(run_id);
      `);
    } catch {
      // Ignored
    }

    console.log('[CodePulse Engine] 🎉 RAG and column migrations completed successfully!');
    isMigrated = true;
  } catch (err: any) {
    console.error('[CodePulse Engine] ⚠️ Background auto-migration error:', err.message);
  } finally {
    client.release();
  }
}

// Trigger background migration on module import asynchronously
if (typeof window === 'undefined') {
  runAutoMigrations().catch(e => console.error('[CodePulse Engine] Auto-migration startup panic:', e));
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PostgreSQL transaction rolled back due to error:', err);
    throw err;
  } finally {
    client.release();
  }
}
