import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

describe('PostgreSQL Live Authentication & Connection Integration Test', () => {
  let pool: Pool;
  let databaseUrl: string = '';

  beforeAll(() => {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        if (line.startsWith('DATABASE_URL=')) {
          databaseUrl = line.split('DATABASE_URL=')[1].trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('successfully authenticates and queries live PostgreSQL database without password error', async () => {
    expect(databaseUrl).not.toBe('');

    const isLocalDb = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocalDb ? false : { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
      const result = await client.query('SELECT current_user, current_database()');
      expect(result.rows[0].current_user).toBe('postgres');
      expect(result.rows[0].current_database).toBe('synapsescan');
    } finally {
      client.release();
    }
  });
});
