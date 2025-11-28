import { neon, NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction | null = null;

/**
 * Get the Neon PostgreSQL client for serverless functions
 * Uses Neon serverless client which is optimized for Netlify Functions
 */
export function getPostgresPool() {
  if (client) return { query: client };
  return initializeClient();
}

function initializeClient() {
  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable not set");
    }

    console.log("[PostgreSQL] 🔧 Initializing Neon serverless client...");
    client = neon(databaseUrl);

    console.log("[PostgreSQL] ✓ Neon serverless client initialized");
    
    return {
      query: client,
    };
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
    const client = getPostgresPool().query;
    const result = await client(sql, params);
    return Array.isArray(result) ? result : result?.rows || [];
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
