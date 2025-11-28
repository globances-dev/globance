import { neon, NeonQueryFunction } from "@neondatabase/serverless";

let neonClient: NeonQueryFunction | null = null;

/**
 * Neon Serverless PostgreSQL Pool Wrapper
 * Wraps Neon serverless client to provide a pg.Pool-compatible interface
 */
class NeonPoolWrapper {
  private client: NeonQueryFunction;

  constructor(client: NeonQueryFunction) {
    this.client = client;
  }

  async query(sql: string, params: any[] = []) {
    try {
      const result = await this.client(sql, params);
      return {
        rows: Array.isArray(result) ? result : [],
        rowCount: Array.isArray(result) ? result.length : 0,
      };
    } catch (error: any) {
      console.error("[PostgreSQL] Query execution error:", error.message);
      throw error;
    }
  }
}

/**
 * Get the PostgreSQL connection pool (Neon serverless wrapper)
 * Uses Neon serverless client which is optimized for Netlify Functions
 */
export function getPostgresPool() {
  if (neonClient) return new NeonPoolWrapper(neonClient);
  return initializeClient();
}

function initializeClient(): NeonPoolWrapper {
  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable not set");
    }

    console.log("[PostgreSQL] 🔧 Initializing Neon serverless client...");
    neonClient = neon(databaseUrl);

    console.log("[PostgreSQL] ✓ Neon serverless client initialized");

    return new NeonPoolWrapper(neonClient);
  } catch (error: any) {
    console.error(
      "[PostgreSQL] ✗ Failed to initialize database:",
      error.message,
    );
    throw error;
  }
}

/**
 * Execute a query using Neon serverless client
 */
export async function queryPostgres(sql: string, params: any[] = []) {
  try {
    const pool = getPostgresPool();
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error: any) {
    console.error("[PostgreSQL] Query error:", error.message);
    throw error;
  }
}

/**
 * Execute a query and return a single row
 */
export async function queryPostgresSingle(sql: string, params: any[] = []) {
  const rows = await queryPostgres(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get environment info for logging/debugging
 */
export function getEnvironmentInfo() {
  const environment = process.env.ENVIRONMENT || "development";
  return {
    environment: environment.toUpperCase(),
    database: "Neon PostgreSQL (Serverless)",
    mode: environment === "production" ? "🚀 Production" : "🔧 Development",
  };
}
