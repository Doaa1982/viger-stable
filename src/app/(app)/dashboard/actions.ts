"use server";

import { and, eq, gte, lt, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { dailyBriefing } from "@/lib/ai/features";
import type { AiState } from "@/components/ai-panel";
import { addDays, label, startOfDay } from "@/lib/utils";

export async function briefingAction(): Promise<AiState> {
  const user = await requireUser();
  const today = startOfDay();
  try {
    const open = await db.query.tasks.findMany({
      where: and(eq(schema.tasks.ownerId, user.id), eq(schema.tasks.done, false), lt(schema.tasks.dueAt, addDays(today, 1))),
      with: { horse: true, staff: true },
    });
    const fmt = (t: (typeof open)[number]) => `${t.title}${t.horse ? ` (${t.horse.name})` : ""}${t.staff ? ` → ${t.staff.name}` : ""}`;
    const health = await db
      .select({ horse: schema.horses.name, type: schema.healthRecords.type, nextDue: schema.healthRecords.nextDue })
      .from(schema.healthRecords)
      .innerJoin(schema.horses, eq(schema.horses.id, schema.healthRecords.horseId))
      .where(and(eq(schema.horses.ownerId, user.id), lte(schema.healthRecords.nextDue, addDays(today, 7))));
    const trials = await db
      .select({ horse: schema.horses.name, date: schema.trialRequests.date, status: schema.trialRequests.status })
      .from(schema.trialRequests)
      .innerJoin(schema.horses, eq(schema.horses.id, schema.trialRequests.horseId))
      .where(and(eq(schema.horses.ownerId, user.id), gte(schema.trialRequests.date, today), lt(schema.trialRequests.date, addDays(today, 2))));
    const shifts = await db.query.shifts.findMany({
      where: and(eq(schema.shifts.ownerId, user.id), gte(schema.shifts.start, today), lt(schema.shifts.start, addDays(today, 1))),
      with: { staff: true },
    });
    const text = await dailyBriefing({
      yardName: user.name,
      overdue: open.filter((t) => t.dueAt < today).map(fmt),
      tasksToday: open.filter((t) => t.dueAt >= today).map(fmt),
      healthDue: health.map((h) => `${h.horse} ${label(h.type)} ${h.nextDue && h.nextDue < today ? "OVERDUE" : `due ${h.nextDue?.toISOString().slice(0, 10)}`}`),
      trials: trials.map((t) => `${t.horse} ${t.date.toISOString().slice(0, 16).replace("T", " ")} (${t.status.toLowerCase()})`),
      onShift: shifts.map((s) => `${s.staff.name} ${s.start.toTimeString().slice(0, 5)}-${s.end.toTimeString().slice(0, 5)}`),
    });
    return { text };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
