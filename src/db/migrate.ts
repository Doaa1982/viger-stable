/* Creates / updates all tables. Works for the local dev.db and for an online Turso database.
   Usage: npm run db:migrate   (reads DATABASE_URL and DATABASE_AUTH_TOKEN) */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;
  console.log(`Connecting to ${url.replace(/\?.*$/, "")} (token: ${authToken ? "yes" : "no"})`);
  if (url.startsWith("libsql://") && !authToken) throw new Error("DATABASE_AUTH_TOKEN is empty - the online database needs a token.");
  const client = createClient({ url, authToken });
  await client.execute("select 1"); // fails fast with a clear message if the URL or token is wrong
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  const tables = await client.execute("select count(*) as n from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '__drizzle%'");
  console.log(`Tables ready: ${tables.rows[0].n}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("\nDatabase setup failed:", e?.message ?? e);
  if (/401|unauthor|token/i.test(String(e?.message))) console.error("→ The token looks wrong or was invalidated. Create a new token in Turso and try again.");
  process.exit(1);
});
