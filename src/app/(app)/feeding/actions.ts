"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { generateFeedPlan } from "@/lib/ai/features";
import type { AiState } from "@/components/ai-panel";
import { str } from "@/lib/utils";

async function ownHorse(horseId: string) {
  const user = await requireUser();
  const h = await db.query.horses.findFirst({ where: and(eq(schema.horses.id, horseId), eq(schema.horses.ownerId, user.id)) });
  if (!h) throw new Error("Horse not found");
  return h;
}

async function replacePlan(horseId: string, plan: Omit<typeof schema.feedPlans.$inferInsert, "horseId">) {
  await db.update(schema.feedPlans).set({ active: false }).where(eq(schema.feedPlans.horseId, horseId));
  await db.insert(schema.feedPlans).values({ ...plan, horseId, active: true });
  revalidatePath("/feeding");
  revalidatePath(`/horses/${horseId}`);
}

export async function saveFeedPlan(fd: FormData) {
  const h = await ownHorse(String(fd.get("horseId")));
  await replacePlan(h.id, {
    name: str(fd, "name") ?? "Standard",
    morning: str(fd, "morning"),
    midday: str(fd, "midday"),
    evening: str(fd, "evening"),
    supplements: str(fd, "supplements"),
    notes: str(fd, "notes"),
  });
}

/** AI Enhancement: nutrition plan from weight, workload, season and local feeds. */
export async function aiFeedAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const h = await ownHorse(String(fd.get("horseId")));
    const p = await generateFeedPlan(h, str(fd, "goal") ?? "maintain condition", str(fd, "workload") ?? "Moderate");
    if (fd.get("apply") === "on") await replacePlan(h.id, { ...p, aiGenerated: true });
    return {
      text: `**${p.name}**\n\n- **Morning:** ${p.morning}\n- **Midday:** ${p.midday}\n- **Evening:** ${p.evening}\n- **Supplements:** ${p.supplements}\n\n${p.notes}${fd.get("apply") === "on" ? "\n\n_Saved as the active plan._" : ""}`,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
