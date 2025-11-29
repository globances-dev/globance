export async function initializeDatabase() {
  console.log("[DB-Init] Supabase mode active – skipping PostgreSQL initialization.");
  return true;
}
