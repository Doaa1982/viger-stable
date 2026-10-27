"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { aiEnabled, askText } from "@/lib/ai/client";
import type { AiState } from "@/components/ai-panel";
import { label, num, str } from "@/lib/utils";

export type BoardState = { error?: string; ok?: string } | undefined;

export async function addStall(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name");
  if (!name) return;
  await db.insert(schema.stalls).values({ ownerId: user.id, name, building: str(fd, "building") ?? "Main barn", kind: str(fd, "kind") ?? "STALL", capacity: num(fd, "capacity") ?? 1 });
  revalidatePath("/yard-board");
}

export async function deleteStall(id: string) {
  const user = await requireUser();
  await db.delete(schema.stalls).where(and(eq(schema.stalls.id, id), eq(schema.stalls.ownerId, user.id)));
  revalidatePath("/yard-board");
}

/** Move a horse into a stall/paddock. Blocks the move if capacity is full or a conflict exists. */
export async function assignHorse(_: BoardState, fd: FormData): Promise<BoardState> {
  const user = await requireUser();
  const horseId = str(fd, "horseId");
  const stallId = str(fd, "stallId");
  if (!horseId) return { error: "Choose a horse." };
  const horse = await db.query.horses.findFirst({ where: and(eq(schema.horses.id, horseId), eq(schema.horses.ownerId, user.id)) });
  if (!horse) return { error: "Horse not found." };
  if (stallId) {
    const stall = await db.query.stalls.findFirst({ where: and(eq(schema.stalls.id, stallId), eq(schema.stalls.ownerId, user.id)), with: { horses: true } });
    if (!stall) return { error: "Stall not found." };
    const occupants = stall.horses.filter((h) => h.id !== horseId);
    if (occupants.length >= stall.capacity) return { error: `${stall.name} is full (${stall.capacity}).` };
    for (const o of occupants) {
      const c = await db.query.horseConflicts.findFirst({
        where: or(and(eq(schema.horseConflicts.horseAId, horseId), eq(schema.horseConflicts.horseBId, o.id)), and(eq(schema.horseConflicts.horseAId, o.id), eq(schema.horseConflicts.horseBId, horseId))),
      });
      if (c) return { error: `Blocked: ${horse.name} and ${o.name} don't get on - ${c.reason}` };
    }
  }
  await db.update(schema.horses).set({ stallId }).where(eq(schema.horses.id, horseId));
  revalidatePath("/yard-board");
  return { ok: stallId ? `${horse.name} moved.` : `${horse.name} unassigned.` };
}

export async function addConflict(fd: FormData) {
  const user = await requireUser();
  const a = str(fd, "horseA");
  const b = str(fd, "horseB");
  if (!a || !b || a === b) return;
  const owned = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, user.id) });
  if (!owned.some((h) => h.id === a) || !owned.some((h) => h.id === b)) return;
  await db.insert(schema.horseConflicts).values({ horseAId: a, horseBId: b, reason: str(fd, "reason") ?? "Do not pair" });
  revalidatePath("/yard-board");
}

export async function deleteConflict(id: string) {
  await requireUser();
  await db.delete(schema.horseConflicts).where(eq(schema.horseConflicts.id, id));
  revalidatePath("/yard-board");
}

/** AI Enhancement: suggest turnout groups and stable placement. */
export async function aiTurnoutAction(): Promise<AiState> {
  try {
    const user = await requireUser();
    const horses = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, user.id), with: { stall: true } });
    const ids = horses.map((h) => h.id);
    const conflicts = (await db.query.horseConflicts.findMany({ with: { horseA: true, horseB: true } })).filter((c) => ids.includes(c.horseAId));
    const paddocks = await db.query.stalls.findMany({ where: and(eq(schema.stalls.ownerId, user.id), eq(schema.stalls.kind, "PADDOCK")) });
    if (!aiEnabled()) {
      const mares = horses.filter((h) => h.sex === "MARE").map((h) => h.name);
      const geldings = horses.filter((h) => h.sex === "GELDING").map((h) => h.name);
      const stallions = horses.filter((h) => h.sex === "STALLION").map((h) => h.name);
      return {
        text: `**Suggested turnout groups (demo mode)**\n\n- Mares: ${mares.join(", ") || "—"}\n- Geldings: ${geldings.join(", ") || "—"}\n- Stallions turned out alone: ${stallions.join(", ") || "—"}\n\n${conflicts.length ? `Kept apart: ${conflicts.map((c) => `${c.horseA.name} & ${c.horseB.name}`).join("; ")}` : ""}\n\n_Connect the AI for suggestions using temperament and history._`,
      };
    }
    const text = await askText({
      system: "You are an experienced yard manager. Suggest safe turnout groups and stable placement. Stallions are turned out alone. Respect every conflict.",
      prompt: `Horses: ${horses.map((h) => `${h.name} (${label(h.sex)}, ${h.temperament ?? "temperament unknown"}, now in ${h.stall?.name ?? "no stall"})`).join("; ")}
Conflicts: ${conflicts.map((c) => `${c.horseA.name} vs ${c.horseB.name}: ${c.reason}`).join("; ") || "none"}
Paddocks: ${paddocks.map((p) => `${p.name} (capacity ${p.capacity})`).join(", ") || "none listed"}
Climate: Egypt - turnout early morning or evening in summer.
Give groups as bullet points with a short reason each, then 2-3 safety tips.`,
      maxTokens: 700,
    });
    return { text };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
