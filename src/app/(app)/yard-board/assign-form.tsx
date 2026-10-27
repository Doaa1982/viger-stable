"use client";

import { useActionState } from "react";
import { assignHorse } from "./actions";

export function AssignForm({ horses, stalls }: { horses: { id: string; name: string }[]; stalls: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(assignHorse, undefined);
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select name="horseId" className="input w-auto" defaultValue=""><option value="" disabled>Horse</option>{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
        <select name="stallId" className="input w-auto" defaultValue=""><option value="">— Unassign —</option>{stalls.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button className="btn-primary btn-sm" disabled={pending}>Move</button>
      </div>
      {state?.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">⛔ {state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
