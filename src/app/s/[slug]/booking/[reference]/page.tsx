import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getBookingPage } from "../../data";
import { whatsappLink } from "@/lib/booking";
import { egp, fmtDate, fmtTime, label } from "@/lib/utils";

const STATUS_TEXT: Record<string, { title: string; text: string; tone: string }> = {
  REQUESTED: { title: "Booking request received", text: "We'll confirm on WhatsApp shortly.", tone: "bg-amber-50 text-amber-800" },
  CONFIRMED: { title: "Booking confirmed", text: "See you at the stable!", tone: "bg-emerald-50 text-emerald-800" },
  PAID: { title: "Booking confirmed and paid", text: "Thank you - see you at the stable!", tone: "bg-emerald-50 text-emerald-800" },
  COMPLETED: { title: "Thank you for riding with us", text: "We hope to see you again.", tone: "bg-stone-100 text-stone-700" },
  CANCELLED: { title: "Booking cancelled", text: "Contact us on WhatsApp if this is a mistake.", tone: "bg-red-50 text-red-700" },
};

export default async function BookingConfirmation({ params }: { params: Promise<{ slug: string; reference: string }> }) {
  const { slug, reference } = await params;
  const { settings } = await getBookingPage(slug);
  const b = await db.query.customerBookings.findFirst({
    where: and(eq(schema.customerBookings.reference, reference.toUpperCase()), eq(schema.customerBookings.ownerId, settings.ownerId)),
  });
  if (!b) notFound();
  const st = STATUS_TEXT[b.status] ?? STATUS_TEXT.REQUESTED;
  const service = b.serviceId ? await db.query.services.findFirst({ where: eq(schema.services.id, b.serviceId) }) : null;
  const isLivery = service ? service.category === "LIVERY" : /livery|boarding/i.test(b.serviceName);
  const wa = whatsappLink(
    settings.whatsapp,
    `Hello ${settings.displayName}, this is ${b.customerName}. My booking reference is ${b.reference}: ${b.serviceName} on ${fmtDate(b.date)}${isLivery ? "" : ` at ${fmtTime(b.date)}`} for ${b.guests}.${b.paymentMethod === "TRANSFER" ? " I am sending the payment screenshot." : ""}`,
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className={`rounded-2xl p-6 text-center ${st.tone}`}>
        <div className="text-4xl">{b.status === "CANCELLED" ? "✕" : "✓"}</div>
        <h1 className="mt-2 text-2xl font-bold">{st.title}</h1>
        <p className="mt-1 text-sm">{st.text}</p>
        <p className="mt-4 text-sm">Your reference</p>
        <p className="font-mono text-2xl font-bold tracking-widest">{b.reference}</p>
      </div>

      <div className="card">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-stone-500">Service</dt><dd className="font-medium">{b.serviceName}</dd>
          <dt className="text-stone-500">{isLivery ? "Start date" : "Date & time"}</dt><dd className="font-medium">{fmtDate(b.date)}{isLivery ? "" : `, ${fmtTime(b.date)} (Egypt time)`}</dd>
          <dt className="text-stone-500">Name</dt><dd className="font-medium">{b.customerName}</dd>
          <dt className="text-stone-500">{isLivery ? "Horses" : "Riders"}</dt><dd className="font-medium">{b.guests}</dd>
          <dt className="text-stone-500">Total</dt><dd className="font-medium">{egp(b.totalEgp)}{b.totalUsd ? ` (≈ $${b.totalUsd})` : ""}</dd>
          <dt className="text-stone-500">Payment</dt><dd className="font-medium">{b.paymentMethod === "TRANSFER" ? "InstaPay / bank transfer" : "Pay at the stable"} · {label(b.status)}</dd>
        </dl>
      </div>

      {b.paymentMethod === "TRANSFER" && b.status !== "PAID" && b.status !== "CANCELLED" && settings.transferDetails && (
        <div className="card border-amber-200 bg-amber-50/50">
          <h2 className="font-semibold">How to pay</h2>
          <p className="mt-1 text-sm text-stone-600">Please transfer <strong>{egp(b.totalEgp)}</strong> and include your reference <strong>{b.reference}</strong>.</p>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 font-sans text-sm">{settings.transferDetails}</pre>
        </div>
      )}

      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" className="btn w-full bg-emerald-600 py-3 text-base text-white hover:bg-emerald-700">
          {b.paymentMethod === "TRANSFER" && b.status === "REQUESTED" ? "Send payment screenshot on WhatsApp" : "Message us on WhatsApp"}
        </a>
      )}
      <p className="text-center text-xs text-stone-500">Save this page or your reference. Need to change something? Just message us.</p>
      <div className="text-center"><Link href={`/s/${slug}`} className="link text-sm">Book something else</Link></div>
    </div>
  );
}
