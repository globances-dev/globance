import {
  executeSupabaseQuery,
  getSupabaseEnvironmentInfo,
  getSupabaseQueryClient,
} from "./supabase";

/**
 * Legacy shim: routes expecting a Postgres pool now use the Supabase SQL RPC.
 * No Postgres environment variables are read or required.
 */
export function getPostgresPool() {
  return getSupabaseQueryClient();
}

export function getEnvironmentInfo() {
  const env = getSupabaseEnvironmentInfo();
  return {
    environment: env.environment,
    database: env.database,
    mode: env.mode,
  };
}

export async function queryPostgres(query: string, params: any[] = []) {
  return executeSupabaseQuery(query, params);
}
