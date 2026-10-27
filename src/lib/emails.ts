import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ROLE_LABEL } from "@/lib/access";
import { sendEmail, siteUrl } from "@/lib/email";
import { egp, fmtDate, fmtDateTime } from "@/lib/utils";

type Membership = typeof schema.memberships.$inferSelect;
type Booking = typeof schema.customerBookings.$inferSelect;

async function stableInfo(ownerId: string) {
  const [owner, settings] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.id, ownerId) }),
    db.query.bookingSettings.findFirst({ where: eq(schema.bookingSettings.ownerId, ownerId) }),
  ]);
  return { name: settings?.displayName ?? owner?.name ?? "Viger Stable", email: settings?.email || owner?.email || null, settings };
}

export async function emailInvite(m: Membership) {
  if (!m.email || !m.inviteToken) return { sent: false, reason: "No email address for this person." };
  const st = await stableInfo(m.ownerId);
  const url = `${await siteUrl()}/invite/${m.inviteToken}`;
  return sendEmail({
    to: m.email,
    subject: `You're invited to ${st.name}`,
    heading: st.name,
    lines: [`Hello ${m.name},`, `${st.name} has invited you to join as ${ROLE_LABEL[m.role] ?? m.role}. Open the link below to create your login - it takes a minute.`, `This link works until ${fmtDate(m.inviteExpires)}.`],
    button: { text: "Create my login", url },
    replyTo: st.email,
    footer: `${st.name} · sent with Viger Stable`,
  });
}

function bookingLines(b: Booking) {
  const total = `${egp(b.totalEgp)}${b.totalUsd ? ` (about $${b.totalUsd})` : ""}`;
  return [
    `Booking reference: ${b.reference}`,
    `${b.serviceName}\n${fmtDateTime(b.date)} (Egypt time)\n${b.guests} ${b.guests === 1 ? "person" : "people"} · ${total}`,
    b.paymentMethod === "TRANSFER" ? "Payment: InstaPay / bank transfer" : "Payment: at the stable on the day",
  ];
}

/** To the customer right after they book (a request until the stable confirms). */
export async function emailBookingReceived(b: Booking) {
  if (!b.email) return { sent: false };
  const st = await stableInfo(b.ownerId);
  const url = `${await siteUrl()}/s/${st.settings?.slug}/booking/${b.reference}`;
  const transfer = b.paymentMethod === "TRANSFER" && st.settings?.transferDetails ? [`How to pay:\n${st.settings.transferDetails}`] : [];
  return sendEmail({
    to: b.email,
    subject: `Booking request ${b.reference} - ${st.name}`,
    heading: st.name,
    lines: [`Hello ${b.customerName},`, "Thank you! We have received your booking request. We'll confirm it shortly by email or WhatsApp.", ...bookingLines(b), ...transfer, st.settings?.address ? `Where: ${st.settings.address}` : ""].filter(Boolean),
    button: { text: "View my booking", url },
    replyTo: st.email,
    footer: `${st.name} · reply to this email if you have questions`,
  });
}

/** To the stable: a new booking came in. */
export async function emailStableNewBooking(b: Booking) {
  const st = await stableInfo(b.ownerId);
  if (!st.email) return { sent: false };
  return sendEmail({
    to: st.email,
    subject: `New booking: ${b.serviceName} - ${fmtDateTime(b.date)}`,
    heading: "New booking request",
    lines: [`${b.customerName}${b.country ? ` (${b.country})` : ""} · ${b.phone}${b.email ? ` · ${b.email}` : ""}`, ...bookingLines(b), b.notes ? `Notes: ${b.notes}` : ""].filter(Boolean),
    button: { text: "Open customer bookings", url: `${await siteUrl()}/customer-bookings` },
    replyTo: b.email,
  });
}

/** To the customer when the stable confirms or cancels. */
export async function emailBookingStatus(b: Booking, status: "CONFIRMED" | "CANCELLED") {
  if (!b.email) return { sent: false };
  const st = await stableInfo(b.ownerId);
  const url = `${await siteUrl()}/s/${st.settings?.slug}/booking/${b.reference}`;
  const confirmed = status === "CONFIRMED";
  return sendEmail({
    to: b.email,
    subject: `${confirmed ? "Confirmed" : "Cancelled"}: ${b.serviceName} - ${b.reference}`,
    heading: st.name,
    lines: [
      `Hello ${b.customerName},`,
      confirmed ? "Good news - your booking is confirmed. We look forward to seeing you!" : "Your booking has been cancelled. If this is a mistake or you'd like another date, just reply to this email.",
      ...bookingLines(b),
      confirmed && st.settings?.address ? `Where: ${st.settings.address}${st.settings.mapUrl ? `\nMap: ${st.settings.mapUrl}` : ""}` : "",
      confirmed ? "Please arrive 15 minutes early. Wear long trousers and closed shoes." : "",
    ].filter(Boolean),
    button: { text: "View my booking", url },
    replyTo: st.email,
  });
}
