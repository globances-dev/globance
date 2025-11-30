/**
 * No-op initializer for Supabase-only deployments.
 */
export async function initializeDatabaseTables() {
  console.log("[DB-Init] Supabase mode – skipping PostgreSQL initialization");
}
