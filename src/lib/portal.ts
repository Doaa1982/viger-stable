import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { phoneKey } from "@/lib/members";
import type { Access } from "@/lib/access";

/** Customer bookings that belong to this account: same phone (last 9 digits) or same email. */
export async function myCustomerBookings(a: Access) {
  const key = phoneKey(a.membership?.phone ?? a.user.phone);
  const email = (a.membership?.email ?? a.user.email ?? "").toLowerCase();
  const all = await db.query.customerBookings.findMany({ where: eq(schema.customerBookings.ownerId, a.ownerId) });
  return all
    .filter((b) => (key && phoneKey(b.phone) === key) || (email && b.email?.toLowerCase() === email))
    .sort((x, y) => y.date.getTime() - x.date.getTime());
}

export async function myStaffId(a: Access) {
  const id = a.membership?.staffId;
  if (!id) return null;
  const s = await db.query.staff.findFirst({ where: and(eq(schema.staff.id, id), eq(schema.staff.ownerId, a.ownerId)) });
  return s?.id ?? null;
}
