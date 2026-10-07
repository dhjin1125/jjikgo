import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { getConfig } from "./config";

declare global {
  var __jjikgoPool: Pool | undefined;
}

export function getPool(): Pool | null {
  const c = getConfig();
  if (!c.databaseUrl) return null;
  if (!globalThis.__jjikgoPool) {
    globalThis.__jjikgoPool = new Pool({
      connectionString: c.databaseUrl,
      ssl: c.databaseSsl ? { rejectUnauthorized: true } : false,
      max: 5,
    });
  }
  return globalThis.__jjikgoPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not configured");
  return pool.query<T>(text, params);
}
