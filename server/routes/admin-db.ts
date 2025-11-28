import { Router, Response } from "express";
import { verifyToken } from "../utils/jwt";
import { getPostgresPool } from "../utils/postgres";

const router = Router();

let validTablesCache: Set<string> | null = null;
let tableColumnsCache: Map<string, Set<string>> = new Map();

async function getValidTables(): Promise<Set<string>> {
  if (validTablesCache) return validTablesCache;

  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);

  validTablesCache = new Set(result.rows.map(r => r.table_name));
  return validTablesCache;
}

async function getValidColumns(tableName: string): Promise<Set<string>> {
  if (tableColumnsCache.has(tableName)) {
    return tableColumnsCache.get(tableName)!;
  }

  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
  `, [tableName]);

  const columns = new Set(result.rows.map(r => r.column_name));
  tableColumnsCache.set(tableName, columns);
  return columns;
}

function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

async function validateTableName(tableName: string): Promise<boolean> {
  if (!isValidIdentifier(tableName)) return false;
  const validTables = await getValidTables();
  return validTables.has(tableName);
}

async function validateColumnName(tableName: string, columnName: string): Promise<boolean> {
  if (!isValidIdentifier(columnName)) return false;
  const validColumns = await getValidColumns(tableName);
  return validColumns.has(columnName);
}

const adminMiddleware = async (req: any, res: Response, next: Function) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const pool = getPostgresPool();
    const result = await pool.query("SELECT role FROM users WHERE id = $1", [
      decoded.id,
    ]);

    if (!result.rows.length || result.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    console.error("[AdminDB] Middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

router.get("/tables", adminMiddleware, async (req: any, res: Response) => {
  try {
    const pool = getPostgresPool();

    const result = await pool.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tablesWithCounts = await Promise.all(
      result.rows.map(async (table) => {
        try {
          const countResult = await pool.query(
            `SELECT COUNT(*) as count FROM "${table.table_name}"`
          );
          return {
            name: table.table_name,
            columns: parseInt(table.column_count),
            rows: parseInt(countResult.rows[0].count),
          };
        } catch {
          return {
            name: table.table_name,
            columns: parseInt(table.column_count),
            rows: 0,
          };
        }
      })
    );

    res.json({ tables: tablesWithCounts, database: "production" });
  } catch (error: any) {
    console.error("[AdminDB] Get tables error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get(
  "/tables/:tableName/schema",
  adminMiddleware,
  async (req: any, res: Response) => {
    try {
      const { tableName } = req.params;
      
      if (!await validateTableName(tableName)) {
        return res.status(400).json({ error: "Invalid table name" });
      }
      
      const pool = getPostgresPool();

      const result = await pool.query(
        `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
        [tableName]
      );

      const pkResult = await pool.query(
        `
      SELECT a.attname as column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `,
        [tableName]
      );

      const primaryKeys = pkResult.rows.map((r) => r.column_name);

      res.json({
        table: tableName,
        columns: result.rows.map((col) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === "YES",
          default: col.column_default,
          maxLength: col.character_maximum_length,
          isPrimaryKey: primaryKeys.includes(col.column_name),
        })),
      });
    } catch (error: any) {
      console.error("[AdminDB] Get schema error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/tables/:tableName/data",
  adminMiddleware,
  async (req: any, res: Response) => {
    try {
      const { tableName } = req.params;
      const { page = 1, limit = 50, orderBy, orderDir = "asc" } = req.query;

      if (!await validateTableName(tableName)) {
        return res.status(400).json({ error: "Invalid table name" });
      }

      const pool = getPostgresPool();
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      let query = `SELECT * FROM "${tableName}"`;

      if (orderBy) {
        if (!await validateColumnName(tableName, orderBy as string)) {
          return res.status(400).json({ error: "Invalid column name for ordering" });
        }
        const direction = orderDir === "desc" ? "DESC" : "ASC";
        query += ` ORDER BY "${orderBy}" ${direction}`;
      } else {
        query += ` ORDER BY 1`;
      }

      query += ` LIMIT $1 OFFSET $2`;

      const result = await pool.query(query, [
        parseInt(limit as string),
        offset,
      ]);
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM "${tableName}"`
      );

      res.json({
        table: tableName,
        data: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].count) / parseInt(limit as string)
        ),
      });
    } catch (error: any) {
      console.error("[AdminDB] Get data error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.put(
  "/tables/:tableName/row",
  adminMiddleware,
  async (req: any, res: Response) => {
    try {
      const { tableName } = req.params;
      const { primaryKey, primaryKeyValue, updates } = req.body;

      if (!primaryKey || primaryKeyValue === undefined || !updates) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!await validateTableName(tableName)) {
        return res.status(400).json({ error: "Invalid table name" });
      }

      if (!await validateColumnName(tableName, primaryKey)) {
        return res.status(400).json({ error: "Invalid primary key column" });
      }

      for (const key of Object.keys(updates)) {
        if (!await validateColumnName(tableName, key)) {
          return res.status(400).json({ error: `Invalid column name: ${key}` });
        }
      }

      const pool = getPostgresPool();

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        setClauses.push(`"${key}" = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      values.push(primaryKeyValue);

      const query = `
      UPDATE "${tableName}"
      SET ${setClauses.join(", ")}
      WHERE "${primaryKey}" = $${paramIndex}
      RETURNING *
    `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Row not found" });
      }

      console.log(
        `[AdminDB] Row updated in ${tableName} by admin ${req.user.id}`
      );
      res.json({ success: true, row: result.rows[0] });
    } catch (error: any) {
      console.error("[AdminDB] Update row error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.delete(
  "/tables/:tableName/row",
  adminMiddleware,
  async (req: any, res: Response) => {
    try {
      const { tableName } = req.params;
      const { primaryKey, primaryKeyValue } = req.body;

      if (!primaryKey || primaryKeyValue === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!await validateTableName(tableName)) {
        return res.status(400).json({ error: "Invalid table name" });
      }

      if (!await validateColumnName(tableName, primaryKey)) {
        return res.status(400).json({ error: "Invalid primary key column" });
      }

      const pool = getPostgresPool();

      const result = await pool.query(
        `DELETE FROM "${tableName}" WHERE "${primaryKey}" = $1 RETURNING *`,
        [primaryKeyValue]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Row not found" });
      }

      console.log(
        `[AdminDB] Row deleted from ${tableName} by admin ${req.user.id}`
      );
      res.json({ success: true, deleted: result.rows[0] });
    } catch (error: any) {
      console.error("[AdminDB] Delete row error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  "/query",
  adminMiddleware,
  async (req: any, res: Response) => {
    try {
      const { sql } = req.body;

      if (!sql) {
        return res.status(400).json({ error: "SQL query required" });
      }

      let normalizedSql = sql
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--.*$/gm, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      const semicolonCount = (normalizedSql.match(/;/g) || []).length;
      if (semicolonCount > 1 || (semicolonCount === 1 && !normalizedSql.endsWith(';'))) {
        return res.status(403).json({
          error: "Multiple statements are not allowed. Execute one query at a time.",
        });
      }

      normalizedSql = normalizedSql.replace(/;$/, '').trim();

      const firstWord = normalizedSql.split(/\s+/)[0];
      if (firstWord !== 'select' && firstWord !== 'with') {
        return res.status(403).json({
          error: "Only SELECT and WITH (CTE) queries are allowed. Use the table browser for data modifications.",
        });
      }

      const dangerousPatterns = [
        /\binsert\s+into\b/i,
        /\bupdate\s+\w+\s+set\b/i,
        /\bdelete\s+from\b/i,
        /\bdrop\s+(table|database|index|view|schema)\b/i,
        /\btruncate\s+(table)?\b/i,
        /\balter\s+(table|database|index|view|schema)\b/i,
        /\bcreate\s+(table|database|index|view|schema|function|trigger)\b/i,
        /\bgrant\b/i,
        /\brevoke\b/i,
        /\bexec(ute)?\b/i,
        /\bcopy\s/i,
        /\bpg_sleep\b/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(normalizedSql)) {
          return res.status(403).json({
            error: "This query contains data modification statements which are not allowed. Only read-only SELECT queries are permitted.",
          });
        }
      }

      const pool = getPostgresPool();
      const result = await pool.query(sql);

      console.log(`[AdminDB] Custom query executed by admin ${req.user.id}: ${sql.substring(0, 100)}`);

      res.json({
        success: true,
        rows: result.rows,
        rowCount: result.rowCount,
        command: result.command,
      });
    } catch (error: any) {
      console.error("[AdminDB] Query error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/refresh-cache", adminMiddleware, async (req: any, res: Response) => {
  validTablesCache = null;
  tableColumnsCache.clear();
  res.json({ success: true, message: "Cache cleared" });
});

export default router;
