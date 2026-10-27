"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createCustomerBooking, getAvailability, type Availability } from "../../actions";

type Props = {
  slug: string;
  service: { id: string; name: string; category: string; priceEgp: number; priceUnit: string; maxGuests: number; minAge: number | null };
  usdUnit: number;
  minDay: string;
  maxDay: string;
  payOnArrival: boolean;
  payByTransfer: boolean;
};

const fmt = (n: number) => new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(n);

export function BookingForm({ slug, service, usdUnit, minDay, maxDay, payOnArrival, payByTransfer }: Props) {
  const isLivery = service.category === "LIVERY";
  const [state, action, pending] = useActionState(createCustomerBooking.bind(null, slug, service.id), undefined);
  const f = state?.fields ?? {};
  const [day, setDay] = useState(f.day ?? "");
  const [time, setTime] = useState(f.time ?? "");
  const [guests, setGuests] = useState(Number(f.guests ?? 1));
  const [avail, setAvail] = useState<Availability | null>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    if (!day || isLivery) return;
    startLoading(async () => {
      const a = await getAvailability(slug, service.id, day);
      setAvail(a);
      if (time && !a.slots.find((s) => s.time === time && !s.past && s.remaining >= guests)) setTime("");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const mult = service.priceUnit === "PERSON" ? guests : 1;
  const maxForSlot = avail?.slots.find((s) => s.time === time)?.remaining ?? service.maxGuests;

  return (
    <form action={action} className="space-y-5">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <fieldset className="card space-y-4">
        <legend className="px-1 text-sm font-semibold">1. {isLivery ? "Start date" : "Date & time"}</legend>
        <label className="block">
          <span className="lbl">{isLivery ? "When would you like to start?" : "Date"}</span>
          <input type="date" name="day" required min={minDay} max={maxDay} value={day} onChange={(e) => setDay(e.target.value)} className="input max-w-xs" />
        </label>
        {!isLivery && day && (
          <div>
            <span className="lbl">Time (Egypt time)</span>
            {loading && <p className="text-sm text-stone-500">Checking availability…</p>}
            {!loading && avail?.closed && <p className="text-sm text-red-600">We are closed on this day. Please choose another date.</p>}
            {!loading && avail && !avail.closed && (
              <div className="flex flex-wrap gap-2">
                {avail.slots.map((s) => {
                  const disabled = s.past || s.remaining === 0;
                  return (
                    <label key={s.time} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${time === s.time ? "border-forest-600 bg-emerald-50 font-medium" : "border-stone-300 bg-white"} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}>
                      <input type="radio" name="time" value={s.time} className="sr-only" disabled={disabled} checked={time === s.time} onChange={() => setTime(s.time)} />
                      {s.time}
                      <span className="ml-1 text-xs text-stone-500">{s.past ? "" : s.remaining === 0 ? "full" : `${s.remaining} left`}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <label className="block">
          <span className="lbl">{isLivery ? "Number of horses" : service.priceUnit === "GROUP" ? "Group size" : "Number of riders"}</span>
          <input type="number" name="guests" min={1} max={Math.max(1, maxForSlot)} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} className="input w-28" />
          {service.minAge && <span className="ml-3 text-xs text-stone-500">Minimum age {service.minAge}</span>}
        </label>
      </fieldset>

      <fieldset className="card grid gap-4 md:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">2. Your details</legend>
        <label className="block"><span className="lbl">Full name *</span><input name="name" required defaultValue={f.name} className="input" autoComplete="name" /></label>
        <label className="block"><span className="lbl">Phone / WhatsApp (with country code) *</span><input name="phone" required defaultValue={f.phone} className="input" placeholder="+20 100 123 4567" autoComplete="tel" inputMode="tel" /></label>
        <label className="block"><span className="lbl">Email (we send your confirmation here)</span><input name="email" type="email" defaultValue={f.email} className="input" autoComplete="email" /></label>
        <label className="block"><span className="lbl">Country</span><input name="country" defaultValue={f.country} className="input" autoComplete="country-name" placeholder="e.g. Egypt, Germany" /></label>
        {!isLivery && (
          <label className="block">
            <span className="lbl">Riding experience</span>
            <select name="experience" defaultValue={f.experience ?? "NONE"} className="input">
              <option value="NONE">Never ridden / beginner</option>
              <option value="SOME">Ridden a few times</option>
              <option value="CONFIDENT">Confident (can trot and canter)</option>
            </select>
          </label>
        )}
        <label className="block md:col-span-2"><span className="lbl">{isLivery ? "About your horse (breed, age, any special needs)" : "Anything we should know? (ages of children, special requests)"}</span><textarea name="notes" rows={3} defaultValue={f.notes} className="input" /></label>
      </fieldset>

      <fieldset className="card space-y-3">
        <legend className="px-1 text-sm font-semibold">3. Payment</legend>
        {payOnArrival && (
          <label className="flex items-start gap-3 rounded-lg border border-stone-200 p-3 text-sm">
            <input type="radio" name="payment" value="ARRIVAL" defaultChecked={f.payment !== "TRANSFER"} className="mt-1" />
            <span><strong>Pay at the stable</strong><br /><span className="text-stone-500">Cash or card when you arrive. We confirm your booking on WhatsApp.</span></span>
          </label>
        )}
        {payByTransfer && (
          <label className="flex items-start gap-3 rounded-lg border border-stone-200 p-3 text-sm">
            <input type="radio" name="payment" value="TRANSFER" defaultChecked={f.payment === "TRANSFER" || !payOnArrival} className="mt-1" />
            <span><strong>Pay now by InstaPay / bank transfer</strong><br /><span className="text-stone-500">You&apos;ll see the payment details after booking.</span></span>
          </label>
        )}
        <div className="flex items-end justify-between border-t border-stone-100 pt-3">
          <span className="text-sm text-stone-500">Total{mult > 1 ? ` (${mult} × ${fmt(service.priceEgp)} EGP)` : ""}</span>
          <span className="text-right">
            <span className="block text-2xl font-bold text-forest-700">{fmt(service.priceEgp * mult)} EGP</span>
            <span className="text-xs text-stone-500">≈ ${fmt(usdUnit * mult)}{isLivery ? " per month" : ""}</span>
          </span>
        </div>
      </fieldset>

      {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full py-3 text-base" disabled={pending || (!isLivery && !time)}>
        {pending ? "Sending…" : isLivery ? "Send request" : time ? `Book ${service.name} - ${day} ${time}` : "Choose a date and time"}
      </button>
      <p className="text-center text-xs text-stone-500">No payment is taken now unless you choose bank transfer. You can cancel free of charge on WhatsApp.</p>
    </form>
  );
}
