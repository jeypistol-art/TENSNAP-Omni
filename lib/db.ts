import { neon } from "@neondatabase/serverless";

export type QueryResultRow = Record<string, unknown>;

export type QueryResult<T = QueryResultRow> = {
  rows: T[];
  rowCount: number;
};

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

let sql = neon(databaseUrl);

function resetClient() {
  sql = neon(databaseUrl);
}

export async function query<T = QueryResultRow>(
  text: string,
  params: unknown[] = []
) : Promise<QueryResult<T>> {
  try {
    const rows = await sql(text, params as any[]);
    return {
      rows: (rows as T[]) ?? [],
      rowCount: (rows as T[])?.length ?? 0,
    };
  } catch (err: any) {
    const code = err?.code || "";
    if (code === "ECONNRESET") {
      resetClient();
      const retry = await sql(text, params as any[]);
      return {
        rows: (retry as T[]) ?? [],
        rowCount: (retry as T[])?.length ?? 0,
      };
    }
    throw err;
  }
}
