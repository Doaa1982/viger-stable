import Link from "next/link";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { packageBalance } from "@/lib/riders";
import { SubmitButton } from "@/components/client";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { fmtDateTime, label, startOfDay } from "@/lib/utils";
import { addStudent } from "./actions";
import { StudentFields } from "./student-fields";

export default async function StudentsPage() {
  const { ownerId } = await requirePerm("students");
  const students = await db.query.students.findMany({
    where: eq(schema.students.ownerId, ownerId),
    with: { packages: true, lessons: true, coach: true },
    orderBy: asc(schema.students.name),
  });
  const coaches = await db.query.staff.findMany({ where: eq(schema.staff.ownerId, ownerId), orderBy: asc(schema.staff.name) });
  const ids = students.map((s) => s.id);
  const upcoming = ids.length
    ? (await db.query.lessons.findMany({ where: gte(schema.lessons.date, startOfDay()), with: { student: true, coach: true, horse: true }, orderBy: asc(schema.lessons.date) })).filter((l) => ids.includes(l.studentId) && l.status === "SCHEDULED").slice(0, 10)
    : [];
  const active = students.filter((s) => s.active);
  const lowBalance = active.filter((s) => {
    const left = s.packages.reduce((sum, p) => sum + (packageBalance(p, s.lessons).expired ? 0 : packageBalance(p, s.lessons).left), 0);
    return left <= 1;
  });
  const unpaid = students.flatMap((s) => s.packages.filter((p) => !p.paid));

  return (
    <div className="space-y-6">
      <PageHeader title="Riding school" subtitle="Students, lesson packages, attendance and progress" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Active students" value={active.length} />
        <Stat label="Lessons coming up" value={upcoming.length} />
        <Stat label="Low balance" value={lowBalance.length} hint="1 lesson or less left" tone={lowBalance.length ? "warn" : "default"} />
        <Stat label="Unpaid packages" value={unpaid.length} tone={unpaid.length ? "warn" : "good"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Students" className="lg:col-span-2">
          {students.length === 0 ? <Empty>No students yet - add your first below.</Empty> : (
            <table className="table">
              <thead><tr><th>Name</th><th>Level</th><th>Coach</th><th>Lessons left</th><th>Attended</th></tr></thead>
              <tbody>
                {students.map((s) => {
                  const left = s.packages.reduce((sum, p) => sum + (packageBalance(p, s.lessons).expired ? 0 : packageBalance(p, s.lessons).left), 0);
                  return (
                    <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                      <td><Link href={`/students/${s.id}`} className="link font-medium">{s.name}</Link>{s.guardianName && <div className="text-xs text-stone-500">Parent: {s.guardianName}</div>}</td>
                      <td>{label(s.level)}</td>
                      <td>{s.coach?.name ?? "—"}</td>
                      <td>{left <= 1 ? <Badge tone="red">{left}</Badge> : left}</td>
                      <td>{s.lessons.filter((l) => l.status === "ATTENDED").length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Coming up">
          {upcoming.length === 0 ? <Empty>No lessons scheduled.</Empty> : (
            <ul className="divide-y divide-stone-100 text-sm">
              {upcoming.map((l) => (
                <li key={l.id} className="py-2">
                  <div className="font-medium">{fmtDateTime(l.date)} · <Link href={`/students/${l.studentId}`} className="link">{l.student.name}</Link></div>
                  <div className="text-xs text-stone-500">{[l.focus, l.coach?.name && `coach ${l.coach.name}`, l.horse?.name && `on ${l.horse.name}`].filter(Boolean).join(" · ")}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Add a student">
        <form action={addStudent} className="space-y-3">
          <StudentFields coaches={coaches} />
          <SubmitButton>Add student</SubmitButton>
        </form>
        <p className="mt-3 text-xs text-stone-500">To give a student their own login, add them in <Link href="/team" className="link">People &amp; access</Link> as &quot;Riding student&quot; with the same name or phone.</p>
      </Card>
    </div>
  );
}
