"use client";

import { useActionState } from "react";
import { addPerson } from "./actions";

const OPTIONS: [string, string, string][] = [
  ["MANAGER", "Yard manager", "Runs the yard and customer bookings. No prices, finance or team."],
  ["COACH", "Coach", "Riding school students and lessons, horses, tasks."],
  ["GROOM", "Groom", "Tasks, feeding, health logs, yard board, own shifts and clock-in."],
  ["STAFF_RIDER", "Staff rider", "Like a groom, for riders who work the horses."],
  ["STUDENT", "Riding student", "Sees own lessons, package balance and progress."],
  ["HORSE_OWNER", "Horse owner (livery)", "Sees own horse's health, feeding and invoices."],
  ["CUSTOMER", "Customer", "Sees own bookings and can rebook and leave a review."],
];

export function AddPersonForm() {
  const [state, action, pending] = useActionState(addPerson, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <input name="name" className="input" placeholder="Full name" required />
        <input name="phone" className="input" placeholder="WhatsApp, e.g. +20 100 123 4567" />
        <input name="email" type="email" className="input" placeholder="Email (optional - we email the invite)" />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {OPTIONS.map(([v, t, d]) => (
          <label key={v} className="flex cursor-pointer items-start gap-2 rounded-lg border border-stone-200 p-2 text-sm has-[:checked]:border-forest-500 has-[:checked]:bg-emerald-50">
            <input type="radio" name="role" value={v} className="mt-1" required />
            <span><strong>{t}</strong><br /><span className="text-xs text-stone-500">{d}</span></span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add & create invite"}</button>
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
