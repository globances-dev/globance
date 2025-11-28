import { Pool } from 'pg';

let devPool: Pool | null = null;
let prodPool: Pool | null = null;

/**
 * Get the appropriate database pool based on environment
 * Development: DATABASE_URL_DEV (used in Replit workspace)
 * Production: DATABASE_URL_PROD (used in deployed/live platform)
 */
export function getPostgresPool() {
  const isProduction = process.env.ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production';
  const targetPool = isProduction ? 'prodPool' : 'devPool';
  
  if (isProduction) {
    if (prodPool) return prodPool;
    return initializeProdPool();
  } else {
    if (devPool) return devPool;
    return initializeDevPool();
  }
}

function initializeDevPool() {
  try {
    // Use DATABASE_URL_DEV for development, fallback to DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL_DEV or DATABASE_URL not set');
    }

    console.log('[PostgreSQL] 🔧 Initializing DEVELOPMENT database connection...');
    devPool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    devPool.on('error', (err) => {
      console.error('[PostgreSQL] ❌ Dev pool error:', err);
      devPool = null;
    });

    console.log('[PostgreSQL] ✓ Development database pool created');
    return devPool;
  } catch (error: any) {
    console.error('[PostgreSQL] ✗ Failed to initialize dev database:', error.message);
    throw error;
  }
}

function initializeProdPool() {
  try {
    const databaseUrl = process.env.DATABASE_URL_PROD;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL_PROD not set for production environment');
    }

    console.log('[PostgreSQL] 🚀 Initializing PRODUCTION database connection...');
    prodPool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    prodPool.on('error', (err) => {
      console.error('[PostgreSQL] ❌ Prod pool error:', err);
      prodPool = null;
    });

    console.log('[PostgreSQL] ✓ Production database pool created');
    return prodPool;
  } catch (error: any) {
    console.error('[PostgreSQL] ✗ Failed to initialize prod database:', error.message);
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
  const isProduction = process.env.ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production';
  return {
    environment: isProduction ? 'PRODUCTION' : 'DEVELOPMENT',
    database: isProduction ? 'DATABASE_URL_PROD' : 'DATABASE_URL_DEV',
    mode: isProduction ? '🚀 Production' : '🔧 Development',
  };
}
