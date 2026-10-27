import "server-only";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** Load a horse belonging to the stable, or 404. */
export async function getOwnedHorse(ownerId: string, id: string) {
  const horse = await db.query.horses.findFirst({ where: and(eq(schema.horses.id, id), eq(schema.horses.ownerId, ownerId)) });
  if (!horse) notFound();
  return horse;
}
