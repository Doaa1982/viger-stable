import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { addDays, daysUntil, egp, fmtDate, label, startOfDay } from "@/lib/utils";
import { RecordForm } from "./record-form";
import { deleteHealthRecord } from "./actions";

export default async function HealthPage({ searchParams }: { searchParams: Promise<{ horse?: string }> }) {
  const { user, ownerId } = await requirePerm("yard");
  const { horse } = await searchParams;
  const today = startOfDay();
  const horses = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, ownerId), orderBy: asc(schema.horses.name) });
  const rows = await db
    .select({ r: schema.healthRecords, horseName: schema.horses.name })
    .from(schema.healthRecords)
    .innerJoin(schema.horses, eq(schema.horses.id, schema.healthRecords.horseId))
    .where(eq(schema.horses.ownerId, ownerId))
    .orderBy(desc(schema.healthRecords.date));
  const filtered = horse ? rows.filter((x) => x.r.horseId === horse) : rows;

  // Latest record per horse+type decides what is due
  const latest = new Map<string, (typeof rows)[number]>();
  for (const x of rows) {
    const k = `${x.r.horseId}:${x.r.type}`;
    if (!latest.has(k)) latest.set(k, x);
  }
  const due = [...latest.values()].filter((x) => x.r.nextDue && x.r.nextDue <= addDays(today, 30)).sort((a, b) => +a.r.nextDue! - +b.r.nextDue!);
  const overdue = due.filter((x) => x.r.nextDue! < today);
  const yearCost = rows.filter((x) => x.r.date >= addDays(today, -365)).reduce((s, x) => s + (x.r.cost ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Health Hub" subtitle="Every horse's care in one place" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "warn" : "good"} />
        <Stat label="Due in 30 days" value={due.length - overdue.length} />
        <Stat label="Records" value={rows.length} />
        <Stat label="Health spend (12 mo)" value={egp(yearCost)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Due and overdue">
            {due.length === 0 ? <Empty>Nothing due in the next 30 days.</Empty> : (
              <ul className="divide-y divide-stone-100 text-sm">
                {due.map(({ r, horseName }) => {
                  const n = daysUntil(r.nextDue!);
                  return (
                    <li key={r.id} className="flex items-center justify-between py-2">
                      <span><Link href={`/horses/${r.horseId}`} className="link">{horseName}</Link> · {label(r.type)}</span>
                      <Badge tone={n < 0 ? "red" : n <= 7 ? "amber" : "gray"}>{n < 0 ? `${-n} days overdue` : n === 0 ? "Today" : `in ${n} days`} · {fmtDate(r.nextDue)}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            title="Records"
            actions={
              <form className="flex gap-2">
                <select name="horse" defaultValue={horse ?? ""} className="input w-auto text-sm"><option value="">All horses</option>{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
                <button className="btn-secondary btn-sm">Filter</button>
              </form>
            }
          >
            {filtered.length === 0 ? <Empty>No records.</Empty> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Date</th><th>Horse</th><th>Type</th><th>Notes</th><th>Cost</th><th></th></tr></thead>
                  <tbody>
                    {filtered.slice(0, 100).map(({ r, horseName }) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td>{horseName}</td>
                        <td>{label(r.type)}{r.source !== "MANUAL" && <span className="ml-1 text-xs text-violet-600" title={label(r.source)}>✦</span>}</td>
                        <td className="text-stone-600">
                          {r.notes}{r.provider && <span className="text-stone-400"> · {r.provider}</span>}
                          {r.attachmentUrl && <> · <a href={r.attachmentUrl} target="_blank" className="link" rel="noreferrer">document</a></>}
                        </td>
                        <td>{egp(r.cost)}</td>
                        <td><form action={deleteHealthRecord.bind(null, r.id)}><button className="text-xs text-stone-400 hover:text-red-600">✕</button></form></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title="Add a record">
          {horses.length === 0 ? <Empty action={<Link href="/horses/new" className="btn-primary btn-sm">Add a horse</Link>}>Add a horse first.</Empty> : <RecordForm horses={horses} defaultHorse={horse} />}
          <p className="mt-4 text-xs text-stone-500">For an AI risk check, open a horse and use ✦ Health Early-Warning.</p>
        </Card>
      </div>
    </div>
  );
}
