import Link from "next/link";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, Stat, Tabs } from "@/components/ui";
import { whatsappLink } from "@/lib/booking";
import { addDays, egp, fmtDate, fmtTime, label, startOfDay, ymd, zonedDate } from "@/lib/utils";
import { setBookingStatus } from "./actions";

const TONE: Record<string, "amber" | "green" | "blue" | "gray" | "red"> = { REQUESTED: "amber", CONFIRMED: "blue", PAID: "green", COMPLETED: "gray", CANCELLED: "red" };
const EXP: Record<string, string> = { NONE: "Beginner", SOME: "Some experience", CONFIDENT: "Confident" };

export default async function CustomerBookingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireUser();
  const { view = "upcoming" } = await searchParams;
  const today = startOfDay();
  const settings = await db.query.bookingSettings.findFirst({ where: eq(schema.bookingSettings.ownerId, user.id) });
  const base = eq(schema.customerBookings.ownerId, user.id);
  const where =
    view === "requests"
      ? and(base, eq(schema.customerBookings.status, "REQUESTED"))
      : view === "today"
        ? and(base, gte(schema.customerBookings.date, today), lt(schema.customerBookings.date, addDays(today, 1)))
        : view === "past"
          ? and(base, lt(schema.customerBookings.date, today))
          : and(base, gte(schema.customerBookings.date, today));
  const bookings = await db.query.customerBookings.findMany({ where, orderBy: view === "past" ? desc(schema.customerBookings.date) : asc(schema.customerBookings.date), limit: 200 });
  const all = await db.query.customerBookings.findMany({ where: base });
  const requests = all.filter((b) => b.status === "REQUESTED").length;
  const todayCount = all.filter((b) => b.date >= today && b.date < addDays(today, 1) && b.status !== "CANCELLED").length;
  const monthStart = zonedDate(`${ymd(today).slice(0, 8)}01`)!;
  const revenue = all.filter((b) => b.status === "PAID" || b.status === "COMPLETED").filter((b) => b.date >= monthStart).reduce((s, b) => s + b.totalEgp, 0);
  const q = (v: string) => `/customer-bookings?view=${v}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer bookings"
        subtitle="Requests from your public booking page"
        actions={settings ? <><Link href={`/s/${settings.slug}`} target="_blank" className="btn-secondary">Open public page ↗</Link><Link href="/booking-page" className="btn-secondary">Edit services</Link></> : <Link href="/booking-page" className="btn-primary">Create booking page</Link>}
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="New requests" value={requests} tone={requests ? "warn" : "default"} hint="waiting for your reply" />
        <Stat label="Today" value={todayCount} hint="bookings" />
        <Stat label="Paid this month" value={egp(revenue)} tone="good" />
      </div>
      <Tabs active={q(view)} items={[{ href: q("upcoming"), label: "Upcoming" }, { href: q("requests"), label: `Requests (${requests})` }, { href: q("today"), label: "Today" }, { href: q("past"), label: "Past" }]} />
      <Card>
        {bookings.length === 0 ? (
          <Empty>{settings ? "No bookings here yet. Share your booking page link to start receiving requests." : "Create your booking page to start receiving bookings."}</Empty>
        ) : (
          <ul className="space-y-3">
            {bookings.map((b) => {
              const when = `${fmtDate(b.date)} ${fmtTime(b.date)}`;
              const confirmText = `Hello ${b.customerName}, your booking at ${settings?.displayName ?? "our stable"} is confirmed ✅\n${b.serviceName}\n${when} (Egypt time), ${b.guests} ${b.guests > 1 ? "people" : "person"}\nReference: ${b.reference}\nTotal: ${egp(b.totalEgp)}${b.paymentMethod === "TRANSFER" ? "\nPlease send the transfer screenshot here." : "\nPayment at the stable."}${settings?.mapUrl ? `\nLocation: ${settings.mapUrl}` : ""}\nSee you soon!`;
              const wa = whatsappLink(b.phone, b.status === "REQUESTED" || b.status === "CONFIRMED" ? confirmText : `Hello ${b.customerName}, about your booking ${b.reference}…`);
              return (
                <li key={b.id} className="rounded-lg border border-stone-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{b.serviceName}</div>
                      <div className="text-sm text-stone-600">{when} · {b.guests} {b.guests > 1 ? "people" : "person"} · {egp(b.totalEgp)}{b.totalUsd ? ` (≈ $${b.totalUsd})` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-stone-500">{b.reference}</span>
                      <Badge tone={TONE[b.status]}>{label(b.status)}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 text-sm">
                    <strong>{b.customerName}</strong> · {b.phone}{b.email && ` · ${b.email}`}{b.country && ` · ${b.country}`}
                    {b.experience && <span className="text-stone-500"> · {EXP[b.experience] ?? b.experience}</span>}
                    <span className="text-stone-500"> · {b.paymentMethod === "TRANSFER" ? "Bank / InstaPay" : "Pay at stable"}</span>
                  </div>
                  {b.notes && <p className="mt-1 text-sm text-stone-600">“{b.notes}”</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {b.status === "REQUESTED" && <form action={setBookingStatus.bind(null, b.id, "CONFIRMED")}><button className="btn-primary btn-sm">Confirm</button></form>}
                    {(b.status === "REQUESTED" || b.status === "CONFIRMED") && <form action={setBookingStatus.bind(null, b.id, "PAID")}><button className="btn-secondary btn-sm">Mark paid</button></form>}
                    {(b.status === "PAID" || b.status === "CONFIRMED") && b.date < new Date() && <form action={setBookingStatus.bind(null, b.id, "COMPLETED")}><button className="btn-secondary btn-sm">Completed</button></form>}
                    {b.status !== "CANCELLED" && b.status !== "COMPLETED" && <form action={setBookingStatus.bind(null, b.id, "CANCELLED")}><button className="btn-secondary btn-sm text-red-600">Cancel</button></form>}
                    {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700">{b.status === "REQUESTED" ? "Confirm on WhatsApp" : "WhatsApp"}</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
