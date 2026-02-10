import { Pool } from "pg";
import type { QueryResultRow } from "pg";

let pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
  idleTimeoutMillis: 30000,
});

function resetPool() {
  try {
    pool.end().catch(() => undefined);
  } catch {
    // ignore
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    idleTimeoutMillis: 30000,
  });
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  try {
    const result = await pool.query<T>(text, params);
    return result;
  } catch (err: any) {
    const code = err?.code || "";
    if (code === "ECONNRESET") {
      resetPool();
      const retry = await pool.query<T>(text, params);
      return retry;
    }
    throw err;
  }
}
