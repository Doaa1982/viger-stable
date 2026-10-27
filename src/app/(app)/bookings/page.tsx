import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { AiPanel } from "@/components/ai-panel";
import { AiTag, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { egp, fmtDateTime, label } from "@/lib/utils";
import { completeVisitAction, rescheduleBooking, respondBooking } from "./actions";

const tone = (s: string) => (s === "CONFIRMED" ? "green" : s === "COMPLETED" ? "blue" : s === "DECLINED" ? "gray" : "amber");

export default async function BookingsPage() {
  const user = await requireUser();
  const isPro = user.role === "PROFESSIONAL";
  const asPro = isPro
    ? await db.query.bookings.findMany({ where: eq(schema.bookings.proId, user.id), with: { client: true, horse: true }, orderBy: desc(schema.bookings.date) })
    : [];
  const asClient = await db.query.bookings.findMany({ where: eq(schema.bookings.clientId, user.id), with: { pro: true, horse: true }, orderBy: desc(schema.bookings.date) });

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" subtitle={isPro ? "Requests from clients and your visit diary" : "Visits and lessons you have booked"} />
      {isPro && (
        <Card title="Client bookings">
          {asPro.length === 0 ? <Empty>No bookings yet.</Empty> : (
            <ul className="space-y-4">
              {asPro.map((b) => (
                <li key={b.id} className="rounded-lg border border-stone-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <strong>{b.service}</strong> · {fmtDateTime(b.date)} · {b.client.name}{b.horse && ` · 🐎 ${b.horse.name}`}
                      {b.notes && <p className="text-stone-500">{b.notes}</p>}
                    </div>
                    <Badge tone={tone(b.status)}>{label(b.status)}</Badge>
                  </div>
                  {b.status === "PENDING" && (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <form action={respondBooking.bind(null, b.id, "CONFIRMED")}><button className="btn-primary btn-sm">Confirm</button></form>
                      <form action={respondBooking.bind(null, b.id, "DECLINED")}><button className="btn-secondary btn-sm">Decline</button></form>
                      <form action={rescheduleBooking.bind(null, b.id)} className="flex items-end gap-2">
                        <input type="datetime-local" name="date" className="input w-auto" required />
                        <button className="btn-secondary btn-sm">Suggest new time</button>
                      </form>
                    </div>
                  )}
                  {b.status === "CONFIRMED" && (
                    <div className="mt-3 rounded-lg bg-violet-50/50 p-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">Close visit <AiTag /></div>
                      <AiPanel action={completeVisitAction} button="Write record & invoice" hidden={{ bookingId: b.id }}>
                        <textarea name="notes" rows={3} className="input" placeholder="Type or dictate your notes, e.g. 'Grade 1 lame LF, mild heat, rest 5 days, bute 2g x3 days, recheck next week. Visit 800, meds 250'" />
                      </AiPanel>
                    </div>
                  )}
                  {b.status === "COMPLETED" && b.findings && <p className="mt-2 text-sm text-stone-600">Findings: {b.findings} · {egp(b.fee)}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <Card title="My bookings" actions={<Link href="/professionals" className="link text-sm">Book a professional →</Link>}>
        {asClient.length === 0 ? <Empty>No bookings.</Empty> : (
          <table className="table">
            <thead><tr><th>Date</th><th>Service</th><th>Professional</th><th>Horse</th><th>Status</th></tr></thead>
            <tbody>
              {asClient.map((b) => (
                <tr key={b.id}>
                  <td>{fmtDateTime(b.date)}</td><td>{b.service}</td>
                  <td><Link href={`/professionals/${b.proId}`} className="link">{b.pro.name}</Link></td>
                  <td>{b.horse?.name ?? "—"}</td>
                  <td><Badge tone={tone(b.status)}>{label(b.status)}</Badge>{b.findings && <p className="mt-1 text-xs text-stone-500">{b.findings}</p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
