"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { myCustomerBookings, myStaffId } from "@/lib/portal";
import { num, str } from "@/lib/utils";

export async function myClockIn() {
  const a = await requirePerm("portal");
  const staffId = await myStaffId(a);
  if (!staffId) return;
  const open = await db.query.timeEntries.findFirst({ where: and(eq(schema.timeEntries.staffId, staffId), isNull(schema.timeEntries.clockOut)) });
  if (!open) await db.insert(schema.timeEntries).values({ staffId, clockIn: new Date() });
  revalidatePath("/me");
}

export async function myClockOut() {
  const a = await requirePerm("portal");
  const staffId = await myStaffId(a);
  if (!staffId) return;
  await db.update(schema.timeEntries).set({ clockOut: new Date() }).where(and(eq(schema.timeEntries.staffId, staffId), isNull(schema.timeEntries.clockOut)));
  revalidatePath("/me");
}

/** Staff tick off a task assigned to them. */
export async function finishMyTask(taskId: string) {
  const a = await requirePerm("portal");
  const staffId = await myStaffId(a);
  if (!staffId) return;
  await db
    .update(schema.tasks)
    .set({ done: true, doneAt: new Date() })
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.ownerId, a.ownerId), eq(schema.tasks.staffId, staffId)));
  revalidatePath("/me");
}

/** Customer leaves a review for a completed booking (one per booking). */
export async function leaveReview(bookingId: string, fd: FormData) {
  const a = await requirePerm("portal");
  const booking = (await myCustomerBookings(a)).find((b) => b.id === bookingId);
  if (!booking || booking.status !== "COMPLETED") return;
  const existing = await db.query.reviews.findFirst({ where: eq(schema.reviews.bookingId, bookingId) });
  if (existing) return;
  const rating = Math.min(5, Math.max(1, num(fd, "rating") ?? 5));
  await db.insert(schema.reviews).values({
    ownerId: a.ownerId,
    bookingId,
    userId: a.user.id,
    authorName: booking.customerName,
    country: booking.country,
    rating,
    comment: str(fd, "comment")?.slice(0, 1000) ?? null,
  });
  revalidatePath("/me");
}
