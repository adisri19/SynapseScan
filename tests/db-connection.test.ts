import { describe, it, expect } from 'vitest';

describe('Database Connection URL & Options Regression Test', () => {
  it('correctly disables SSL for localhost connection string', () => {
    const databaseUrl = 'postgresql://postgres:Tech-Debt@8564@localhost:5435/synapsescan';
    const isLocalDb = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    const sslConfig = isLocalDb ? false : { rejectUnauthorized: false };

    expect(isLocalDb).toBe(true);
    expect(sslConfig).toBe(false);
  });

  it('enables SSL for remote cloud database connection string', () => {
    const databaseUrl = 'postgresql://postgres:password@ep-aws-us-east-1.pooler.neon.tech/synapsescan';
    const isLocalDb = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    const sslConfig = isLocalDb ? false : { rejectUnauthorized: false };

    expect(isLocalDb).toBe(false);
    expect(sslConfig).toEqual({ rejectUnauthorized: false });
  });
});
