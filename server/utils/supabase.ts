import { createClient } from "@supabase/supabase-js";

let supabaseClient: any = null;
let supabaseAdminClient: any = null;

/**
 * Get the Supabase client (anon key - for client-side operations)
 * Use this for operations that should respect RLS policies
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    initializeClients();
  }
  return supabaseClient;
}

/**
 * Get the Supabase admin client (service role key - for server-side operations)
 * Use this for admin/privileged operations that bypass RLS policies
 */
export function getSupabaseAdmin() {
  if (!supabaseAdminClient) {
    initializeClients();
  }
  return supabaseAdminClient;
}

function initializeClients() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL environment variable not set");
  }

  if (!anonKey) {
    throw new Error("SUPABASE_ANON_KEY environment variable not set");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable not set");
  }

  console.log("[Supabase] 🔧 Initializing Supabase clients...");

  // Client with anon key (respects RLS)
  supabaseClient = createClient(supabaseUrl, anonKey);

  // Admin client with service role key (bypasses RLS)
  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey);

  console.log("[Supabase] ✓ Supabase clients initialized");
}

/**
 * Execute a query using Supabase (admin client)
 * Use for server-side operations that need to bypass RLS
 */
export async function querySupabase(sql: string) {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("exec_sql", { sql });

    if (error) {
      console.error("[Supabase] Query error:", error.message);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error("[Supabase] Query execution error:", error.message);
    throw error;
  }
}

/**
 * Get environment info for logging/debugging
 */
export function getEnvironmentInfo() {
  const environment = process.env.ENVIRONMENT || "development";
  return {
    environment: environment.toUpperCase(),
    database: "Supabase PostgreSQL",
    mode: environment === "production" ? "🚀 Production" : "🔧 Development",
  };
}
