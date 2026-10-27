import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/client";
import { Badge, Card, Empty, PageHeader, Tabs } from "@/components/ui";
import { addDays, cn, fmtDateTime, label, startOfDay } from "@/lib/utils";
import { createTask, deleteTask, toggleTask } from "./actions";

const CATS = ["CARE", "HEALTH", "TRAINING", "TRIAL", "OTHER"];
const VIEWS = [
  { v: "today", t: "Today" },
  { v: "upcoming", t: "Next 7 days" },
  { v: "overdue", t: "Overdue" },
  { v: "done", t: "Done" },
];

function waLink(phone: string | null, text: string) {
  if (!phone) return null;
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string; cat?: string }> }) {
  const user = await requireUser();
  const { view = "today", cat } = await searchParams;
  const today = startOfDay();
  const base = eq(schema.tasks.ownerId, user.id);
  const where =
    view === "today"
      ? and(base, gte(schema.tasks.dueAt, today), lt(schema.tasks.dueAt, addDays(today, 1)))
      : view === "upcoming"
        ? and(base, eq(schema.tasks.done, false), gte(schema.tasks.dueAt, today), lt(schema.tasks.dueAt, addDays(today, 8)))
        : view === "overdue"
          ? and(base, eq(schema.tasks.done, false), lt(schema.tasks.dueAt, today))
          : and(base, eq(schema.tasks.done, true));
  let tasks = await db.query.tasks.findMany({
    where,
    with: { horse: true, staff: true },
    orderBy: view === "done" ? desc(schema.tasks.doneAt) : [asc(schema.tasks.done), asc(schema.tasks.priority), asc(schema.tasks.dueAt)],
    limit: 200,
  });
  if (cat) tasks = tasks.filter((t) => t.category === cat);
  const [horses, staff] = await Promise.all([
    db.query.horses.findMany({ where: eq(schema.horses.ownerId, user.id), orderBy: asc(schema.horses.name) }),
    db.query.staff.findMany({ where: eq(schema.staff.ownerId, user.id), orderBy: asc(schema.staff.name) }),
  ]);
  const q = (v: string, c?: string) => `/tasks?view=${v}${c ? `&cat=${c}` : ""}`;

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Your yard's daily plan" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs active={q(view, cat)} items={VIEWS.map((v) => ({ href: q(v.v, cat), label: v.t }))} />
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <a href={q(view)} className={cn("badge", !cat ? "bg-forest-600 text-white" : "bg-stone-100")}>All</a>
            {CATS.map((c) => <a key={c} href={q(view, c)} className={cn("badge", cat === c ? "bg-forest-600 text-white" : "bg-stone-100")}>{label(c)}</a>)}
          </div>
          <Card>
            {tasks.length === 0 ? <Empty>Nothing here.</Empty> : (
              <ul className="divide-y divide-stone-100">
                {tasks.map((t) => {
                  const overdue = !t.done && t.dueAt < today;
                  const wa = waLink(t.staff?.phone ?? null, `Hi ${t.staff?.name}, reminder: ${t.title}${t.horse ? ` (${t.horse.name})` : ""} - ${fmtDateTime(t.dueAt)}`);
                  return (
                    <li key={t.id} className="flex items-start gap-3 py-3">
                      <form action={toggleTask.bind(null, t.id)}>
                        <button className={cn("mt-0.5 h-5 w-5 rounded border", t.done ? "border-forest-600 bg-forest-600 text-white" : "border-stone-300")} title="Mark done">{t.done ? "✓" : ""}</button>
                      </form>
                      <div className="min-w-0 flex-1">
                        <div className={cn("text-sm font-medium", t.done && "text-stone-400 line-through", overdue && "text-red-600")}>{t.title}</div>
                        <div className="text-xs text-stone-500">
                          {fmtDateTime(t.dueAt)} · {label(t.category)}{t.horse && ` · ${t.horse.name}`}{t.staff && ` · ${t.staff.name}`}
                        </div>
                      </div>
                      {t.priority === 1 && !t.done && <Badge tone="red">High</Badge>}
                      {wa && !t.done && <a href={wa} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 hover:underline">WhatsApp</a>}
                      <form action={deleteTask.bind(null, t.id)}><button className="text-xs text-stone-400 hover:text-red-600">✕</button></form>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
        <Card title="New task">
          <form action={createTask} className="space-y-3">
            <input name="title" className="input" placeholder="e.g. Turn out mares" required />
            <input name="dueAt" type="datetime-local" className="input" required />
            <div className="grid grid-cols-2 gap-2">
              <select name="category" className="input">{CATS.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
              <select name="priority" className="input" defaultValue="2"><option value="1">High</option><option value="2">Normal</option><option value="3">Low</option></select>
              <select name="horseId" className="input" defaultValue=""><option value="">No horse</option>{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <select name="staffId" className="input" defaultValue=""><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label><span className="lbl">Repeat every (days)</span><input name="repeatDays" type="number" min={0} defaultValue={0} className="input" /></label>
              <label><span className="lbl">Times</span><input name="repeatCount" type="number" min={1} defaultValue={7} className="input" /></label>
            </div>
            <SubmitButton>Add task</SubmitButton>
          </form>
          <p className="mt-4 text-xs text-stone-500">Tip: tell the ✦ AI Assistant &quot;remind Saeed to cold hose Layla tomorrow at 10&quot; and it creates the task for you.</p>
        </Card>
      </div>
    </div>
  );
}
