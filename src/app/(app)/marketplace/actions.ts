"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/utils";

export async function toggleSave(horseId: string, fd: FormData) {
  const user = await requireUser();
  const existing = await db.query.savedHorses.findFirst({ where: and(eq(schema.savedHorses.userId, user.id), eq(schema.savedHorses.horseId, horseId)) });
  if (existing) await db.delete(schema.savedHorses).where(and(eq(schema.savedHorses.userId, user.id), eq(schema.savedHorses.horseId, horseId)));
  else await db.insert(schema.savedHorses).values({ userId: user.id, horseId, folder: str(fd, "folder") ?? "Shortlist" });
  revalidatePath(`/marketplace/${horseId}`);
  revalidatePath("/saved");
}

export async function updateSavedNote(horseId: string, fd: FormData) {
  const user = await requireUser();
  await db
    .update(schema.savedHorses)
    .set({ note: str(fd, "note"), folder: str(fd, "folder") ?? "Shortlist" })
    .where(and(eq(schema.savedHorses.userId, user.id), eq(schema.savedHorses.horseId, horseId)));
  revalidatePath("/saved");
}
