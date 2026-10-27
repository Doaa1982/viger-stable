"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { BOOKING_STATUSES } from "@/lib/booking";
import { fmtTime } from "@/lib/utils";

export async function setBookingStatus(id: string, status: string) {
  const user = await requireUser();
  if (!(BOOKING_STATUSES as readonly string[]).includes(status)) return;
  const b = await db.query.customerBookings.findFirst({ where: and(eq(schema.customerBookings.id, id), eq(schema.customerBookings.ownerId, user.id)) });
  if (!b) return;
  await db.update(schema.customerBookings).set({ status }).where(eq(schema.customerBookings.id, id));

  // Confirming adds the ride to the yard's task list so staff prepare the horses
  if (status === "CONFIRMED" && b.status === "REQUESTED") {
    await db.insert(schema.tasks).values({
      ownerId: user.id,
      title: `Customer: ${b.serviceName} - ${b.customerName} (${b.guests}) · ${b.reference}`,
      category: "TRIAL",
      priority: 1,
      dueAt: new Date(b.date.getTime() - 30 * 60_000), // horses ready 30 min before
    });
  }
  // Payment received → income in the Finance Desk
  if (status === "PAID" && b.status !== "PAID") {
    await db.insert(schema.transactions).values({
      ownerId: user.id,
      kind: "INCOME",
      category: "Customer bookings",
      amount: b.totalEgp,
      date: new Date(),
      description: `${b.reference} ${b.serviceName} - ${b.customerName} (${fmtTime(b.date)})`,
    });
  }
  revalidatePath("/customer-bookings");
  revalidatePath("/dashboard");
}
