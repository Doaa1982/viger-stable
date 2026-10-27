import type { Config } from "drizzle-kit";

// Used by `npm run db:generate` (creates SQL migration files in ./drizzle)
// and `npm run db:studio`. The database itself is updated by `npm run db:migrate`.
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: process.env.DATABASE_AUTH_TOKEN ? "turso" : "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
} as Config;
