"use client";

import { useActionState, useState } from "react";
import { selfJoin } from "../../../(auth)/member-actions";
import { JoinFields } from "../../../(auth)/join-fields";

const TYPES = [
  { v: "CUSTOMER", t: "I book rides & tours", d: "See your bookings, rebook easily and leave a review." },
  { v: "STUDENT", t: "I take riding lessons", d: "See your lessons, package balance and coach notes. The stable approves your account." },
  { v: "HORSE_OWNER", t: "My horse lives here", d: "See your horse's health, feeding and invoices. The stable approves your account." },
];

export function JoinForm({ slug, signedInAs, initialType }: { slug: string; signedInAs: string | null; initialType: string }) {
  const [state, action, pending] = useActionState(selfJoin.bind(null, slug), undefined);
  const [type, setType] = useState(TYPES.some((x) => x.v === initialType) ? initialType : "CUSTOMER");
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        {TYPES.map((x) => (
          <label key={x.v} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${type === x.v ? "border-forest-500 bg-emerald-50" : "border-stone-200 bg-white"}`}>
            <input type="radio" name="role" value={x.v} checked={type === x.v} onChange={() => setType(x.v)} className="mt-1" />
            <span><strong>{x.t}</strong><br /><span className="text-stone-500">{x.d}</span></span>
          </label>
        ))}
      </div>
      <JoinFields signedInAs={signedInAs} />
      {signedInAs && <label className="block"><span className="lbl">Phone / WhatsApp</span><input name="phone" className="input" placeholder="+20 100 123 4567" required /></label>}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating…" : "Create my account"}</button>
    </form>
  );
}
