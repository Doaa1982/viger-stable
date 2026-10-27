"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { aiEnabled, askText } from "@/lib/ai/client";
import type { AiState } from "@/components/ai-panel";
import { label, num, str } from "@/lib/utils";
import { parseBoxNumbers, stallLabel } from "@/lib/yard";

export type BoardState = { error?: string; ok?: string } | undefined;

/** Add boxes to a stable ("Stable 1" + boxes "1,2,3" → Stable 1 · Box 1, Box 2, Box 3), or a paddock. */
export async function addStall(_: BoardState, fd: FormData): Promise<BoardState> {
  const { ownerId } = await requirePerm("yard");
  const kind = str(fd, "kind") === "PADDOCK" ? "PADDOCK" : "STALL";
  if (kind === "PADDOCK") {
    const name = str(fd, "paddockName");
    if (!name) return { error: "Give the paddock a name, e.g. Paddock B." };
    await db.insert(schema.stalls).values({ ownerId, name, building: "Paddocks", kind, capacity: Math.max(1, num(fd, "capacity") ?? 3) });
    revalidatePath("/yard-board");
    return { ok: `${name} added.` };
  }
  const picked = str(fd, "stable");
  const stable = (picked === "__new" || !picked ? str(fd, "newStable") : picked)?.replace(/\s+/g, " ").trim();
  if (!stable) return { error: "Choose a stable or type the name of a new one, e.g. Stable 3." };
  const numbers = parseBoxNumbers(str(fd, "boxes") ?? "");
  if (!numbers.length) return { error: "Type the box numbers, e.g. 1,2,3 or 1-6." };
  const existing = new Set(
    (await db.query.stalls.findMany({ where: and(eq(schema.stalls.ownerId, ownerId), eq(schema.stalls.building, stable)) })).map((x) => x.name.toLowerCase()),
  );
  const fresh = numbers.filter((n) => !existing.has(`box ${n}`));
  if (fresh.length) await db.insert(schema.stalls).values(fresh.map((n) => ({ ownerId, name: `Box ${n}`, building: stable, kind, capacity: 1 })));
  const skipped = numbers.filter((n) => !fresh.includes(n));
  revalidatePath("/yard-board");
  if (!fresh.length) return { error: `${stable} already has box ${skipped.join(", ")}.` };
  return { ok: `${stable}: added box ${fresh.join(", ")}${skipped.length ? ` (box ${skipped.join(", ")} already there)` : ""}.` };
}

/** Rename a stable - all its boxes move with it. */
export async function renameStable(oldName: string, fd: FormData) {
  const { ownerId } = await requirePerm("yard");
  const name = str(fd, "name")?.replace(/\s+/g, " ").trim();
  if (!name || name === oldName) return;
  await db.update(schema.stalls).set({ building: name }).where(and(eq(schema.stalls.ownerId, ownerId), eq(schema.stalls.building, oldName)));
  revalidatePath("/yard-board");
}

export async function deleteStall(id: string) {
  const { user, ownerId } = await requirePerm("yard");
  await db.delete(schema.stalls).where(and(eq(schema.stalls.id, id), eq(schema.stalls.ownerId, ownerId)));
  revalidatePath("/yard-board");
}

/** Move a horse into a stall/paddock. Blocks the move if capacity is full or a conflict exists. */
export async function assignHorse(_: BoardState, fd: FormData): Promise<BoardState> {
  const { user, ownerId } = await requirePerm("yard");
  const horseId = str(fd, "horseId");
  const stallId = str(fd, "stallId");
  if (!horseId) return { error: "Choose a horse." };
  const horse = await db.query.horses.findFirst({ where: and(eq(schema.horses.id, horseId), eq(schema.horses.ownerId, ownerId)) });
  if (!horse) return { error: "Horse not found." };
  if (stallId) {
    const stall = await db.query.stalls.findFirst({ where: and(eq(schema.stalls.id, stallId), eq(schema.stalls.ownerId, ownerId)), with: { horses: true } });
    if (!stall) return { error: "Box not found." };
    const occupants = stall.horses.filter((h) => h.id !== horseId);
    if (occupants.length >= stall.capacity) return { error: `${stallLabel(stall)} is full (${stall.capacity}).` };
    for (const o of occupants) {
      const c = await db.query.horseConflicts.findFirst({
        where: or(and(eq(schema.horseConflicts.horseAId, horseId), eq(schema.horseConflicts.horseBId, o.id)), and(eq(schema.horseConflicts.horseAId, o.id), eq(schema.horseConflicts.horseBId, horseId))),
      });
      if (c) return { error: `Blocked: ${horse.name} and ${o.name} don't get on - ${c.reason}` };
    }
  }
  await db.update(schema.horses).set({ stallId }).where(eq(schema.horses.id, horseId));
  revalidatePath("/yard-board");
  return { ok: stallId ? `${horse.name} moved.` : `${horse.name} taken out of their box.` };
}

export async function addConflict(fd: FormData) {
  const { user, ownerId } = await requirePerm("yard");
  const a = str(fd, "horseA");
  const b = str(fd, "horseB");
  if (!a || !b || a === b) return;
  const owned = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, ownerId) });
  if (!owned.some((h) => h.id === a) || !owned.some((h) => h.id === b)) return;
  await db.insert(schema.horseConflicts).values({ horseAId: a, horseBId: b, reason: str(fd, "reason") ?? "Do not pair" });
  revalidatePath("/yard-board");
}

export async function deleteConflict(id: string) {
  await requirePerm("yard");
  await db.delete(schema.horseConflicts).where(eq(schema.horseConflicts.id, id));
  revalidatePath("/yard-board");
}

/** AI Enhancement: suggest turnout groups and stable placement. */
export async function aiTurnoutAction(): Promise<AiState> {
  try {
    const { user, ownerId } = await requirePerm("yard");
    const horses = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, ownerId), with: { stall: true } });
    const ids = horses.map((h) => h.id);
    const conflicts = (await db.query.horseConflicts.findMany({ with: { horseA: true, horseB: true } })).filter((c) => ids.includes(c.horseAId));
    const paddocks = await db.query.stalls.findMany({ where: and(eq(schema.stalls.ownerId, ownerId), eq(schema.stalls.kind, "PADDOCK")) });
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
      prompt: `Horses: ${horses.map((h) => `${h.name} (${label(h.sex)}, ${h.temperament ?? "temperament unknown"}, now in ${stallLabel(h.stall) ?? "no box"})`).join("; ")}
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
