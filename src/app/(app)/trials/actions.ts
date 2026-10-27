"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { date, str } from "@/lib/utils";

export async function requestTrial(horseId: string, fd: FormData) {
  const user = await requireUser();
  const when = date(fd, "date");
  if (!when) return;
  const horse = await db.query.horses.findFirst({ where: eq(schema.horses.id, horseId) });
  if (!horse || horse.ownerId === user.id) return;
  await db.insert(schema.trialRequests).values({ horseId, requesterId: user.id, date: when, message: str(fd, "message") });
  await db.insert(schema.messages).values({
    senderId: user.id,
    receiverId: horse.ownerId,
    horseId,
    content: `Trial request for ${horse.name} on ${when.toLocaleString("en-GB")}. ${str(fd, "message") ?? ""}`.trim(),
  });
  revalidatePath(`/marketplace/${horseId}`);
  revalidatePath("/trials");
}

export async function decideTrial(requestId: string, status: "APPROVED" | "DECLINED") {
  const user = await requireUser();
  const req = await db.query.trialRequests.findFirst({ where: eq(schema.trialRequests.id, requestId), with: { horse: true } });
  if (!req || req.horse.ownerId !== user.id) return;
  await db.update(schema.trialRequests).set({ status }).where(eq(schema.trialRequests.id, requestId));
  if (status === "APPROVED") {
    await db.insert(schema.tasks).values({
      ownerId: user.id,
      horseId: req.horseId,
      title: `Trial: ${req.horse.name}`,
      category: "TRIAL",
      priority: 1,
      dueAt: req.date,
    });
  }
  await db.insert(schema.messages).values({
    senderId: user.id,
    receiverId: req.requesterId,
    horseId: req.horseId,
    content: `Your trial for ${req.horse.name} on ${req.date.toLocaleString("en-GB")} was ${status.toLowerCase()}.`,
  });
  revalidatePath("/trials");
  revalidatePath(`/horses/${req.horseId}`);
}

export async function cancelTrial(requestId: string) {
  const user = await requireUser();
  await db.delete(schema.trialRequests).where(and(eq(schema.trialRequests.id, requestId), eq(schema.trialRequests.requesterId, user.id)));
  revalidatePath("/trials");
}
