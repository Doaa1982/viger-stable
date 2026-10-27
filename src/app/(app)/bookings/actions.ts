"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { visitNotesToRecord } from "@/lib/ai/features";
import type { AiState } from "@/components/ai-panel";
import { addDays, date, egp, label, str } from "@/lib/utils";

export async function createBooking(proId: string, fd: FormData) {
  const user = await requireUser();
  const when = date(fd, "date");
  const service = str(fd, "service");
  if (!when || !service || proId === user.id) return;
  await db.insert(schema.bookings).values({ proId, clientId: user.id, service, date: when, horseId: str(fd, "horseId"), notes: str(fd, "notes") });
  revalidatePath("/bookings");
  redirect("/bookings");
}

async function ownBookingAsPro(bookingId: string) {
  const user = await requireUser();
  const b = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, bookingId), with: { horse: true, client: true } });
  if (!b || b.proId !== user.id) throw new Error("Booking not found");
  return { user, b };
}

export async function respondBooking(bookingId: string, status: "CONFIRMED" | "DECLINED") {
  await ownBookingAsPro(bookingId);
  await db.update(schema.bookings).set({ status }).where(eq(schema.bookings.id, bookingId));
  revalidatePath("/bookings");
}

export async function rescheduleBooking(bookingId: string, fd: FormData) {
  await ownBookingAsPro(bookingId);
  const when = date(fd, "date");
  if (!when) return;
  await db.update(schema.bookings).set({ date: when, status: "CONFIRMED" }).where(eq(schema.bookings.id, bookingId));
  revalidatePath("/bookings");
}

/**
 * Close a visit (AI Enhancement): the professional pastes or dictates rough notes,
 * the AI writes the horse's health record, a branded invoice and a summary for the owner.
 */
export async function completeVisitAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const { user, b } = await ownBookingAsPro(String(fd.get("bookingId")));
    const notes = str(fd, "notes");
    if (!notes) return { error: "Write or dictate a few words about the visit." };
    const r = await visitNotesToRecord(notes, b.service, b.horse?.name ?? null);
    const total = r.invoiceItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    if (b.horseId) {
      await db.insert(schema.healthRecords).values({
        horseId: b.horseId,
        type: r.record.type,
        date: b.date,
        nextDue: r.record.nextDue ? new Date(r.record.nextDue) : null,
        provider: user.name,
        cost: total,
        notes: r.record.notes,
        source: "PRO_VISIT",
      });
    }
    const count = (await db.query.invoices.findMany({ where: eq(schema.invoices.ownerId, user.id) })).length;
    await db.insert(schema.invoices).values({
      ownerId: user.id,
      number: `INV-${String(count + 1).padStart(4, "0")}`,
      clientName: b.client.name,
      items: JSON.stringify(r.invoiceItems),
      total,
      status: "SENT",
      issuedAt: new Date(),
      dueAt: addDays(new Date(), 14),
      notes: r.clientSummary,
    });
    // The bill lands on the client's Finance Desk as an expense
    await db.insert(schema.transactions).values({
      ownerId: b.clientId,
      horseId: b.horseId,
      kind: "EXPENSE",
      category: label(r.record.type),
      amount: total,
      date: new Date(),
      description: `${b.service} - ${user.name}`,
    });
    await db.update(schema.bookings).set({ status: "COMPLETED", findings: r.record.notes, fee: total }).where(eq(schema.bookings.id, b.id));
    await db.insert(schema.messages).values({ senderId: user.id, receiverId: b.clientId, horseId: b.horseId, content: `${r.clientSummary}\n\nInvoice: ${egp(total)}` });
    // No revalidate here on purpose: the result stays on screen; the diary updates on the next visit.
    return {
      text: `**Visit closed.**\n\n**Health record${b.horse ? ` for ${b.horse.name}` : ""}:** ${label(r.record.type)} - ${r.record.notes}${r.record.nextDue ? ` (next due ${r.record.nextDue})` : ""}\n\n**Invoice (${egp(total)}):**\n${r.invoiceItems.map((i) => `- ${i.description}: ${i.quantity} × ${egp(i.unitPrice)}`).join("\n")}\n\n**Sent to ${b.client.name}:** ${r.clientSummary}\n\n_Refresh the page to move this visit to Completed._`,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
