"use client";

import { useActionState, useState } from "react";
import { addStall } from "./actions";

export function AddStallForm({ stables }: { stables: string[] }) {
  const [state, action, pending] = useActionState(addStall, undefined);
  const [kind, setKind] = useState("STALL");
  const [stable, setStable] = useState(stables[0] ?? "__new");
  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2 text-sm">
        {[["STALL", "Boxes in a stable"], ["PADDOCK", "Paddock"]].map(([v, l]) => (
          <label key={v} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center ${kind === v ? "border-forest-500 bg-emerald-50 font-medium" : "border-stone-200"}`}>
            <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="sr-only" />{l}
          </label>
        ))}
      </div>
      {kind === "STALL" ? (
        <>
          <label className="block"><span className="lbl">Stable</span>
            <select name="stable" value={stable} onChange={(e) => setStable(e.target.value)} className="input">
              {stables.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="__new">+ New stable…</option>
            </select>
          </label>
          {stable === "__new" && <label className="block"><span className="lbl">New stable name</span><input name="newStable" className="input" placeholder={`Stable ${stables.length + 1}`} defaultValue={`Stable ${stables.length + 1}`} /></label>}
          <label className="block"><span className="lbl">Box numbers</span><input name="boxes" className="input" placeholder="1,2,3 or 1-6" required /></label>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 block"><span className="lbl">Paddock name</span><input name="paddockName" className="input" placeholder="Paddock B" /></label>
          <label className="block"><span className="lbl">Horses</span><input name="capacity" type="number" min={1} defaultValue={3} className="input" /></label>
        </div>
      )}
      <button className="btn-secondary" disabled={pending}>{pending ? "Adding..." : "Add"}</button>
      {state?.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
