"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { register } from "../actions";

const roles = [
  { v: "STABLE", t: "Stable / yard", d: "Manage horses, staff and clients" },
  { v: "RIDER", t: "Rider / owner", d: "Your horses, training and competitions" },
  { v: "PROFESSIONAL", t: "Professional", d: "Vet, farrier, coach, groom, transporter" },
  { v: "FAN", t: "Fan", d: "Follow the sport, browse horses - free" },
];

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, undefined);
  const [role, setRole] = useState("STABLE");
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={action} className="card w-full max-w-lg space-y-4">
        <div className="text-center">
          <Link href="/" className="text-xl font-bold text-forest-700">🐎 Viger Stable</Link>
          <p className="mt-1 text-sm text-stone-500">Create your free account</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {roles.map((r) => (
            <label key={r.v} className={`cursor-pointer rounded-lg border p-3 text-sm ${role === r.v ? "border-forest-500 bg-emerald-50" : "border-stone-200"}`}>
              <input type="radio" name="role" value={r.v} checked={role === r.v} onChange={() => setRole(r.v)} className="sr-only" />
              <div className="font-medium">{r.t}</div>
              <div className="text-xs text-stone-500">{r.d}</div>
            </label>
          ))}
        </div>
        {role === "PROFESSIONAL" && (
          <label className="block">
            <span className="lbl">Trade</span>
            <select name="trade" className="input" required>
              {["VET", "FARRIER", "COACH", "GROOM", "TRANSPORTER", "BODYWORKER", "OTHER"].map((t) => (
                <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block"><span className="lbl">{role === "STABLE" ? "Stable name" : "Full name"}</span><input name="name" className="input" required /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="lbl">Email</span><input name="email" type="email" className="input" required /></label>
          <label className="block"><span className="lbl">City</span><input name="city" className="input" placeholder="Cairo" /></label>
        </div>
        <label className="block"><span className="lbl">Password (min 8 characters)</span><input name="password" type="password" className="input" minLength={8} required /></label>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating..." : "Create account"}</button>
        <p className="text-center text-sm text-stone-500">Already have an account? <Link href="/login" className="link">Sign in</Link></p>
      </form>
    </main>
  );
}
