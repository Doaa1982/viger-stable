import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { AiPanel } from "@/components/ai-panel";
import { SubmitButton } from "@/components/client";
import { AiTag, Card, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addConflict, addStall, aiTurnoutAction, deleteConflict, deleteStall } from "./actions";
import { AssignForm } from "./assign-form";

export default async function YardBoard() {
  const { user, ownerId } = await requirePerm("yard");
  const stalls = await db.query.stalls.findMany({ where: eq(schema.stalls.ownerId, ownerId), with: { horses: true }, orderBy: [asc(schema.stalls.building), asc(schema.stalls.name)] });
  const horses = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, ownerId), orderBy: asc(schema.horses.name) });
  const ids = horses.map((h) => h.id);
  const conflicts = ids.length ? await db.query.horseConflicts.findMany({ where: inArray(schema.horseConflicts.horseAId, ids), with: { horseA: true, horseB: true } }) : [];
  const unassigned = horses.filter((h) => !h.stallId);
  const buildings = [...new Set(stalls.map((s) => s.building))];
  const conflicted = new Set(conflicts.flatMap((c) => [c.horseAId, c.horseBId]));

  return (
    <div className="space-y-6">
      <PageHeader title="Yard board" subtitle="Who is where - stables and paddocks" />
      <Card title="Move a horse"><AssignForm horses={horses} stalls={stalls} /></Card>

      {buildings.map((b) => {
        const list = stalls.filter((s) => s.building === b);
        const used = list.reduce((n, s) => n + s.horses.length, 0);
        const cap = list.reduce((n, s) => n + s.capacity, 0);
        return (
          <Card key={b} title={`${b} · ${used}/${cap} places`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {list.map((s) => (
                <div key={s.id} className={cn("rounded-lg border p-3 text-sm", s.horses.length >= s.capacity ? "border-forest-500 bg-emerald-50" : "border-dashed border-stone-300")}>
                  <div className="flex justify-between text-xs text-stone-500">
                    <span>{s.name}</span>
                    <form action={deleteStall.bind(null, s.id)}><button className="hover:text-red-600" title="Delete">✕</button></form>
                  </div>
                  {s.horses.length === 0 ? <div className="mt-1 text-stone-300">Empty</div> : s.horses.map((h) => (
                    <div key={h.id} className="mt-1 font-medium">{h.name}{conflicted.has(h.id) && <span title="Has a pairing warning" className="ml-1 text-amber-600">⚠</span>}</div>
                  ))}
                  {s.capacity > 1 && <div className="mt-1 text-xs text-stone-400">{s.horses.length}/{s.capacity}</div>}
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {unassigned.length > 0 && <Card title="Not placed">{unassigned.map((h) => h.name).join(", ")}</Card>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Add stall or paddock">
          <form action={addStall} className="space-y-2">
            <input name="name" className="input" placeholder="Box 9 / Paddock B" required />
            <input name="building" className="input" placeholder="Building or area" />
            <div className="grid grid-cols-2 gap-2">
              <select name="kind" className="input"><option value="STALL">Stable box</option><option value="PADDOCK">Paddock</option></select>
              <input name="capacity" type="number" min={1} defaultValue={1} className="input" />
            </div>
            <SubmitButton className="btn-secondary">Add</SubmitButton>
          </form>
        </Card>
        <Card title="Horses that don't get on">
          <form action={addConflict} className="mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select name="horseA" className="input">{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <select name="horseB" className="input">{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
            </div>
            <input name="reason" className="input" placeholder="Reason" />
            <SubmitButton className="btn-secondary">Add warning</SubmitButton>
          </form>
          <ul className="space-y-1 text-sm">
            {conflicts.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span>⚠ {c.horseA.name} & {c.horseB.name}<span className="text-stone-500"> - {c.reason}</span></span>
                <form action={deleteConflict.bind(null, c.id)}><button className="text-xs text-stone-400">✕</button></form>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={<span className="flex items-center gap-2">Turnout groups <AiTag /></span>}>
          <p className="mb-3 text-sm text-stone-500">Suggests safe groups for turnout from sex, temperament and conflicts.</p>
          <AiPanel action={aiTurnoutAction} button="Suggest groups" />
        </Card>
      </div>
    </div>
  );
}
