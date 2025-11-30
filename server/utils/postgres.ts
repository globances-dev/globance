/**
 * Deprecated Postgres helper.
 * All database access now uses Supabase helpers from ./supabase.
 */

export function getPostgresPool() {
  console.warn(
    "[PostgreSQL] Deprecated helper used – switch to getSupabasePool() from supabase.ts",
  );
  return null as never;
}

export async function queryPostgres(_sql: string, _params: any[] = []) {
  throw new Error(
    "Deprecated Postgres helper called. Use Supabase utilities from supabase.ts",
  );
}

export async function queryPostgresSingle(
  _sql: string,
  _params: any[] = [],
) {
  throw new Error(
    "Deprecated Postgres helper called. Use Supabase utilities from supabase.ts",
  );
}

export function getEnvironmentInfo() {
  const environment = process.env.ENVIRONMENT || "development";
  return {
    environment: environment.toUpperCase(),
    database: "Supabase PostgreSQL",
    mode: environment === "production" ? "🚀 Production" : "🔧 Development",
  };
}
