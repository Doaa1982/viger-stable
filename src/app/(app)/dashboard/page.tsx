import Link from "next/link";
import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { AiPanel } from "@/components/ai-panel";
import { AiTag, Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { addDays, egp, fmtDate, fmtDateTime, fmtTime, label, startOfDay } from "@/lib/utils";
import { briefingAction } from "./actions";

export default async function Dashboard() {
  const user = await requireUser();
  const today = startOfDay();

  if (user.role === "PROFESSIONAL") return <ProDashboard userId={user.id} name={user.name} />;
  if (user.role === "FAN") return <FanDashboard name={user.name} />;

  const [horseCount] = await db.select({ n: sql<number>`count(*)` }).from(schema.horses).where(eq(schema.horses.ownerId, user.id));
  const todayTasks = await db.query.tasks.findMany({
    where: and(eq(schema.tasks.ownerId, user.id), gte(schema.tasks.dueAt, today), lt(schema.tasks.dueAt, addDays(today, 1))),
    with: { horse: true, staff: true },
    orderBy: [asc(schema.tasks.done), asc(schema.tasks.priority), asc(schema.tasks.dueAt)],
  });
  const overdue = await db.query.tasks.findMany({
    where: and(eq(schema.tasks.ownerId, user.id), eq(schema.tasks.done, false), lt(schema.tasks.dueAt, today)),
    with: { horse: true },
  });
  const healthDue = await db
    .select({ id: schema.healthRecords.id, horse: schema.horses.name, horseId: schema.horses.id, type: schema.healthRecords.type, nextDue: schema.healthRecords.nextDue })
    .from(schema.healthRecords)
    .innerJoin(schema.horses, eq(schema.horses.id, schema.healthRecords.horseId))
    .where(and(eq(schema.horses.ownerId, user.id), lte(schema.healthRecords.nextDue, addDays(today, 14))))
    .orderBy(asc(schema.healthRecords.nextDue));
  const pendingTrials = await db
    .select({ id: schema.trialRequests.id })
    .from(schema.trialRequests)
    .innerJoin(schema.horses, eq(schema.horses.id, schema.trialRequests.horseId))
    .where(and(eq(schema.horses.ownerId, user.id), eq(schema.trialRequests.status, "PENDING")));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const tx = await db.query.transactions.findMany({ where: and(eq(schema.transactions.ownerId, user.id), gte(schema.transactions.date, monthStart)) });
  const net = tx.reduce((s, t) => s + (t.kind === "INCOME" ? t.amount : -t.amount), 0);
  const upcomingBookings = await db.query.bookings.findMany({
    where: and(eq(schema.bookings.clientId, user.id), gte(schema.bookings.date, today)),
    with: { pro: true, horse: true },
    orderBy: asc(schema.bookings.date),
    limit: 4,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${user.name}`} subtitle={fmtDate(new Date())} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Horses" value={horseCount.n} />
        <Stat label="Tasks today" value={`${todayTasks.filter((t) => t.done).length}/${todayTasks.length}`} hint="done" />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "warn" : "good"} />
        <Stat label="Trial requests" value={pendingTrials.length} hint="waiting for you" />
        <Stat label="Net this month" value={egp(net)} tone={net >= 0 ? "good" : "warn"} />
      </div>

      <Card title={<span className="flex items-center gap-2">Daily briefing <AiTag /></span>}>
        <p className="mb-3 text-sm text-stone-500">The AI reads your tasks, health calendar, trials and rota and writes today&apos;s plan.</p>
        <AiPanel action={briefingAction} button="Write today's briefing" />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Today" actions={<Link href="/tasks" className="link text-sm">All tasks →</Link>}>
          {overdue.length > 0 && (
            <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <strong>{overdue.length} overdue:</strong> {overdue.map((t) => t.title).join(", ")}
            </div>
          )}
          {todayTasks.length === 0 ? (
            <Empty>No tasks today.</Empty>
          ) : (
            <ul className="divide-y divide-stone-100">
              {todayTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <span className={t.done ? "text-stone-400 line-through" : ""}>
                    {fmtTime(t.dueAt)} · {t.title}
                    {t.horse && <span className="text-stone-500"> · {t.horse.name}</span>}
                  </span>
                  <span className="text-xs text-stone-500">{t.staff?.name}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Health due (14 days)" actions={<Link href="/health" className="link text-sm">Health Hub →</Link>}>
          {healthDue.length === 0 ? (
            <Empty>Nothing due. 🎉</Empty>
          ) : (
            <ul className="divide-y divide-stone-100">
              {healthDue.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/horses/${h.horseId}`} className="link">{h.horse}</Link>
                  <span>{label(h.type)}</span>
                  {h.nextDue && h.nextDue < today ? <Badge tone="red">Overdue {fmtDate(h.nextDue)}</Badge> : <Badge tone="amber">{fmtDate(h.nextDue)}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Professional visits" actions={<Link href="/bookings" className="link text-sm">Bookings →</Link>}>
          {upcomingBookings.length === 0 ? (
            <Empty action={<Link href="/professionals" className="btn-secondary btn-sm">Find a vet or farrier</Link>}>No visits booked.</Empty>
          ) : (
            <ul className="divide-y divide-stone-100">
              {upcomingBookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{fmtDateTime(b.date)} · {b.service}{b.horse && ` · ${b.horse.name}`}</span>
                  <span className="text-stone-500">{b.pro.name}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Ask the AI Assistant" actions={<AiTag kind="added" />}>
          <p className="text-sm text-stone-600">Ask questions or report updates in plain words. For example:</p>
          <ul className="mt-2 space-y-1 text-sm text-stone-600">
            <li>“Which vaccinations are due this month?”</li>
            <li>“Layla&apos;s leg is swollen again - log it and remind Saeed to cold hose tomorrow at 10”</li>
            <li>“How much did we spend on feed this month?”</li>
          </ul>
          <Link href="/assistant" className="btn-ai mt-4">✦ Open assistant</Link>
        </Card>
      </div>
    </div>
  );
}

async function ProDashboard({ userId, name }: { userId: string; name: string }) {
  const bookings = await db.query.bookings.findMany({
    where: eq(schema.bookings.proId, userId),
    with: { client: true, horse: true },
    orderBy: asc(schema.bookings.date),
  });
  const pending = bookings.filter((b) => b.status === "PENDING");
  const upcoming = bookings.filter((b) => b.status === "CONFIRMED");
  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${name}`} subtitle="Your practice at a glance" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Requests" value={pending.length} hint="waiting for your reply" />
        <Stat label="Confirmed visits" value={upcoming.length} />
        <Stat label="Completed" value={bookings.filter((b) => b.status === "COMPLETED").length} />
      </div>
      <Card title="Upcoming" actions={<Link href="/bookings" className="link text-sm">Manage bookings →</Link>}>
        {bookings.length === 0 ? (
          <Empty>No bookings yet. Complete your profile so clients can find you.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {[...pending, ...upcoming].map((b) => (
              <li key={b.id} className="flex justify-between py-2">
                <span>{fmtDateTime(b.date)} · {b.service} · {b.client.name}{b.horse && ` (${b.horse.name})`}</span>
                <Badge tone={b.status === "PENDING" ? "amber" : "green"}>{label(b.status)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function FanDashboard({ name }: { name: string }) {
  const posts = await db.query.posts.findMany({ with: { author: true }, orderBy: desc(schema.posts.createdAt), limit: 5 });
  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${name}`} subtitle="Follow the sport you love" />
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/arena" className="card hover:border-forest-500"><h3 className="font-semibold">The Arena</h3><p className="text-sm text-stone-500">Latest from stables and riders</p></Link>
        <Link href="/marketplace" className="card hover:border-forest-500"><h3 className="font-semibold">Marketplace</h3><p className="text-sm text-stone-500">Browse horses and book trials</p></Link>
        <Link href="/jobs" className="card hover:border-forest-500"><h3 className="font-semibold">Jobs</h3><p className="text-sm text-stone-500">Work in the horse world</p></Link>
      </div>
      <Card title="Latest posts">
        <ul className="divide-y divide-stone-100 text-sm">
          {posts.map((p) => (
            <li key={p.id} className="py-2"><strong>{p.author.name}:</strong> {p.content}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
