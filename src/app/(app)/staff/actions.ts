"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { suggestRota } from "@/lib/ai/features";
import type { AiState } from "@/components/ai-panel";
import { addDays, date, num, str, ymd } from "@/lib/utils";
import { DAYS, weekStart } from "./week";

async function ownStaff(staffId: string) {
  const user = await requireUser();
  const s = await db.query.staff.findFirst({ where: and(eq(schema.staff.id, staffId), eq(schema.staff.ownerId, user.id)) });
  if (!s) throw new Error("Staff member not found");
  return { user, s };
}

export async function addStaff(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name");
  if (!name) return;
  await db.insert(schema.staff).values({ ownerId: user.id, name, role: str(fd, "role") ?? "Groom", phone: str(fd, "phone"), skills: str(fd, "skills"), vacationDays: num(fd, "vacationDays") ?? 21 });
  revalidatePath("/staff");
}

export async function removeStaff(staffId: string) {
  await ownStaff(staffId);
  await db.delete(schema.staff).where(eq(schema.staff.id, staffId));
  revalidatePath("/staff");
}

export async function addShift(fd: FormData) {
  const { user } = await ownStaff(String(fd.get("staffId")));
  const day = date(fd, "day");
  const start = str(fd, "start") ?? "07:00";
  const end = str(fd, "end") ?? "15:00";
  if (!day) return;
  const s = new Date(`${day.toISOString().slice(0, 10)}T${start}`);
  let e = new Date(`${day.toISOString().slice(0, 10)}T${end}`);
  if (e <= s) e = addDays(e, 1); // night shift crossing midnight
  await db.insert(schema.shifts).values({ ownerId: user.id, staffId: String(fd.get("staffId")), start: s, end: e, note: str(fd, "note") });
  revalidatePath("/staff");
}

export async function deleteShift(shiftId: string) {
  const user = await requireUser();
  await db.delete(schema.shifts).where(and(eq(schema.shifts.id, shiftId), eq(schema.shifts.ownerId, user.id)));
  revalidatePath("/staff");
}

export async function clockIn(staffId: string) {
  await ownStaff(staffId);
  const open = await db.query.timeEntries.findFirst({ where: and(eq(schema.timeEntries.staffId, staffId), isNull(schema.timeEntries.clockOut)) });
  if (!open) await db.insert(schema.timeEntries).values({ staffId, clockIn: new Date() });
  revalidatePath("/staff");
}

export async function clockOut(staffId: string) {
  await ownStaff(staffId);
  await db.update(schema.timeEntries).set({ clockOut: new Date() }).where(and(eq(schema.timeEntries.staffId, staffId), isNull(schema.timeEntries.clockOut)));
  revalidatePath("/staff");
}

/** AI Enhancement: build next week's rota from staff skills and yard size. */
export async function aiRotaAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const user = await requireUser();
    const staff = await db.query.staff.findMany({ where: eq(schema.staff.ownerId, user.id) });
    if (!staff.length) return { error: "Add your staff first." };
    const horses = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, user.id) });
    const offset = num(fd, "week") ?? 1;
    const ws = weekStart(offset);
    const r = await suggestRota(staff.map((s) => ({ name: s.name, role: s.role, skills: s.skills })), horses.length, str(fd, "notes") ?? "");
    const lines = r.shifts.map((sh) => `- ${DAYS[sh.day] ?? sh.day} · ${sh.staffName} ${sh.start}-${sh.end}`);
    if (fd.get("apply") === "on") {
      await db.delete(schema.shifts).where(and(eq(schema.shifts.ownerId, user.id), gte(schema.shifts.start, ws), lt(schema.shifts.start, addDays(ws, 7))));
      const rows = r.shifts.flatMap((sh) => {
        const person = staff.find((s) => s.name.toLowerCase() === sh.staffName.toLowerCase());
        if (!person) return [];
        const d = ymd(addDays(ws, sh.day));
        const start = new Date(`${d}T${sh.start}`);
        let end = new Date(`${d}T${sh.end}`);
        if (end <= start) end = addDays(end, 1);
        return [{ ownerId: user.id, staffId: person.id, start, end, note: "AI rota" }];
      });
      if (rows.length) await db.insert(schema.shifts).values(rows);
      revalidatePath("/staff");
    }
    return { text: `${r.reasoning}\n\n${fd.get("apply") === "on" ? "**Applied to the week of " + ws.toDateString() + ".**\n\n" : ""}${lines.join("\n")}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
