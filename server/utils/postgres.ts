/**
 * IMPORTANT: This file provides a compatibility layer between Supabase and the old Neon interface.
 * While we maintain pool.query() syntax, all queries are executed through Supabase.
 * 
 * For new code, consider using getSupabaseAdmin() directly instead.
 * For complex raw SQL queries, they should be converted to Supabase query builder syntax.
 */

import { getSupabaseAdmin as getSupabaseAdminImport } from "./supabase";

interface QueryResult {
  rows: any[];
  rowCount: number;
}

/**
 * Pool-compatible wrapper for Supabase
 * Maintains backward compatibility with existing code that uses pool.query()
 */
class SupabasePoolWrapper {
  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    const supabase = getSupabaseAdminImport();

    try {
      // Parse SQL to determine operation type
      const sqlTrimmed = sql.trim().toUpperCase();

      if (sqlTrimmed.startsWith("SELECT")) {
        return await this.executeSelect(sql, params);
      } else if (sqlTrimmed.startsWith("INSERT")) {
        return await this.executeInsert(sql, params);
      } else if (sqlTrimmed.startsWith("UPDATE")) {
        return await this.executeUpdate(sql, params);
      } else if (sqlTrimmed.startsWith("DELETE")) {
        return await this.executeDelete(sql, params);
      } else {
        // For other SQL (like CREATE TABLE, etc.), log a warning
        console.warn("[Supabase] Complex SQL operation may not be supported:", sql);
        return { rows: [], rowCount: 0 };
      }
    } catch (error: any) {
      console.error("[Supabase Query] Error:", error.message, "\nSQL:", sql);
      throw error;
    }
  }

  private async executeSelect(
    sql: string,
    params: any[]
  ): Promise<QueryResult> {
    const supabase = getSupabaseAdminImport();

    // Parse table name and columns from SQL
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : null;

    if (!tableName) {
      throw new Error("Could not parse table name from SELECT query");
    }

    // Handle simple SELECT queries with WHERE clause
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER BY|LIMIT|$)/i);
    let query = supabase.from(tableName).select("*");

    if (whereMatch) {
      const whereClause = whereMatch[1].trim();

      // Simple parameter replacement for WHERE clauses like "email = $1 AND status = $2"
      let paramIndex = 0;
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

    // Handle ORDER BY
    const orderMatch = sql.match(/ORDER BY\s+(\w+)\s*(ASC|DESC)?/i);
    if (orderMatch) {
      const column = orderMatch[1];
      const ascending = !orderMatch[2] || orderMatch[2].toUpperCase() === "ASC";
      query = query.order(column, { ascending });
    }

    // Handle LIMIT
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
    params: any[]
  ): Promise<QueryResult> {
    const supabase = getSupabaseAdminImport();

    // Parse table name
    const tableMatch = sql.match(/INTO\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : null;

    if (!tableName) {
      throw new Error("Could not parse table name from INSERT query");
    }

    // Parse columns and values
    const columnsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    const columnsStr = columnsMatch ? columnsMatch[1] : null;

    if (!columnsStr) {
      throw new Error("Could not parse columns from INSERT query");
    }

    const columns = columnsStr
      .split(",")
      .map((c: string) => c.trim())
      .map((c: string) => c.replace(/`/g, ""));

    // Build object from columns and params
    const insertObj: any = {};
    columns.forEach((col: string, idx: number) => {
      insertObj[col] = params[idx];
    });

    // Check for RETURNING clause
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
    params: any[]
  ): Promise<QueryResult> {
    const supabase = getSupabaseAdminImport();

    // Parse table name
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : null;

    if (!tableName) {
      throw new Error("Could not parse table name from UPDATE query");
    }

    // Parse SET clause
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    const setClause = setMatch ? setMatch[1] : null;

    if (!setClause) {
      throw new Error("Could not parse SET clause from UPDATE query");
    }

    // Parse WHERE clause
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:$|;)/i);
    const whereClause = whereMatch ? whereMatch[1].trim() : null;

    if (!whereClause) {
      throw new Error("Could not parse WHERE clause from UPDATE query");
    }

    // Parse SET: "column1 = $1, column2 = $2"
    const updateObj: any = {};
    let paramIndex = 0;

    const setParts = setClause.split(",").map((p: string) => p.trim());
    for (const part of setParts) {
      const match = part.match(/(\w+)\s*=\s*\$(\d+)/);
      if (match) {
        const column = match[1];
        const paramNum = parseInt(match[2]) - 1;
        updateObj[column] = params[paramNum];
        paramIndex++;
      }
    }

    // Parse WHERE: "id = $X"
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
    params: any[]
  ): Promise<QueryResult> {
    const supabase = getSupabaseAdminImport();

    // Parse table name
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : null;

    if (!tableName) {
      throw new Error("Could not parse table name from DELETE query");
    }

    // Parse WHERE clause
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

/**
 * Get the PostgreSQL pool (Supabase-compatible wrapper)
 * Maintains backward compatibility with code that uses pool.query()
 */
export function getPostgresPool(): SupabasePoolWrapper {
  if (!poolInstance) {
    poolInstance = new SupabasePoolWrapper();
  }
  return poolInstance;
}

/**
 * Execute a query using Supabase
 * @deprecated Use getSupabaseAdmin() for new code
 */
export async function queryPostgres(sql: string, params: any[] = []) {
  try {
    const pool = getPostgresPool();
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error: any) {
    console.error("[PostgreSQL] Query error:", error.message);
    throw error;
  }
}

/**
 * Execute a query and return a single row
 * @deprecated Use getSupabaseAdmin() for new code
 */
export async function queryPostgresSingle(sql: string, params: any[] = []) {
  const rows = await queryPostgres(sql, params);
  return rows.length > 0 ? rows[0] : null;
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
