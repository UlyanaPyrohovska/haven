import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type DbEnv = { DATABASE_URL: string; HYPERDRIVE?: Hyperdrive };

export function getDb(env: DbEnv) {
	const pool = new Pool({ connectionString: env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL, max: 5 });
	return drizzle(pool);
}

export type Db = ReturnType<typeof getDb>;
