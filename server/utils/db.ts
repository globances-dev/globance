import { Client } from 'pg';

let dbClient: Client | null = null;

export async function getDbConnection() {
  if (!dbClient) {
    dbClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    try {
      await dbClient.connect();
      console.log('[DB] PostgreSQL connection established');
      
      // Set search_path to public schema to match Supabase visibility
      await dbClient.query('SET search_path TO public');
      console.log('[DB] search_path set to public schema');
    } catch (error: any) {
      console.error('[DB] Failed to connect:', error.message);
      throw error;
    }
  }
  return dbClient;
}

export async function executeQuery(
  query: string,
  params: any[] = []
): Promise<any> {
  try {
    const client = await getDbConnection();
    const result = await client.query(query, params);
    return result.rows;
  } catch (error: any) {
    console.error('[DB] Query error:', error.message);
    throw error;
  }
}

export async function executeQuerySingle(
  query: string,
  params: any[] = []
): Promise<any> {
  const rows = await executeQuery(query, params);
  return rows.length > 0 ? rows[0] : null;
}
