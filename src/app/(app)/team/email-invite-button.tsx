"use client";

import { useActionState } from "react";
import { emailInviteAgain } from "./actions";

export function EmailInviteButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(emailInviteAgain.bind(null, id), undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <button className="btn-secondary btn-sm" disabled={pending}>{pending ? "Sending…" : "Email invite"}</button>
      {state?.ok && <span className="text-xs text-emerald-700">✓ {state.ok}</span>}
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
