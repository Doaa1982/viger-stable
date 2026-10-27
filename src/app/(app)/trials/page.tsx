import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDateTime, label } from "@/lib/utils";
import { cancelTrial, decideTrial } from "./actions";

const tone = (s: string) => (s === "APPROVED" ? "green" : s === "DECLINED" ? "gray" : "amber");

export default async function TrialsPage() {
  const user = await requireUser();
  const incoming = await db
    .select({ r: schema.trialRequests, horse: schema.horses, requester: schema.users })
    .from(schema.trialRequests)
    .innerJoin(schema.horses, eq(schema.horses.id, schema.trialRequests.horseId))
    .innerJoin(schema.users, eq(schema.users.id, schema.trialRequests.requesterId))
    .where(eq(schema.horses.ownerId, user.id))
    .orderBy(desc(schema.trialRequests.date));
  const mine = await db.query.trialRequests.findMany({ where: eq(schema.trialRequests.requesterId, user.id), with: { horse: true }, orderBy: desc(schema.trialRequests.date) });

  return (
    <div className="space-y-6">
      <PageHeader title="Trials" subtitle="Trial requests for your horses, and trials you have booked" />
      <Card title="Requests for my horses">
        {incoming.length === 0 ? (
          <Empty>No requests yet. Open trial slots on your horses&apos; pages.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>Horse</th><th>Rider</th><th>Date</th><th>Message</th><th>Status</th></tr></thead>
            <tbody>
              {incoming.map(({ r, horse, requester }) => (
                <tr key={r.id}>
                  <td><Link href={`/horses/${horse.id}`} className="link">{horse.name}</Link></td>
                  <td>{requester.name}</td>
                  <td>{fmtDateTime(r.date)}</td>
                  <td className="text-stone-600">{r.message}</td>
                  <td>
                    {r.status === "PENDING" ? (
                      <div className="flex gap-1">
                        <form action={decideTrial.bind(null, r.id, "APPROVED")}><button className="btn-primary btn-sm">Approve</button></form>
                        <form action={decideTrial.bind(null, r.id, "DECLINED")}><button className="btn-secondary btn-sm">Decline</button></form>
                      </div>
                    ) : (
                      <Badge tone={tone(r.status)}>{label(r.status)}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="My trial bookings">
        {mine.length === 0 ? (
          <Empty action={<Link href="/marketplace" className="btn-secondary btn-sm">Browse horses</Link>}>You have not booked any trials.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {mine.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <span><Link href={`/marketplace/${r.horseId}`} className="link">{r.horse.name}</Link> · {fmtDateTime(r.date)}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={tone(r.status)}>{label(r.status)}</Badge>
                  {r.status === "PENDING" && <form action={cancelTrial.bind(null, r.id)}><button className="text-xs text-red-600">Cancel</button></form>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
