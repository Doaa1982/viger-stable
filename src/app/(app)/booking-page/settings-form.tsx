"use client";

import { useActionState } from "react";
import { saveSettings } from "./actions";

type S = {
  slug: string; displayName: string; tagline: string | null; about: string | null; address: string | null; mapUrl: string | null;
  whatsapp: string | null; email: string | null; timeSlots: string; closedDays: string | null; usdRate: number;
  payOnArrival: boolean; payByTransfer: boolean; transferDetails: string | null; isPublished: boolean;
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SettingsForm({ s }: { s: S }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  const closed = (s.closedDays ?? "").split(",").filter(Boolean).map(Number);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <label className="block"><span className="lbl">Stable name</span><input name="displayName" defaultValue={s.displayName} className="input" required /></label>
      <label className="block"><span className="lbl">Page address (/s/…)</span><input name="slug" defaultValue={s.slug} className="input" required /></label>
      <label className="block md:col-span-2"><span className="lbl">Tagline</span><input name="tagline" defaultValue={s.tagline ?? ""} className="input" /></label>
      <label className="block md:col-span-2"><span className="lbl">About the stable</span><textarea name="about" rows={3} defaultValue={s.about ?? ""} className="input" /></label>
      <label className="block"><span className="lbl">Address</span><input name="address" defaultValue={s.address ?? ""} className="input" /></label>
      <label className="block"><span className="lbl">Google Maps link</span><input name="mapUrl" defaultValue={s.mapUrl ?? ""} className="input" placeholder="https://maps.app.goo.gl/…" /></label>
      <label className="block"><span className="lbl">WhatsApp number (with +20)</span><input name="whatsapp" defaultValue={s.whatsapp ?? ""} className="input" placeholder="+20 100 123 4567" /></label>
      <label className="block"><span className="lbl">Email (new bookings are sent here)</span><input name="email" type="email" defaultValue={s.email ?? ""} className="input" /></label>
      <label className="block"><span className="lbl">Time slots (Egypt time, comma separated)</span><input name="timeSlots" defaultValue={s.timeSlots} className="input" /></label>
      <label className="block"><span className="lbl">USD rate (EGP per $1, used if a service has no USD price)</span><input name="usdRate" type="number" step="0.01" defaultValue={s.usdRate} className="input" /></label>
      <div className="md:col-span-2">
        <span className="lbl">Closed days</span>
        <div className="flex flex-wrap gap-3 text-sm">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1"><input type="checkbox" name={`closed-${i}`} defaultChecked={closed.includes(i)} /> {d}</label>
          ))}
        </div>
      </div>
      <div className="space-y-2 md:col-span-2">
        <span className="lbl">Payment methods</span>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="payOnArrival" defaultChecked={s.payOnArrival} /> Pay at the stable</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="payByTransfer" defaultChecked={s.payByTransfer} /> InstaPay / bank transfer</label>
      </div>
      <label className="block md:col-span-2"><span className="lbl">Transfer details shown to customers (InstaPay address, bank, IBAN)</span><textarea name="transferDetails" rows={4} defaultValue={s.transferDetails ?? ""} className="input font-mono text-xs" /></label>
      <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="isPublished" defaultChecked={s.isPublished} /> Booking page is online (untick to hide it)</label>
      <div className="flex items-center gap-3 md:col-span-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
