import "server-only";
import { and, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";

export function newInviteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Buffer.from(bytes).toString("base64url");
}

/**
 * Link a membership to the matching records so each portal shows the right data:
 *  - staff roles  → a Staff record (rota, tasks, time clock)
 *  - horse owners → a livery Client (their horses and invoices)
 *  - students     → a Student record (lessons and progress)
 * Creates the record if none matches by name/phone.
 */
export async function linkMembership(m: typeof schema.memberships.$inferSelect) {
  const patch: Partial<typeof schema.memberships.$inferInsert> = {};
  const phone = m.phone ?? undefined;
  if (["MANAGER", "COACH", "GROOM", "STAFF_RIDER"].includes(m.role) && !m.staffId) {
    const found = await db.query.staff.findFirst({
      where: and(eq(schema.staff.ownerId, m.ownerId), phone ? or(eq(schema.staff.name, m.name), eq(schema.staff.phone, phone)) : eq(schema.staff.name, m.name)),
    });
    const roleName = { MANAGER: "Yard manager", COACH: "Coach", GROOM: "Groom", STAFF_RIDER: "Rider" }[m.role]!;
    const s = found ?? (await db.insert(schema.staff).values({ ownerId: m.ownerId, name: m.name, role: roleName, phone: m.phone }).returning())[0];
    patch.staffId = s.id;
  }
  if (m.role === "HORSE_OWNER" && !m.clientId) {
    const found = await db.query.clients.findFirst({
      where: and(eq(schema.clients.ownerId, m.ownerId), phone ? or(eq(schema.clients.name, m.name), eq(schema.clients.phone, phone)) : eq(schema.clients.name, m.name)),
    });
    const c = found ?? (await db.insert(schema.clients).values({ ownerId: m.ownerId, name: m.name, phone: m.phone, email: m.email }).returning())[0];
    patch.clientId = c.id;
  }
  if (m.role === "STUDENT" && !m.studentId) {
    const found = await db.query.students.findFirst({
      where: and(eq(schema.students.ownerId, m.ownerId), phone ? or(eq(schema.students.name, m.name), eq(schema.students.phone, phone)) : eq(schema.students.name, m.name)),
    });
    const st = found ?? (await db.insert(schema.students).values({ ownerId: m.ownerId, name: m.name, phone: m.phone, email: m.email }).returning())[0];
    patch.studentId = st.id;
  }
  if (Object.keys(patch).length) await db.update(schema.memberships).set(patch).where(eq(schema.memberships.id, m.id));
  return { ...m, ...patch };
}

/** Digits only, last 9 - used to match a customer account to bookings made with the same phone. */
export function phoneKey(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-9) : null;
}
