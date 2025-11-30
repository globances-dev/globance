import { executeSupabaseQuery } from "./supabase";

export async function getDbConnection() {
  console.log("[DB] Supabase connection active via service role key");
  return { query: executeSupabaseQuery } as const;
}

export async function executeQuery(query: string, params: any[] = []) {
  try {
    const result = await executeSupabaseQuery(query, params);
    return result.rows;
  } catch (error: any) {
    console.error("[DB] Query error:", error.message);
    throw error;
  }
}

export async function executeQuerySingle(query: string, params: any[] = []) {
  const rows = await executeQuery(query, params);
  return rows.length > 0 ? rows[0] : null;
}
