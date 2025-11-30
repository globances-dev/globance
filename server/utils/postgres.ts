export function getPostgresPool() {
  throw new Error("PostgreSQL connections are disabled. Use Supabase instead.");
}

export function getEnvironmentInfo() {
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || "development";
  return {
    environment,
    database: "supabase",
    mode: "supabase-only",
  };
}

export async function queryPostgres() {
  throw new Error("PostgreSQL queries are disabled. Use Supabase client instead.");
}
