import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { LESSON_STATUS_TONE, packageBalance } from "@/lib/riders";
import { AiPanel } from "@/components/ai-panel";
import { SubmitButton } from "@/components/client";
import { AiTag, Badge, Card, Empty, PageHeader, Stars, Stat } from "@/components/ui";
import { egp, fmtDate, fmtDateTime, label, ymdhm } from "@/lib/utils";
import { addPackage, markPackagePaid, progressReportAction, recordLesson, scheduleLesson, updateStudent } from "../actions";
import { StudentFields } from "../student-fields";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ownerId } = await requirePerm("students");
  const st = await db.query.students.findFirst({
    where: and(eq(schema.students.id, id), eq(schema.students.ownerId, ownerId)),
    with: { coach: true, packages: { orderBy: desc(schema.lessonPackages.purchasedAt) }, lessons: { with: { coach: true, horse: true }, orderBy: desc(schema.lessons.date) } },
  });
  if (!st) notFound();
  const coaches = await db.query.staff.findMany({ where: eq(schema.staff.ownerId, ownerId), orderBy: asc(schema.staff.name) });
  const horses = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, ownerId), orderBy: asc(schema.horses.name) });
  const login = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.studentId, st.id), eq(schema.memberships.ownerId, ownerId)) });

  const balances = st.packages.map((p) => ({ p, ...packageBalance(p, st.lessons) }));
  const left = balances.reduce((s, b) => s + (b.expired ? 0 : b.left), 0);
  const attended = st.lessons.filter((l) => l.status === "ATTENDED");
  const rated = attended.filter((l) => l.rating);
  const avg = rated.length ? rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length : null;
  const next = new Date(Date.now() + 86400000);
  next.setMinutes(0, 0, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={st.name}
        subtitle={[label(st.level), st.coach && `Coach ${st.coach.name}`, st.guardianName && `Parent ${st.guardianName}`, !st.active && "Inactive"].filter(Boolean).join(" · ")}
        actions={<Link href="/students" className="btn-secondary">All students</Link>}
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Lessons left" value={left} tone={left <= 1 ? "warn" : "good"} />
        <Stat label="Attended" value={attended.length} />
        <Stat label="No-shows" value={st.lessons.filter((l) => l.status === "NO_SHOW").length} />
        <Stat label="Average rating" value={avg ? avg.toFixed(1) + " / 5" : "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Lessons">
            {st.lessons.length === 0 ? <Empty>No lessons yet - schedule one on the right.</Empty> : (
              <ul className="space-y-3">
                {st.lessons.map((l) => (
                  <li key={l.id} className="rounded-xl border border-stone-200 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{fmtDateTime(l.date)}</span>
                      <Badge tone={LESSON_STATUS_TONE[l.status] ?? "gray"}>{label(l.status)}</Badge>
                      <span className="text-stone-500">{[l.focus, `${l.durationMin} min`, l.coach?.name && `coach ${l.coach.name}`, l.horse?.name && `on ${l.horse.name}`].filter(Boolean).join(" · ")}</span>
                      {l.rating ? <Stars n={l.rating} /> : null}
                    </div>
                    <details className="mt-2" open={l.status === "SCHEDULED" && l.date < new Date()}>
                      <summary className="cursor-pointer text-xs text-stone-500">{l.coachNotes ? `Notes: ${l.coachNotes}` : "Record attendance & notes"}</summary>
                      <form action={recordLesson.bind(null, st.id, l.id)} className="mt-2 grid gap-2 md:grid-cols-4">
                        <select name="status" defaultValue={l.status === "SCHEDULED" ? "ATTENDED" : l.status} className="input">
                          {["ATTENDED", "NO_SHOW", "CANCELLED", "SCHEDULED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                        </select>
                        <input name="focus" defaultValue={l.focus ?? ""} placeholder="Focus" className="input" />
                        <select name="rating" defaultValue={l.rating ?? ""} className="input">
                          <option value="">Rating</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
                        </select>
                        <SubmitButton className="btn-secondary">Save</SubmitButton>
                        <textarea name="coachNotes" rows={2} defaultValue={l.coachNotes ?? ""} placeholder="What went well, what to work on next" className="input md:col-span-4" />
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={<span className="flex items-center gap-2">Progress report <AiTag kind="added" /></span>}>
            <p className="mb-3 text-sm text-stone-600">AI writes a friendly progress report from the coach notes and ratings - ready to send to the rider or their parents on WhatsApp.</p>
            <AiPanel action={progressReportAction} button="Write progress report" hidden={{ studentId: st.id }} />
          </Card>
          <Card title="Profile">
            <form action={updateStudent.bind(null, st.id)} className="space-y-3">
              <StudentFields s={st} coaches={coaches} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={st.active} /> Active student</label>
              <SubmitButton>Save profile</SubmitButton>
            </form>
            <p className="mt-3 text-xs text-stone-500">
              {login ? <>Has a login ({label(login.status)}) - manage it in <Link href="/team" className="link">People &amp; access</Link>.</> : <>No login yet. Invite them from <Link href="/team" className="link">People &amp; access</Link> as &quot;Riding student&quot; so they can see their lessons and notes.</>}
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Schedule a lesson">
            <form action={scheduleLesson.bind(null, st.id)} className="space-y-3">
              <label className="block"><span className="lbl">Date & time</span><input type="datetime-local" name="date" defaultValue={ymdhm(next)} className="input" required /></label>
              <label className="block"><span className="lbl">Length (min)</span><input type="number" name="durationMin" defaultValue={45} className="input" /></label>
              <label className="block"><span className="lbl">Coach</span>
                <select name="coachStaffId" defaultValue={st.coachStaffId ?? ""} className="input"><option value="">-</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </label>
              <label className="block"><span className="lbl">Horse</span>
                <select name="horseId" className="input"><option value="">-</option>{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              </label>
              <label className="block"><span className="lbl">Focus</span><input name="focus" className="input" placeholder="e.g. rising trot, first canter" /></label>
              <SubmitButton>Schedule</SubmitButton>
              <p className="text-xs text-stone-500">Uses a lesson from an open package and adds it to the coach&apos;s tasks.</p>
            </form>
          </Card>
          <Card title="Lesson packages">
            {balances.length === 0 ? <Empty>No packages yet.</Empty> : (
              <ul className="space-y-2 text-sm">
                {balances.map(({ p, used, left, expired }) => (
                  <li key={p.id} className="rounded-xl border border-stone-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.paid ? <Badge tone="green">Paid</Badge> : <Badge tone="amber">Unpaid</Badge>}
                    </div>
                    <div className="text-xs text-stone-500">{egp(p.priceEgp)} · {used}/{p.lessonsTotal} used · {left} left{p.expiresAt && ` · ${expired ? "expired" : "expires"} ${fmtDate(p.expiresAt)}`}</div>
                    {!p.paid && (
                      <form action={markPackagePaid.bind(null, st.id, p.id)} className="mt-2"><SubmitButton className="btn-secondary btn-sm">Mark paid</SubmitButton></form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <form action={addPackage.bind(null, st.id)} className="mt-4 space-y-2 border-t border-stone-100 pt-4">
              <div className="text-sm font-medium">New package</div>
              <input name="name" placeholder="e.g. 10-lesson card" className="input" />
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="lbl">Lessons</span><input name="lessonsTotal" type="number" defaultValue={10} className="input" /></label>
                <label className="block"><span className="lbl">Price (EGP)</span><input name="priceEgp" type="number" defaultValue={6000} className="input" /></label>
              </div>
              <label className="block"><span className="lbl">Valid for (days, optional)</span><input name="validDays" type="number" placeholder="e.g. 90" className="input" /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="paid" /> Paid now</label>
              <SubmitButton className="btn-secondary">Add package</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
