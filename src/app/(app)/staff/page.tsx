import Link from "next/link";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { AiPanel } from "@/components/ai-panel";
import { ConfirmButton, SubmitButton } from "@/components/client";
import { AiTag, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { addDays, fmtDate, fmtTime, ymd } from "@/lib/utils";
import { addShift, addStaff, aiRotaAction, clockIn, clockOut, deleteShift, removeStaff } from "./actions";
import { DAYS, weekStart } from "./week";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { user, ownerId } = await requirePerm("staffRota");
  const offset = Number((await searchParams).week ?? 0);
  const ws = weekStart(offset);
  const staff = await db.query.staff.findMany({ where: eq(schema.staff.ownerId, ownerId), with: { timeEntries: true }, orderBy: asc(schema.staff.name) });
  const shifts = await db.query.shifts.findMany({
    where: and(eq(schema.shifts.ownerId, ownerId), gte(schema.shifts.start, ws), lt(schema.shifts.start, addDays(ws, 7))),
    orderBy: asc(schema.shifts.start),
  });

  const hoursThisWeek = (staffId: string) =>
    staff
      .find((s) => s.id === staffId)!
      .timeEntries.filter((e) => e.clockIn >= ws && e.clockIn < addDays(ws, 7))
      .reduce((sum, e) => sum + ((e.clockOut ?? new Date()).getTime() - e.clockIn.getTime()) / 3_600_000, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Staff & rota" subtitle="Weekly schedule, time clock and team" />

      <Card
        title={`Week of ${fmtDate(ws)}`}
        actions={
          <div className="flex gap-2 text-sm">
            <Link href={`/staff?week=${offset - 1}`} className="btn-secondary btn-sm">← Prev</Link>
            <Link href="/staff" className="btn-secondary btn-sm">This week</Link>
            <Link href={`/staff?week=${offset + 1}`} className="btn-secondary btn-sm">Next →</Link>
          </div>
        }
      >
        {staff.length === 0 ? <Empty>Add your team below to build a rota.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead>
                <tr><th>Staff</th>{DAYS.map((d, i) => <th key={d}>{d} {addDays(ws, i).getDate()}</th>)}</tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}<div className="text-xs font-normal text-stone-500">{s.role}</div></td>
                    {DAYS.map((d, i) => {
                      const dayShifts = shifts.filter((sh) => sh.staffId === s.id && sh.start >= addDays(ws, i) && sh.start < addDays(ws, i + 1));
                      return (
                        <td key={d}>
                          {dayShifts.map((sh) => (
                            <form key={sh.id} action={deleteShift.bind(null, sh.id)} className="mb-1">
                              <button className={`w-full rounded px-1.5 py-1 text-left text-xs ${sh.start.getHours() >= 12 ? "bg-indigo-100 text-indigo-800" : "bg-amber-100 text-amber-800"}`} title="Click to remove">
                                {fmtTime(sh.start)}-{fmtTime(sh.end)}
                              </button>
                            </form>
                          ))}
                          {dayShifts.length === 0 && <span className="text-xs text-stone-300">off</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {staff.length > 0 && (
          <form action={addShift} className="mt-4 flex flex-wrap items-end gap-2 text-sm">
            <select name="staffId" className="input w-auto">{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <input type="date" name="day" className="input w-auto" defaultValue={ymd(ws)} required />
            <input type="time" name="start" className="input w-auto" defaultValue="07:00" />
            <input type="time" name="end" className="input w-auto" defaultValue="15:00" />
            <SubmitButton className="btn-secondary btn-sm">Add shift</SubmitButton>
          </form>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Time clock">
          {staff.length === 0 ? <Empty>No staff yet.</Empty> : (
            <ul className="divide-y divide-stone-100">
              {staff.map((s) => {
                const open = s.timeEntries.find((e) => !e.clockOut);
                return (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <strong>{s.name}</strong> <span className="text-stone-500">· {hoursThisWeek(s.id).toFixed(1)} h this week</span>
                      {open && <><br /><Badge tone="green">On site since {fmtTime(open.clockIn)}</Badge></>}
                    </span>
                    {open ? (
                      <form action={clockOut.bind(null, s.id)}><button className="btn-secondary btn-sm">Clock out</button></form>
                    ) : (
                      <form action={clockIn.bind(null, s.id)}><button className="btn-primary btn-sm">Clock in</button></form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2">AI rota builder <AiTag /></span>}>
          <p className="mb-3 text-sm text-stone-500">Builds a fair week that covers early feeds and late checks, using each person&apos;s skills.</p>
          <AiPanel action={aiRotaAction} button="Suggest a rota">
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">For
                <select name="week" className="input w-auto" defaultValue="1"><option value="0">this week</option><option value="1">next week</option></select>
              </label>
              <label className="flex items-center gap-2"><input type="checkbox" name="apply" /> Replace that week&apos;s rota</label>
            </div>
            <input name="notes" className="input" placeholder="Notes, e.g. Youssef away Thursday, show on Friday" />
          </AiPanel>
        </Card>
      </div>

      <Card title="Team">
        <form action={addStaff} className="mb-4 grid gap-2 md:grid-cols-6">
          <input name="name" className="input md:col-span-1" placeholder="Name" required />
          <input name="role" className="input" placeholder="Role" />
          <input name="phone" className="input" placeholder="WhatsApp number" />
          <input name="skills" className="input md:col-span-2" placeholder="Skills (comma separated)" />
          <SubmitButton className="btn-primary">Add</SubmitButton>
        </form>
        <table className="table">
          <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Skills</th><th>Leave days</th><th></th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td><td>{s.role}</td><td>{s.phone ?? "—"}</td><td className="text-stone-600">{s.skills}</td><td>{s.vacationDays}</td>
                <td><form action={removeStaff.bind(null, s.id)}><ConfirmButton message={`Remove ${s.name}?`} className="text-xs text-red-600">Remove</ConfirmButton></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
