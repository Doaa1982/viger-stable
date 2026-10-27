import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { getAccess, isStaffRole, ROLE_LABEL, type Access } from "@/lib/access";
import { myCustomerBookings, myStaffId } from "@/lib/portal";
import { LESSON_STATUS_TONE, packageBalance } from "@/lib/riders";
import { SubmitButton } from "@/components/client";
import { Badge, Card, Empty, PageHeader, Stars, Stat } from "@/components/ui";
import { addDays, egp, fmtDate, fmtDateTime, fmtTime, label, startOfDay } from "@/lib/utils";
import { finishMyTask, leaveReview, myClockIn, myClockOut } from "./actions";

const BOOKING_TONE: Record<string, "blue" | "green" | "red" | "gray" | "amber" | "violet"> = { REQUESTED: "amber", CONFIRMED: "blue", PAID: "green", COMPLETED: "violet", CANCELLED: "gray" };

export default async function MyPage() {
  const a = await getAccess();
  if (a.role === "OWNER") redirect("/dashboard");
  const first = a.user.name.split(" ")[0];

  // Signed up but the stable hasn't approved them yet
  if (!a.membership) {
    const pending = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.userId, a.user.id), eq(schema.memberships.status, "PENDING")) });
    const disabled = !pending && (await db.query.memberships.findFirst({ where: and(eq(schema.memberships.userId, a.user.id), eq(schema.memberships.status, "DISABLED")) }));
    return (
      <div className="space-y-6">
        <PageHeader title={`Welcome, ${first}`} />
        <Card>
          {pending ? (
            <p className="text-sm">Thanks for joining as <b>{ROLE_LABEL[pending.role]}</b>. The stable needs to approve your account - you&apos;ll see your {pending.role === "STUDENT" ? "lessons and coach notes" : "horses, health records and invoices"} here once they do.</p>
          ) : disabled ? (
            <p className="text-sm">Your access to this stable has been paused. Please contact the stable.</p>
          ) : (
            <p className="text-sm">Your account isn&apos;t linked to a stable yet. Use the invite link the stable sent you, or join from their booking page.</p>
          )}
        </Card>
      </div>
    );
  }

  const subtitle = `${a.stableName} · ${ROLE_LABEL[a.role]}`;
  if (isStaffRole(a.role)) return <StaffPortal a={a} first={first} subtitle={subtitle} />;
  if (a.role === "STUDENT") return <StudentPortal a={a} first={first} subtitle={subtitle} />;
  if (a.role === "HORSE_OWNER") return <OwnerPortal a={a} first={first} subtitle={subtitle} />;
  return <CustomerPortal a={a} first={first} subtitle={subtitle} />;
}

type P = { a: Access; first: string; subtitle: string };

async function bookingLink(ownerId: string) {
  const s = await db.query.bookingSettings.findFirst({ where: eq(schema.bookingSettings.ownerId, ownerId) });
  return s ? `/s/${s.slug}` : null;
}

// ─────────────── Customer ───────────────

async function CustomerPortal({ a, first, subtitle }: P) {
  const bookings = await myCustomerBookings(a);
  const reviewed = new Set(
    bookings.length ? (await db.query.reviews.findMany({ where: inArray(schema.reviews.bookingId, bookings.map((b) => b.id)) })).map((r) => r.bookingId) : [],
  );
  const link = await bookingLink(a.ownerId);
  const now = new Date();
  const upcoming = bookings.filter((b) => b.date >= startOfDay() && b.status !== "CANCELLED" && b.status !== "COMPLETED");
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${first}`} subtitle={subtitle} actions={link && <Link href={link} className="btn-primary">Book again</Link>} />
      <Card title="Upcoming">
        {upcoming.length === 0 ? <Empty action={link && <Link href={link} className="btn-secondary">See rides & lessons</Link>}>No upcoming bookings.</Empty> : (
          <ul className="space-y-3">
            {upcoming.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 p-3 text-sm">
                <div>
                  <div className="font-medium">{b.serviceName}</div>
                  <div className="text-xs text-stone-500">{fmtDateTime(b.date)} · {b.guests} {b.guests === 1 ? "person" : "people"} · {egp(b.totalEgp)} · {b.paymentMethod === "TRANSFER" ? "InstaPay / transfer" : "Pay at the stable"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={BOOKING_TONE[b.status]}>{label(b.status)}</Badge>
                  {link && <Link href={`${link}/booking/${b.reference}`} className="link text-xs">{b.reference}</Link>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-stone-500">Bookings show here when you book with the same phone number or email as your account.</p>
      </Card>
      <Card title="Past visits">
        {past.length === 0 ? <Empty>Nothing yet.</Empty> : (
          <ul className="space-y-3">
            {past.map((b) => (
              <li key={b.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><span className="font-medium">{b.serviceName}</span> <span className="text-xs text-stone-500">· {fmtDate(b.date)}</span></div>
                  <Badge tone={BOOKING_TONE[b.status]}>{label(b.status)}</Badge>
                </div>
                {b.status === "COMPLETED" && !reviewed.has(b.id) && b.date <= now && (
                  <form action={leaveReview.bind(null, b.id)} className="mt-3 grid gap-2 md:grid-cols-[120px_1fr_auto]">
                    <select name="rating" defaultValue={5} className="input">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select>
                    <input name="comment" maxLength={1000} placeholder="How was your ride? (shown on the stable's page)" className="input" />
                    <SubmitButton className="btn-secondary">Post review</SubmitButton>
                  </form>
                )}
                {reviewed.has(b.id) && <div className="mt-1 text-xs text-emerald-700">Thanks for your review!</div>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ─────────────── Riding student ───────────────

async function StudentPortal({ a, first, subtitle }: P) {
  const st = a.membership?.studentId
    ? await db.query.students.findFirst({
        where: and(eq(schema.students.id, a.membership.studentId), eq(schema.students.ownerId, a.ownerId)),
        with: { coach: true, packages: { orderBy: desc(schema.lessonPackages.purchasedAt) }, lessons: { with: { coach: true, horse: true }, orderBy: desc(schema.lessons.date) } },
      })
    : null;
  if (!st) return <div className="space-y-6"><PageHeader title={`Hello, ${first}`} subtitle={subtitle} /><Card><Empty>Your rider profile isn&apos;t set up yet - please ask the stable.</Empty></Card></div>;
  const left = st.packages.reduce((s, p) => { const b = packageBalance(p, st.lessons); return s + (b.expired ? 0 : b.left); }, 0);
  const upcoming = st.lessons.filter((l) => l.status === "SCHEDULED" && l.date >= startOfDay()).reverse();
  const done = st.lessons.filter((l) => l.status !== "SCHEDULED");
  const attended = st.lessons.filter((l) => l.status === "ATTENDED").length;

  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${first}`} subtitle={subtitle} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Level" value={label(st.level)} />
        <Stat label="Lessons left" value={left} tone={left <= 1 ? "warn" : "good"} hint={left <= 1 ? "Ask the stable for a new package" : undefined} />
        <Stat label="Lessons ridden" value={attended} />
        <Stat label="Coach" value={st.coach?.name ?? "—"} />
      </div>
      {st.goals && <Card title="My goals"><p className="text-sm">{st.goals}</p></Card>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Next lessons">
          {upcoming.length === 0 ? <Empty>No lessons booked - contact the stable to book.</Empty> : (
            <ul className="divide-y divide-stone-100 text-sm">
              {upcoming.map((l) => (
                <li key={l.id} className="py-2">
                  <div className="font-medium">{fmtDateTime(l.date)} · {l.durationMin} min</div>
                  <div className="text-xs text-stone-500">{[l.focus, l.coach?.name && `with ${l.coach.name}`, l.horse?.name && `on ${l.horse.name}`].filter(Boolean).join(" · ")}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="My packages">
          {st.packages.length === 0 ? <Empty>No packages yet.</Empty> : (
            <ul className="space-y-2 text-sm">
              {st.packages.map((p) => { const b = packageBalance(p, st.lessons); return (
                <li key={p.id} className="flex items-center justify-between rounded-xl border border-stone-200 p-3">
                  <div><div className="font-medium">{p.name}</div><div className="text-xs text-stone-500">{b.used}/{p.lessonsTotal} used{p.expiresAt && ` · ${b.expired ? "expired" : "valid until"} ${fmtDate(p.expiresAt)}`}</div></div>
                  <div className="text-right"><div className="font-semibold">{b.left} left</div>{!p.paid && <Badge tone="amber">Payment due {egp(p.priceEgp)}</Badge>}</div>
                </li>
              ); })}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Coach notes">
        {done.length === 0 ? <Empty>Your coach&apos;s notes appear here after each lesson.</Empty> : (
          <ul className="space-y-3">
            {done.map((l) => (
              <li key={l.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{fmtDate(l.date)}</span>
                  <Badge tone={LESSON_STATUS_TONE[l.status] ?? "gray"}>{label(l.status)}</Badge>
                  {l.focus && <span className="text-stone-500">{l.focus}</span>}
                  {l.rating ? <Stars n={l.rating} /> : null}
                </div>
                {l.coachNotes && <p className="mt-1 text-stone-700">{l.coachNotes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ─────────────── Horse owner (livery) ───────────────

async function OwnerPortal({ a, first, subtitle }: P) {
  const clientId = a.membership?.clientId;
  const horses = clientId
    ? await db.query.horses.findMany({
        where: and(eq(schema.horses.clientId, clientId), eq(schema.horses.ownerId, a.ownerId)),
        with: { healthRecords: { orderBy: desc(schema.healthRecords.date) }, feedPlans: true },
        orderBy: asc(schema.horses.name),
      })
    : [];
  const invoices = clientId
    ? await db.query.invoices.findMany({ where: and(eq(schema.invoices.clientId, clientId), eq(schema.invoices.ownerId, a.ownerId)), orderBy: desc(schema.invoices.issuedAt) })
    : [];
  const visible = invoices.filter((i) => i.status !== "DRAFT");
  const due = visible.filter((i) => i.status !== "PAID").reduce((s, i) => s + i.total, 0);
  const soon = addDays(new Date(), 30);

  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${first}`} subtitle={subtitle} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="My horses" value={horses.length} />
        <Stat label="Health checks due (30 days)" value={horses.flatMap((h) => h.healthRecords).filter((r) => r.nextDue && r.nextDue <= soon).length} />
        <Stat label="Balance due" value={egp(due)} tone={due ? "warn" : "good"} />
      </div>
      {horses.length === 0 && <Card><Empty>No horses linked to your account yet - please ask the stable.</Empty></Card>}
      {horses.map((h) => {
        const plan = h.feedPlans.find((f) => f.active);
        const dueItems = h.healthRecords.filter((r) => r.nextDue).sort((x, y) => x.nextDue!.getTime() - y.nextDue!.getTime());
        const nextByType = [...new Map(dueItems.map((r) => [r.type, r])).values()].slice(0, 4);
        return (
          <Card key={h.id} title={<span>{h.name} <span className="text-sm font-normal text-stone-500">{[h.breed, h.color, h.birthYear && `born ${h.birthYear}`].filter(Boolean).join(" · ")}</span></span>}>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <div className="mb-2 text-sm font-semibold">Coming up</div>
                {nextByType.length === 0 ? <p className="text-sm text-stone-500">Nothing scheduled.</p> : (
                  <ul className="space-y-1 text-sm">{nextByType.map((r) => <li key={r.id}>{label(r.type)} · <span className={r.nextDue! < new Date() ? "text-red-600" : ""}>{fmtDate(r.nextDue)}</span></li>)}</ul>
                )}
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold">Recent care</div>
                {h.healthRecords.length === 0 ? <p className="text-sm text-stone-500">No records yet.</p> : (
                  <ul className="space-y-1 text-sm">{h.healthRecords.slice(0, 5).map((r) => <li key={r.id}>{fmtDate(r.date)} · {label(r.type)}{r.provider && <span className="text-stone-500"> · {r.provider}</span>}</li>)}</ul>
                )}
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold">Feeding</div>
                {!plan ? <p className="text-sm text-stone-500">Standard yard feed.</p> : (
                  <ul className="space-y-1 text-sm">
                    {plan.morning && <li><b>Morning:</b> {plan.morning}</li>}
                    {plan.midday && <li><b>Midday:</b> {plan.midday}</li>}
                    {plan.evening && <li><b>Evening:</b> {plan.evening}</li>}
                    {plan.supplements && <li><b>Supplements:</b> {plan.supplements}</li>}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        );
      })}
      <Card title="Invoices">
        {visible.length === 0 ? <Empty>No invoices yet.</Empty> : (
          <table className="table">
            <thead><tr><th>Number</th><th>Issued</th><th>Due</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{visible.map((i) => (
              <tr key={i.id}><td>{i.number}</td><td>{fmtDate(i.issuedAt)}</td><td>{fmtDate(i.dueAt)}</td><td>{egp(i.total)}</td><td><Badge tone={i.status === "PAID" ? "green" : i.status === "OVERDUE" ? "red" : "amber"}>{label(i.status)}</Badge></td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ─────────────── Staff (manager, coach, groom, staff rider) ───────────────

async function StaffPortal({ a, first, subtitle }: P) {
  const staffId = await myStaffId(a);
  if (!staffId) return <div className="space-y-6"><PageHeader title={`Hello, ${first}`} subtitle={subtitle} /><Card><Empty>Your staff profile isn&apos;t linked yet - please ask the owner.</Empty></Card></div>;
  const today = startOfDay();
  const [shifts, tasks, open, week] = await Promise.all([
    db.query.shifts.findMany({ where: and(eq(schema.shifts.staffId, staffId), gte(schema.shifts.end, new Date()), lt(schema.shifts.start, addDays(today, 7))), orderBy: asc(schema.shifts.start) }),
    db.query.tasks.findMany({ where: and(eq(schema.tasks.ownerId, a.ownerId), eq(schema.tasks.staffId, staffId), eq(schema.tasks.done, false), lt(schema.tasks.dueAt, addDays(today, 2))), with: { horse: true }, orderBy: asc(schema.tasks.dueAt) }),
    db.query.timeEntries.findFirst({ where: and(eq(schema.timeEntries.staffId, staffId), isNull(schema.timeEntries.clockOut)) }),
    db.query.timeEntries.findMany({ where: and(eq(schema.timeEntries.staffId, staffId), gte(schema.timeEntries.clockIn, addDays(today, -6))) }),
  ]);
  const hours = week.reduce((s, e) => s + ((e.clockOut ?? new Date()).getTime() - e.clockIn.getTime()) / 3_600_000, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${first}`} subtitle={subtitle} actions={a.can("yard") && <Link href="/dashboard" className="btn-secondary">Yard dashboard</Link>} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <div className="text-sm text-stone-500">Time clock</div>
          <div className="mt-1 text-lg font-semibold">{open ? `Clocked in since ${fmtTime(open.clockIn)}` : "Not clocked in"}</div>
          <form action={open ? myClockOut : myClockIn} className="mt-3"><SubmitButton className={open ? "btn-secondary" : "btn-primary"}>{open ? "Clock out" : "Clock in"}</SubmitButton></form>
        </Card>
        <Stat label="Hours (last 7 days)" value={hours.toFixed(1)} />
        <Stat label="My open tasks" value={tasks.length} tone={tasks.some((t) => t.dueAt < new Date()) ? "warn" : "default"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="My tasks (today & tomorrow)">
          {tasks.length === 0 ? <Empty>All done - nice work!</Empty> : (
            <ul className="divide-y divide-stone-100">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className={`text-xs ${t.dueAt < new Date() ? "text-red-600" : "text-stone-500"}`}>{fmtDateTime(t.dueAt)}{t.horse && ` · ${t.horse.name}`} · {label(t.category)}</div>
                  </div>
                  <form action={finishMyTask.bind(null, t.id)}><SubmitButton className="btn-secondary btn-sm">Done</SubmitButton></form>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="My shifts (next 7 days)">
          {shifts.length === 0 ? <Empty>No shifts on the rota.</Empty> : (
            <ul className="divide-y divide-stone-100 text-sm">
              {shifts.map((s) => <li key={s.id} className="py-2"><span className="font-medium">{fmtDate(s.start)}</span> · {fmtTime(s.start)}–{fmtTime(s.end)}{s.note && <span className="text-stone-500"> · {s.note}</span>}</li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
