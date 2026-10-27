"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { matingAdvisor } from "@/lib/ai/features";
import type { AiState } from "@/components/ai-panel";
import { addDays, date, str } from "@/lib/utils";

const GESTATION_DAYS = 340;

async function ownMare(mareId: string) {
  const user = await requireUser();
  const mare = await db.query.horses.findFirst({ where: and(eq(schema.horses.id, mareId), eq(schema.horses.ownerId, user.id)) });
  if (!mare) throw new Error("Mare not found");
  return { user, mare };
}

export async function addBreeding(fd: FormData) {
  const { mare } = await ownMare(String(fd.get("mareId")));
  const stallionName = str(fd, "stallionName");
  if (!stallionName) return;
  const coverDate = date(fd, "coverDate");
  await db.insert(schema.breedingRecords).values({
    mareId: mare.id,
    stallionName,
    status: coverDate ? "COVERED" : "PLANNED",
    coverDate,
    expectedFoaling: coverDate ? addDays(coverDate, GESTATION_DAYS) : null,
    notes: str(fd, "notes"),
  });
  revalidatePath("/breeding");
}

export async function updateBreeding(id: string, fd: FormData) {
  const user = await requireUser();
  const rec = await db.query.breedingRecords.findFirst({ where: eq(schema.breedingRecords.id, id), with: { mare: true } });
  if (!rec || rec.mare.ownerId !== user.id) return;
  const status = str(fd, "status") ?? rec.status;
  const when = date(fd, "date") ?? new Date();
  const patch: Partial<typeof schema.breedingRecords.$inferInsert> = { status };
  if (status === "COVERED") Object.assign(patch, { coverDate: when, expectedFoaling: addDays(when, GESTATION_DAYS) });
  if (status === "IN_FOAL" || status === "EMPTY") patch.scanDate = when;
  if (status === "FOALED") {
    patch.foaledAt = when;
    // Auto-create the foal's profile with its pedigree
    const stallion = await db.query.horses.findFirst({ where: eq(schema.horses.name, rec.stallionName) });
    await db.insert(schema.horses).values({
      ownerId: user.id,
      name: str(fd, "foalName") ?? `${rec.mare.name} foal ${when.getFullYear()}`,
      sex: str(fd, "foalSex"),
      breed: rec.mare.breed,
      birthYear: when.getFullYear(),
      sire: rec.stallionName,
      dam: rec.mare.name,
      damSire: rec.mare.sire,
      description: `Born ${when.toDateString()}. By ${rec.stallionName}${stallion?.sire ? ` (${stallion.sire})` : ""} out of ${rec.mare.name}.`,
      isPublic: false,
    });
  }
  await db.update(schema.breedingRecords).set(patch).where(eq(schema.breedingRecords.id, id));
  revalidatePath("/breeding");
  revalidatePath("/horses");
}

export async function deleteBreeding(id: string) {
  const user = await requireUser();
  const rec = await db.query.breedingRecords.findFirst({ where: eq(schema.breedingRecords.id, id), with: { mare: true } });
  if (!rec || rec.mare.ownerId !== user.id) return;
  await db.delete(schema.breedingRecords).where(eq(schema.breedingRecords.id, id));
  revalidatePath("/breeding");
}

/** AI Added Service: rank stallions for a mare. */
export async function matingAdvisorAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const { user, mare } = await ownMare(String(fd.get("mareId")));
    const stallions = await db.query.horses.findMany({
      where: and(eq(schema.horses.sex, "STALLION"), or(eq(schema.horses.isPublic, true), eq(schema.horses.ownerId, user.id))),
    });
    if (!stallions.length) return { error: "No stallions found on the platform yet." };
    const advice = await matingAdvisor(mare, stallions, str(fd, "goal") ?? "");
    const name = (sid: string) => stallions.find((s) => s.id === sid)?.name ?? sid;
    return {
      text: `${advice.summary}\n\n${advice.ranking
        .map((r, i) => `${i + 1}. **${name(r.stallionId)}** - ${r.score}/100\n    - ✓ ${r.strengths.join("; ") || "—"}${r.risks.length ? `\n    - ⚠ ${r.risks.join("; ")}` : ""}`)
        .join("\n")}`,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
