import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

function resolveSupabaseConfig() {
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || "development";
  const isProduction = environment === "production";

  const url =
    process.env.SUPABASE_URL ||
    (isProduction ? process.env.VITE_SUPABASE_URL : process.env.STAGING_SUPABASE_URL) ||
    process.env.VITE_SUPABASE_URL ||
    process.env.STAGING_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (isProduction
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY) ||
    process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Supabase URL not configured");
  }

  if (!serviceRoleKey) {
    throw new Error("Supabase service role key not configured");
  }

  return { url, serviceRoleKey, environment: isProduction ? "production" : "staging" };
}

export function getSupabaseClient() {
  if (supabase) return supabase;

  const { url, serviceRoleKey, environment } = resolveSupabaseConfig();

  supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`[Supabase] Initialized ${environment} client`);
  return supabase;
}

export function getSupabaseEnvironmentInfo() {
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || "development";
  return {
    environment,
    database: "supabase",
    mode: environment === "production" ? "production" : "staging",
  };
}

export async function executeSupabaseQuery(sql: string, params: any[] = []) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("execute_sql", {
    query: sql,
    params,
  });

  if (error) {
    console.error("[Supabase] Query error:", error.message);
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? data : [];
  return { rows };
}

export async function executeSupabaseQuerySingle(sql: string, params: any[] = []) {
  const result = await executeSupabaseQuery(sql, params);
  return result.rows[0] || null;
}

export function getSupabaseQueryClient() {
  return {
    /**
     * Execute a parameterized SQL statement via the Supabase service-role client.
     * This replaces any Supabase db.exec usages with a Supabase RPC-backed call.
     */
    exec: executeSupabaseQuery,
    execSingle: executeSupabaseQuerySingle,
  };
}
