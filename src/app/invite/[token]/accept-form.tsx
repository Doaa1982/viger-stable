"use client";

import { useActionState } from "react";
import { acceptInvite } from "../../(auth)/member-actions";
import { JoinFields } from "../../(auth)/join-fields";

export function AcceptForm({ token, signedInAs, ownerNote, defaults }: { token: string; signedInAs: string | null; ownerNote: boolean; defaults: { name: string; email: string | null; phone: string | null } }) {
  const [state, action, pending] = useActionState(acceptInvite.bind(null, token), undefined);
  if (state?.ok) return <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">✓ {state.ok} <a href="/team" className="link">Back to People &amp; access</a></p>;
  return (
    <form action={action} className="space-y-4">
      <JoinFields signedInAs={signedInAs} ownerNote={ownerNote} defaults={defaults} />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Setting up…" : "Accept invite"}</button>
    </form>
  );
}
