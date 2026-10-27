"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { date, num, str } from "@/lib/utils";

export async function createTask(fd: FormData) {
  const { user, ownerId } = await requirePerm("yard");
  const title = str(fd, "title");
  const dueAt = date(fd, "dueAt") ?? new Date();
  if (!title) return;
  const repeat = num(fd, "repeatDays") ?? 0;
  const count = repeat > 0 ? Math.min(num(fd, "repeatCount") ?? 7, 60) : 1;
  const rows = Array.from({ length: count }, (_, i) => ({
    ownerId: ownerId,
    title,
    dueAt: new Date(dueAt.getTime() + i * repeat * 86_400_000),
    category: str(fd, "category") ?? "CARE",
    priority: num(fd, "priority") ?? 2,
    horseId: str(fd, "horseId"),
    staffId: str(fd, "staffId"),
  }));
  await db.insert(schema.tasks).values(rows);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function toggleTask(id: string) {
  const { user, ownerId } = await requirePerm("yard");
  const t = await db.query.tasks.findFirst({ where: and(eq(schema.tasks.id, id), eq(schema.tasks.ownerId, ownerId)) });
  if (!t) return;
  await db.update(schema.tasks).set({ done: !t.done, doneAt: t.done ? null : new Date() }).where(eq(schema.tasks.id, id));
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function rescheduleTask(id: string, fd: FormData) {
  const { user, ownerId } = await requirePerm("yard");
  const d = date(fd, "dueAt");
  if (!d) return;
  await db.update(schema.tasks).set({ dueAt: d }).where(and(eq(schema.tasks.id, id), eq(schema.tasks.ownerId, ownerId)));
  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  const { user, ownerId } = await requirePerm("yard");
  await db.delete(schema.tasks).where(and(eq(schema.tasks.id, id), eq(schema.tasks.ownerId, ownerId)));
  revalidatePath("/tasks");
}
