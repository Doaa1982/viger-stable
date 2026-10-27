"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={action} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <Link href="/" className="text-xl font-bold text-forest-700">🐎 Viger Stable</Link>
          <p className="mt-1 text-sm text-stone-500">Sign in to your account</p>
        </div>
        <label className="block"><span className="lbl">Email</span><input name="email" type="email" className="input" defaultValue="demo@vigerstable.com" required /></label>
        <label className="block"><span className="lbl">Password</span><input name="password" type="password" className="input" defaultValue="password123" required /></label>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>
        <p className="text-center text-sm text-stone-500">New here? <Link href="/register" className="link">Create an account</Link></p>
      </form>
    </main>
  );
}
