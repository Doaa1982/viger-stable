"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { saveImage } from "@/lib/uploads";
import { smartScan, type ScanResult } from "@/lib/ai/features";
import { date, label, num, str } from "@/lib/utils";

export async function addHealthRecord(fd: FormData) {
  const { user, ownerId } = await requirePerm("yard");
  const horseId = str(fd, "horseId");
  const horse = horseId ? await db.query.horses.findFirst({ where: and(eq(schema.horses.id, horseId), eq(schema.horses.ownerId, ownerId)) }) : null;
  if (!horse) return;
  const type = str(fd, "type") ?? "OTHER";
  const cost = num(fd, "cost");
  await db.insert(schema.healthRecords).values({
    horseId: horse.id,
    type,
    date: date(fd, "date") ?? new Date(),
    nextDue: date(fd, "nextDue"),
    provider: str(fd, "provider"),
    cost,
    notes: str(fd, "notes"),
    attachmentUrl: str(fd, "attachmentUrl"),
    source: str(fd, "source") ?? "MANUAL",
  });
  // Health costs flow automatically into the Finance Desk
  if (cost) {
    await db.insert(schema.transactions).values({
      ownerId: ownerId,
      horseId: horse.id,
      kind: "EXPENSE",
      category: label(type),
      amount: cost,
      date: date(fd, "date") ?? new Date(),
      description: `${label(type)} - ${horse.name}${str(fd, "provider") ? ` (${str(fd, "provider")})` : ""}`,
    });
  }
  revalidatePath("/health");
  revalidatePath(`/horses/${horse.id}`);
}

export async function deleteHealthRecord(id: string) {
  const { user, ownerId } = await requirePerm("yard");
  const r = await db.query.healthRecords.findFirst({ where: eq(schema.healthRecords.id, id), with: { horse: true } });
  if (!r || r.horse.ownerId !== ownerId) return;
  await db.delete(schema.healthRecords).where(eq(schema.healthRecords.id, id));
  revalidatePath("/health");
}

export type SmartScanState = { data?: ScanResult & { attachmentUrl: string }; error?: string } | undefined;

/** Smart Scan (AI Enhancement): read a vet card / invoice photo into a record. */
export async function smartScanAction(_: SmartScanState, fd: FormData): Promise<SmartScanState> {
  try {
    await requirePerm("yard");
    const img = await saveImage(fd.get("document") as File | null);
    if (!img) return { error: "Choose a photo of the document." };
    const data = await smartScan(img);
    return { data: { ...data, attachmentUrl: img.url } };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
