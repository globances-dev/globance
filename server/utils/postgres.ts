import { Pool } from 'pg';

let pool: Pool | null = null;

/**
 * Get the PostgreSQL connection pool
 * Uses DATABASE_URL environment variable (set in Netlify and local development)
 */
export function getPostgresPool() {
  if (pool) return pool;
  return initializePool();
}

function initializePool() {
  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    console.log('[PostgreSQL] 🔧 Initializing database connection...');
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
      // Optimize for serverless: reuse connections between invocations
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL] ❌ Pool error:', err);
      pool = null;
    });

    console.log('[PostgreSQL] ✓ Database pool created');
    return pool;
  } catch (error: any) {
    console.error('[PostgreSQL] ✗ Failed to initialize database:', error.message);
    throw error;
  }
}

export async function queryPostgres(sql: string, params: any[] = []) {
  try {
    const pool = getPostgresPool();
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error: any) {
    console.error('[PostgreSQL] Query error:', error.message);
    throw error;
  }
}

/**
 * Get environment info for logging/debugging
 */
export function getEnvironmentInfo() {
  const environment = process.env.ENVIRONMENT || 'development';
  return {
    environment: environment.toUpperCase(),
    database: 'Neon PostgreSQL (DATABASE_URL)',
    mode: environment === 'production' ? '🚀 Production' : '🔧 Development',
  };
}
