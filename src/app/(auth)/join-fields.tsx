"use client";

/** Name / email / password fields shared by the invite and sign-up pages. */
export function JoinFields({ signedInAs, defaults }: { signedInAs?: string | null; defaults?: { name?: string | null; email?: string | null; phone?: string | null } }) {
  if (signedInAs) return <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">You are signed in as <strong>{signedInAs}</strong>. This will be added to your account.</p>;
  return (
    <div className="space-y-3">
      <label className="block"><span className="lbl">Full name</span><input name="name" className="input" defaultValue={defaults?.name ?? ""} required autoComplete="name" /></label>
      <label className="block"><span className="lbl">Email</span><input name="email" type="email" className="input" defaultValue={defaults?.email ?? ""} required autoComplete="email" /></label>
      <label className="block"><span className="lbl">Phone / WhatsApp</span><input name="phone" className="input" defaultValue={defaults?.phone ?? ""} placeholder="+20 100 123 4567" autoComplete="tel" /></label>
      <label className="block"><span className="lbl">Choose a password (min 8 characters)</span><input name="password" type="password" minLength={8} className="input" required autoComplete="new-password" /></label>
    </div>
  );
}
