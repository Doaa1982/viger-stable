import { asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { AiPanel } from "@/components/ai-panel";
import { SubmitButton } from "@/components/client";
import { AiTag, Card, Empty, PageHeader } from "@/components/ui";
import { daysUntil, fmtDate, label } from "@/lib/utils";
import { addBreeding, deleteBreeding, matingAdvisorAction, updateBreeding } from "./actions";

const COLUMNS = ["PLANNED", "COVERED", "IN_FOAL", "FOALED", "EMPTY"];

/** Simple inbreeding check: shared names in two generations. */
function sharedAncestors(a: { sire: string | null; dam: string | null; damSire: string | null; name: string }, b: { sire: string | null; dam: string | null; damSire: string | null; name: string } | undefined) {
  if (!b) return [];
  const A = [a.name, a.sire, a.dam, a.damSire].filter(Boolean);
  const B = [b.name, b.sire, b.dam, b.damSire].filter(Boolean);
  return [...new Set(A.filter((x) => B.includes(x)))];
}

export default async function BreedingPage() {
  const { user, ownerId } = await requirePerm("breeding");
  const mares = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, ownerId), orderBy: asc(schema.horses.name) }).then((h) => h.filter((x) => x.sex === "MARE"));
  const records = mares.length
    ? await db.query.breedingRecords.findMany({ where: inArray(schema.breedingRecords.mareId, mares.map((m) => m.id)), with: { mare: true }, orderBy: desc(schema.breedingRecords.createdAt) })
    : [];
  const stallions = await db.query.horses.findMany({ where: eq(schema.horses.sex, "STALLION") });

  return (
    <div className="space-y-6">
      <PageHeader title="Breeding centre" subtitle="Season board: every mare from plan to foal" />
      <div className="grid gap-4 overflow-x-auto md:grid-cols-5">
        {COLUMNS.map((col) => (
          <div key={col} className="min-w-[200px] rounded-xl bg-stone-100 p-3">
            <h3 className="mb-2 text-sm font-semibold">{label(col)}</h3>
            <div className="space-y-2">
              {records.filter((r) => r.status === col).map((r) => {
                const risk = sharedAncestors(r.mare, stallions.find((s) => s.name === r.stallionName));
                return (
                  <div key={r.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                    <div className="font-medium">{r.mare.name} × {r.stallionName}</div>
                    {r.coverDate && <div className="text-xs text-stone-500">Covered {fmtDate(r.coverDate)}</div>}
                    {r.expectedFoaling && r.status !== "FOALED" && r.status !== "EMPTY" && (
                      <div className="text-xs text-stone-500">Due {fmtDate(r.expectedFoaling)} ({daysUntil(r.expectedFoaling)} days)</div>
                    )}
                    {r.foaledAt && <div className="text-xs text-emerald-700">Foaled {fmtDate(r.foaledAt)}</div>}
                    {risk.length > 0 && <div className="mt-1 text-xs text-amber-700">⚠ Shared ancestor: {risk.join(", ")}</div>}
                    {r.notes && <div className="mt-1 text-xs text-stone-600">{r.notes}</div>}
                    {r.status !== "FOALED" && r.status !== "EMPTY" && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-forest-600">Update</summary>
                        <form action={updateBreeding.bind(null, r.id)} className="mt-2 space-y-1">
                          <select name="status" className="input text-xs" defaultValue={COLUMNS[COLUMNS.indexOf(r.status) + 1]}>
                            {COLUMNS.map((c) => <option key={c} value={c}>{label(c)}</option>)}
                          </select>
                          <input type="date" name="date" className="input text-xs" />
                          <input name="foalName" className="input text-xs" placeholder="Foal name (if foaled)" />
                          <select name="foalSex" className="input text-xs" defaultValue=""><option value="">Foal sex</option><option value="MARE">Filly</option><option value="STALLION">Colt</option></select>
                          <button className="btn-primary btn-sm w-full">Save</button>
                        </form>
                      </details>
                    )}
                    <form action={deleteBreeding.bind(null, r.id)} className="mt-1 text-right"><button className="text-[10px] text-stone-400 hover:text-red-600">remove</button></form>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Plan or record a cover">
          {mares.length === 0 ? <Empty>Add a mare to your horses first.</Empty> : (
            <form action={addBreeding} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select name="mareId" className="input">{mares.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                <input name="stallionName" list="stallions" className="input" placeholder="Stallion" required />
                <datalist id="stallions">{stallions.map((s) => <option key={s.id} value={s.name} />)}</datalist>
              </div>
              <label className="block"><span className="lbl">Cover date (leave empty if only planned)</span><input name="coverDate" type="date" className="input" /></label>
              <input name="notes" className="input" placeholder="Notes (AI, natural, fresh/frozen…)" />
              <SubmitButton>Save</SubmitButton>
              <p className="text-xs text-stone-500">Expected foaling is set automatically ({340} days). When a mare foals, the foal&apos;s profile is created with its pedigree.</p>
            </form>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2">Mating advisor <AiTag kind="added" /></span>}>
          <p className="mb-3 text-sm text-stone-500">Ranks stallions on the platform for your mare by pedigree, discipline and inbreeding risk.</p>
          {mares.length === 0 ? <Empty>No mares yet.</Empty> : (
            <AiPanel action={matingAdvisorAction} button="Find the best stallions">
              <select name="mareId" className="input">{mares.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              <input name="goal" className="input" placeholder="Goal, e.g. more size and bone, show quality Arabian" />
            </AiPanel>
          )}
        </Card>
      </div>
    </div>
  );
}
