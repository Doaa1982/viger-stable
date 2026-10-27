import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { AiPanel } from "@/components/ai-panel";
import { SubmitButton } from "@/components/client";
import { AiTag, Card, Empty, PageHeader } from "@/components/ui";
import { aiFeedAction, saveFeedPlan } from "./actions";

export default async function FeedingPage({ searchParams }: { searchParams: Promise<{ horse?: string }> }) {
  const user = await requireUser();
  const { horse: selectedId } = await searchParams;
  const horses = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, user.id), with: { feedPlans: true, stall: true }, orderBy: asc(schema.horses.name) });
  const board = horses.map((h) => ({ h, plan: h.feedPlans.find((p) => p.active) }));
  const selected = horses.find((h) => h.id === selectedId) ?? horses[0];
  const plan = selected?.feedPlans.find((p) => p.active);

  return (
    <div className="space-y-6">
      <PageHeader title="Feeding" subtitle="Feed board for the grooms, and plans per horse" />
      <Card title="Feed board">
        {board.length === 0 ? <Empty>No horses yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Horse</th><th>Morning</th><th>Midday</th><th>Evening</th><th>Supplements</th></tr></thead>
              <tbody>
                {board.map(({ h, plan }) => (
                  <tr key={h.id}>
                    <td className="font-medium"><Link href={`/feeding?horse=${h.id}`} className="link">{h.name}</Link><div className="text-xs font-normal text-stone-500">{h.stall?.name}</div></td>
                    <td>{plan?.morning ?? <span className="text-stone-300">—</span>}</td>
                    <td>{plan?.midday ?? <span className="text-stone-300">—</span>}</td>
                    <td>{plan?.evening ?? <span className="text-stone-300">—</span>}</td>
                    <td className="text-stone-600">{plan?.supplements}{plan?.aiGenerated && <span className="ml-1 text-xs text-violet-600">✦</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title={`Plan for ${selected.name}`}
            actions={
              <form className="flex gap-2">
                <select name="horse" defaultValue={selected.id} className="input w-auto text-sm">{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
                <button className="btn-secondary btn-sm">Open</button>
              </form>
            }
          >
            <form action={saveFeedPlan} key={plan?.id ?? selected.id} className="space-y-3">
              <input type="hidden" name="horseId" value={selected.id} />
              <label className="block"><span className="lbl">Plan name</span><input name="name" className="input" defaultValue={plan?.name ?? "Standard"} /></label>
              <label className="block"><span className="lbl">Morning</span><input name="morning" className="input" placeholder="e.g. 4 kg berseem hay + 1.5 kg cubes" defaultValue={plan?.morning ?? ""} /></label>
              <label className="block"><span className="lbl">Midday</span><input name="midday" className="input" defaultValue={plan?.midday ?? ""} /></label>
              <label className="block"><span className="lbl">Evening</span><input name="evening" className="input" defaultValue={plan?.evening ?? ""} /></label>
              <label className="block"><span className="lbl">Supplements</span><input name="supplements" className="input" defaultValue={plan?.supplements ?? ""} /></label>
              <label className="block"><span className="lbl">Notes</span><textarea name="notes" rows={2} className="input" defaultValue={plan?.notes ?? ""} /></label>
              <SubmitButton>Save plan</SubmitButton>
            </form>
          </Card>
          <Card title={<span className="flex items-center gap-2">AI feeding plan <AiTag /></span>}>
            <p className="mb-3 text-sm text-stone-500">
              Uses {selected.name}&apos;s weight ({selected.weightKg ?? "unknown"} kg), work and the Egyptian season, with feeds you can buy locally.
            </p>
            <AiPanel action={aiFeedAction} button="Create plan" hidden={{ horseId: selected.id }}>
              <div className="grid grid-cols-2 gap-2">
                <select name="workload" className="input" defaultValue="Moderate">
                  {["Rest", "Light", "Moderate", "Heavy / competition", "Breeding / pregnant", "Growing youngster"].map((w) => <option key={w}>{w}</option>)}
                </select>
                <input name="goal" className="input" placeholder="Goal, e.g. gain topline" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="apply" /> Save as active plan</label>
            </AiPanel>
          </Card>
        </div>
      )}
    </div>
  );
}
