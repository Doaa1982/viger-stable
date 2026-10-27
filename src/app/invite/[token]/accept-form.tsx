"use client";

import { useActionState } from "react";
import { acceptInvite } from "../../(auth)/member-actions";
import { JoinFields } from "../../(auth)/join-fields";

export function AcceptForm({ token, signedInAs, defaults }: { token: string; signedInAs: string | null; defaults: { name: string; email: string | null; phone: string | null } }) {
  const [state, action, pending] = useActionState(acceptInvite.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-4">
      <JoinFields signedInAs={signedInAs} defaults={defaults} />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Setting up…" : "Accept invite"}</button>
    </form>
  );
}
