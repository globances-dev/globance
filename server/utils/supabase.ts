import { createClient } from "@supabase/supabase-js";

let supabaseClient: any = null;
let supabaseAdminClient: any = null;

interface QueryResult {
  rows: any[];
  rowCount: number;
}

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

/**
 * Pool-compatible wrapper for Supabase
 * Maintains backward compatibility with existing code that uses pool.query()
 */
class SupabasePoolWrapper {
  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    const supabase = getSupabaseAdmin();

    try {
      const sqlTrimmed = sql.trim().toUpperCase();

      if (sqlTrimmed.startsWith("SELECT")) {
        return await this.executeSelect(sql, params);
      } else if (sqlTrimmed.startsWith("INSERT")) {
        return await this.executeInsert(sql, params);
      } else if (sqlTrimmed.startsWith("UPDATE")) {
        return await this.executeUpdate(sql, params);
      } else if (sqlTrimmed.startsWith("DELETE")) {
        return await this.executeDelete(sql, params);
      }

      console.warn("[Supabase] Complex SQL operation may not be supported:", sql);
      return { rows: [], rowCount: 0 };
    } catch (error: any) {
      console.error("[Supabase Query] Error:", error.message, "\nSQL:", sql);
      throw error;
    }
  }

  private async executeSelect(
    sql: string,
    params: any[],
  ): Promise<QueryResult> {
    const supabase = getSupabaseAdmin();

    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : null;

    if (!tableName) {
      throw new Error("Could not parse table name from SELECT query");
    }

    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER BY|LIMIT|$)/i);
    let query = supabase.from(tableName).select("*");

    if (whereMatch) {
      const whereClause = whereMatch[1].trim();

      const conditions = whereClause
        .split(/\s+AND\s+/i)
        .map((cond: string) => {
          const match = cond.match(/(\w+)\s*=\s*\$(\d+)/);
          if (match) {
            const column = match[1];
            const paramNum = parseInt(match[2]) - 1;
            const value = params[paramNum];
            return { column, value };
          }
          return null;
        })
        .filter(Boolean);

      for (const cond of conditions) {
        if (cond) {
          query = query.eq(cond.column, cond.value);
        }
      }
    }

    const orderMatch = sql.match(/ORDER BY\s+(\w+)\s*(ASC|DESC)?/i);
    if (orderMatch) {
      const column = orderMatch[1];
      const ascending = !orderMatch[2] || orderMatch[2].toUpperCase() === "ASC";
      query = query.order(column, { ascending });
    }

    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1]);
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return {
      rows: data || [],
      rowCount: data?.length || 0,
    };
  }

  private async executeInsert(
    sql: string,
    params: any[],
  ): Promise<QueryResult> {
    const supabase = getSupabaseAdmin();

    const tableMatch = sql.match(/INTO\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : null;

    if (!tableName) {
      throw new Error("Could not parse table name from INSERT query");
    }

    const columnsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    const columnsStr = columnsMatch ? columnsMatch[1] : null;

    if (!columnsStr) {
      throw new Error("Could not parse columns from INSERT query");
    }

    const columns = columnsStr
      .split(",")
      .map((c: string) => c.trim())
      .map((c: string) => c.replace(/`/g, ""));

    const insertObj: any = {};
    columns.forEach((col: string, idx: number) => {
      insertObj[col] = params[idx];
    });

    const returningMatch = sql.match(/RETURNING\s+(.+?)(?:$|;)/i);
    const returningColumns = returningMatch
      ? returningMatch[1].split(",").map((c: string) => c.trim())
      : null;

    const { data, error } = await supabase
      .from(tableName)
      .insert(insertObj)
      .select(returningColumns ? returningColumns.join(", ") : "*");

    if (error) {
      throw error;
    }

    return {
      rows: data || [],
      rowCount: data?.length || 0,
    };
  }

  private async executeUpdate(
    sql: string,
    params: any[],
  ): Promise<QueryResult> {
    const supabase = getSupabaseAdmin();

    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : null;

    if (!tableName) {
      throw new Error("Could not parse table name from UPDATE query");
    }

    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    const setClause = setMatch ? setMatch[1] : null;

    if (!setClause) {
      throw new Error("Could not parse SET clause from UPDATE query");
    }

    const whereMatch = sql.match(/WHERE\s+(.+?)(?:$|;)/i);
    const whereClause = whereMatch ? whereMatch[1].trim() : null;

    if (!whereClause) {
      throw new Error("Could not parse WHERE clause from UPDATE query");
    }

    const updateObj: any = {};

    const setParts = setClause.split(",").map((p: string) => p.trim());
    for (const part of setParts) {
      const match = part.match(/(\w+)\s*=\s*\$(\d+)/);
      if (match) {
        const column = match[1];
        const paramNum = parseInt(match[2]) - 1;
        updateObj[column] = params[paramNum];
      }
    }

    let query = supabase.from(tableName).update(updateObj);

    const whereConditions = whereClause
      .split(/\s+AND\s+/i)
      .map((cond: string) => {
        const match = cond.match(/(\w+)\s*=\s*\$(\d+)/);
        if (match) {
          const column = match[1];
          const paramNum = parseInt(match[2]) - 1;
          const value = params[paramNum];
          return { column, value };
        }
        return null;
      })
      .filter(Boolean);

    for (const cond of whereConditions) {
      if (cond) {
        query = query.eq(cond.column, cond.value);
      }
    }

    const { data, error } = await query.select("*");

    if (error) {
      throw error;
    }

    return {
      rows: data || [],
      rowCount: data?.length || 0,
    };
  }

  private async executeDelete(
    sql: string,
    params: any[],
  ): Promise<QueryResult> {
    const supabase = getSupabaseAdmin();

    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : null;

    if (!tableName) {
      throw new Error("Could not parse table name from DELETE query");
    }

    const whereMatch = sql.match(/WHERE\s+(.+?)(?:$|;)/i);
    const whereClause = whereMatch ? whereMatch[1].trim() : null;

    if (!whereClause) {
      throw new Error("Could not parse WHERE clause from DELETE query");
    }

    let query = supabase.from(tableName).delete();

    const whereConditions = whereClause
      .split(/\s+AND\s+/i)
      .map((cond: string) => {
        const match = cond.match(/(\w+)\s*=\s*\$(\d+)/);
        if (match) {
          const column = match[1];
          const paramNum = parseInt(match[2]) - 1;
          const value = params[paramNum];
          return { column, value };
        }
        return null;
      })
      .filter(Boolean);

    for (const cond of whereConditions) {
      if (cond) {
        query = query.eq(cond.column, cond.value);
      }
    }

    const { error, count } = await query.select();

    if (error) {
      throw error;
    }

    return {
      rows: [],
      rowCount: count || 0,
    };
  }
}

let poolInstance: SupabasePoolWrapper | null = null;

export function getSupabasePool(): SupabasePoolWrapper {
  if (!poolInstance) {
    poolInstance = new SupabasePoolWrapper();
  }
  return poolInstance;
}

export async function querySupabasePool(
  sql: string,
  params: any[] = [],
): Promise<any[]> {
  const pool = getSupabasePool();
  const result = await pool.query(sql, params);
  return result.rows;
}
