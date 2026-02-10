import { Pool } from "pg";
import type { QueryResultRow } from "pg";

let pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function resetPool() {
  try {
    pool.end().catch(() => undefined);
  } catch {
    // ignore
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
