export function getPostgresPool() {
  throw new Error("PostgreSQL connections are disabled. Use Supabase instead.");
}

export function getEnvironmentInfo() {
  return {
    environment: "supabase-only",
    database: "supabase",
    mode: "supabase-only",
  };
}

export async function queryPostgres() {
  throw new Error("PostgreSQL queries are disabled. Use Supabase client instead.");
}
