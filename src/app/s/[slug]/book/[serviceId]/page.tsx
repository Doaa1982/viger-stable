import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingPage } from "../../data";
import { BookingForm } from "./booking-form";
import { PRICE_UNIT_LABEL, bookableDays, priceUsd } from "@/lib/booking";
import { addDays, egp, ymd } from "@/lib/utils";

export default async function BookServicePage({ params }: { params: Promise<{ slug: string; serviceId: string }> }) {
  const { slug, serviceId } = await params;
  const { settings, services } = await getBookingPage(slug);
  const service = services.find((s) => s.id === serviceId);
  if (!service) notFound();
  const days = bookableDays(settings, 1);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/s/${slug}`} className="link text-sm">← All services</Link>
      <div>
        <h1 className="text-2xl font-bold">{service.name}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {egp(service.priceEgp)} (≈ ${priceUsd(service, settings)}) {PRICE_UNIT_LABEL[service.priceUnit]}
          {service.durationMin ? ` · ${service.durationMin} min` : ""}
        </p>
        {service.description && <p className="mt-3 text-stone-700">{service.description}</p>}
      </div>
      <BookingForm
        slug={slug}
        service={{ id: service.id, name: service.name, category: service.category, priceEgp: service.priceEgp, priceUnit: service.priceUnit, maxGuests: service.maxGuests, minAge: service.minAge }}
        usdUnit={priceUsd(service, settings)}
        minDay={ymd(days[0] ?? new Date())}
        maxDay={ymd(addDays(new Date(), 365))}
        payOnArrival={settings.payOnArrival}
        payByTransfer={settings.payByTransfer}
      />
    </div>
  );
}
