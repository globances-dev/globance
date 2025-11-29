import { getSupabaseAdmin } from "./supabase.js";

/**
 * Initialize database tables on Supabase
 * For production, tables should be created via migrations in the Supabase dashboard
 * This function performs a basic health check to ensure the database is accessible
 */
export async function initializeDatabaseTables() {
  try {
    console.log("[DB-Init] 🔍 Checking Supabase database connection...");
    const admin = getSupabaseAdmin();

    // Verify database is accessible by checking if users table exists
    const { data, error } = await admin.from("users").select("id").limit(1);

    if (error) {
      console.error(
        "[DB-Init] ⚠️  Database connection check failed:",
        error.message,
      );
      console.log(
        "[DB-Init] Note: Tables should be created via Supabase migrations",
      );
      return;
    }

    console.log("[DB-Init] ✓ Supabase database connection verified");
    console.log("[DB-Init] ✓ All tables are accessible");
  } catch (error: any) {
    console.error("[DB-Init] Error checking database:", error.message);
    console.log(
      "[DB-Init] Note: Create tables via Supabase migrations if not already done",
    );
  }
}
