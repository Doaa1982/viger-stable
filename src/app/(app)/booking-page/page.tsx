import Link from "next/link";
import { headers } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton, ConfirmButton } from "@/components/client";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { CATEGORY_LABEL, PRICE_UNIT_LABEL, SERVICE_CATEGORIES } from "@/lib/booking";
import { egp } from "@/lib/utils";
import { addService, createBookingPage, deleteService, updateService } from "./actions";
import { SettingsForm } from "./settings-form";

type Svc = typeof schema.services.$inferSelect;

function ServiceFields({ s }: { s?: Svc }) {
  return (
    <div className="grid gap-2 md:grid-cols-6">
      <input name="name" defaultValue={s?.name} placeholder="Service name" className="input md:col-span-3" required />
      <select name="category" defaultValue={s?.category ?? "RIDE"} className="input md:col-span-2">
        {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
      </select>
      <input name="sortOrder" type="number" defaultValue={s?.sortOrder ?? 0} className="input" title="Order on the page" />
      <textarea name="description" defaultValue={s?.description ?? ""} placeholder="Description customers will see" rows={2} className="input md:col-span-6" />
      <label className="md:col-span-1"><span className="lbl">Price EGP</span><input name="priceEgp" type="number" defaultValue={s?.priceEgp} className="input" required /></label>
      <label className="md:col-span-1"><span className="lbl">Price USD</span><input name="priceUsd" type="number" defaultValue={s?.priceUsd ?? ""} className="input" placeholder="auto" /></label>
      <label className="md:col-span-1"><span className="lbl">Per</span>
        <select name="priceUnit" defaultValue={s?.priceUnit ?? "PERSON"} className="input">{Object.entries(PRICE_UNIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v.replace("per ", "")}</option>)}</select>
      </label>
      <label className="md:col-span-1"><span className="lbl">Minutes</span><input name="durationMin" type="number" defaultValue={s?.durationMin ?? ""} className="input" /></label>
      <label className="md:col-span-1"><span className="lbl">Max per slot</span><input name="maxGuests" type="number" defaultValue={s?.maxGuests ?? 6} className="input" /></label>
      <label className="md:col-span-1"><span className="lbl">Min age</span><input name="minAge" type="number" defaultValue={s?.minAge ?? ""} className="input" /></label>
    </div>
  );
}

export default async function BookingPageAdmin() {
  const user = await requireUser();
  const settings = await db.query.bookingSettings.findFirst({ where: eq(schema.bookingSettings.ownerId, user.id) });
  if (!settings) {
    return (
      <div className="max-w-xl">
        <PageHeader title="Booking page" subtitle="Let customers book rides, lessons and livery online" />
        <Card>
          <p className="text-sm text-stone-600">Create a public page where Egyptians and visitors can book with you directly - no account needed. We&apos;ll add example services you can edit.</p>
          <form action={createBookingPage} className="mt-4"><SubmitButton>Create my booking page</SubmitButton></form>
        </Card>
      </div>
    );
  }
  const services = await db.query.services.findMany({ where: eq(schema.services.ownerId, user.id), orderBy: [asc(schema.services.sortOrder), asc(schema.services.name)] });
  const publicPath = `/s/${settings.slug}`;
  const host = (await headers()).get("host") ?? "viger-stable.vercel.app";
  const publicUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}${publicPath}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking page"
        subtitle="Your public page for customers - services, prices, times and payment"
        actions={<><Link href={publicPath} target="_blank" className="btn-primary">Open public page ↗</Link><Link href="/customer-bookings" className="btn-secondary">Customer bookings</Link></>}
      />
      <Card>
        <p className="text-sm">Share this link on Instagram, Google Maps and WhatsApp:</p>
        <p className="mt-1 break-all font-mono text-sm font-semibold text-forest-700">{publicUrl}</p>
        {!settings.isPublished && <p className="mt-2"><Badge tone="amber">Hidden - customers can&apos;t see it</Badge></p>}
      </Card>

      <Card title={`Services (${services.length})`}>
        {services.length === 0 && <Empty>No services yet - add one below.</Empty>}
        <div className="space-y-3">
          {services.map((s) => (
            <details key={s.id} className="rounded-lg border border-stone-200">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span><strong>{s.name}</strong> <span className="text-stone-500">· {CATEGORY_LABEL[s.category]}</span></span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{egp(s.priceEgp)}{s.priceUsd ? ` / $${s.priceUsd}` : ""} {PRICE_UNIT_LABEL[s.priceUnit]}</span>
                  {s.active ? <Badge tone="green">On</Badge> : <Badge>Hidden</Badge>}
                </span>
              </summary>
              <div className="border-t border-stone-100 p-4">
                <form action={updateService.bind(null, s.id)} className="space-y-3">
                  <ServiceFields s={s} />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={s.active} /> Show on booking page</label>
                    <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
                  </div>
                </form>
                <form action={deleteService.bind(null, s.id)} className="mt-2 text-right"><ConfirmButton message={`Delete "${s.name}"? Past bookings are kept.`} className="text-xs text-red-600">Delete service</ConfirmButton></form>
              </div>
            </details>
          ))}
        </div>
        <details className="mt-4 rounded-lg border border-dashed border-stone-300">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-forest-700">+ Add a service</summary>
          <form action={addService} className="space-y-3 border-t border-stone-100 p-4">
            <ServiceFields />
            <SubmitButton className="btn-primary btn-sm">Add service</SubmitButton>
          </form>
        </details>
      </Card>

      <Card title="Page settings"><SettingsForm s={settings} /></Card>
    </div>
  );
}
