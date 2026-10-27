import "server-only";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth";

/** Load a horse the current user owns, or 404. */
export async function getOwnedHorse(user: CurrentUser, id: string) {
  const horse = await db.query.horses.findFirst({ where: and(eq(schema.horses.id, id), eq(schema.horses.ownerId, user.id)) });
  if (!horse) notFound();
  return horse;
}
