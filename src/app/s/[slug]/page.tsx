import Link from "next/link";
import { getBookingPage } from "./data";
import { CATEGORY_LABEL, PRICE_UNIT_LABEL, SERVICE_CATEGORIES, priceUsd } from "@/lib/booking";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { egp } from "@/lib/utils";

function duration(min: number | null) {
  if (!min) return null;
  return min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`;
}

export default async function PublicStablePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { settings, services } = await getBookingPage(slug);
  const reviews = await db.query.reviews.findMany({
    where: and(eq(schema.reviews.ownerId, settings.ownerId), eq(schema.reviews.published, true)),
    orderBy: desc(schema.reviews.createdAt),
    limit: 6,
  });
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const groups = SERVICE_CATEGORIES.map((c) => ({ c, items: services.filter((s) => s.category === c) })).filter((g) => g.items.length);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-br from-forest-700 to-forest-500 p-8 text-white md:p-12">
        <h1 className="text-3xl font-extrabold text-white md:text-4xl">{settings.displayName}</h1>
        {settings.tagline && <p className="mt-2 text-lg text-emerald-50">{settings.tagline}</p>}
        {settings.about && <p className="mt-4 max-w-2xl text-sm text-emerald-50/90">{settings.about}</p>}
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          {settings.address && <span className="rounded-full bg-white/15 px-3 py-1">📍 {settings.address}</span>}
          {settings.mapUrl && <a href={settings.mapUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white/15 px-3 py-1 hover:bg-white/25">Open in Google Maps</a>}
          <span className="rounded-full bg-white/15 px-3 py-1">Prices in EGP · USD shown for visitors</span>
        </div>
      </section>

      {groups.length === 0 && <p className="text-center text-stone-500">No services are open for booking right now. Please contact us on WhatsApp.</p>}

      {groups.map(({ c, items }) => (
        <section key={c}>
          <h2 className="mb-4 text-xl font-bold">{CATEGORY_LABEL[c]}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((s) => (
              <div key={s.id} className="card flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold">{s.name}</h3>
                  <div className="text-right">
                    <div className="text-lg font-bold text-forest-700">{egp(s.priceEgp)}</div>
                    <div className="text-xs text-stone-500">≈ ${priceUsd(s, settings)} · {PRICE_UNIT_LABEL[s.priceUnit]}</div>
                  </div>
                </div>
                {s.description && <p className="mt-2 text-sm text-stone-600">{s.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
                  {duration(s.durationMin) && <span className="rounded bg-stone-100 px-2 py-0.5">⏱ {duration(s.durationMin)}</span>}
                  {s.minAge && <span className="rounded bg-stone-100 px-2 py-0.5">Age {s.minAge}+</span>}
                  {s.category !== "LIVERY" && <span className="rounded bg-stone-100 px-2 py-0.5">Up to {s.maxGuests} per time slot</span>}
                </div>
                <div className="mt-4 flex-1" />
                <Link href={`/s/${slug}/book/${s.id}`} className="btn-primary self-start">
                  {s.category === "LIVERY" ? "Request a place" : "Book now"}
                </Link>
              </div>
            ))}
          </div>
        </section>
      ))}

      {reviews.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">What riders say <span className="text-base font-normal text-amber-500">{"★".repeat(Math.round(avg))}</span> <span className="text-sm font-normal text-stone-500">{avg.toFixed(1)} from {reviews.length} review{reviews.length === 1 ? "" : "s"}</span></h2>
          <div className="grid gap-4 md:grid-cols-3">
            {reviews.map((r) => (
              <figure key={r.id} className="card">
                <div className="text-amber-500">{"★".repeat(r.rating)}<span className="text-stone-300">{"★".repeat(5 - r.rating)}</span></div>
                {r.comment && <blockquote className="mt-2 text-sm text-stone-700">&ldquo;{r.comment}&rdquo;</blockquote>}
                <figcaption className="mt-3 text-xs text-stone-500">{r.authorName.split(" ")[0]}{r.country && ` · ${r.country}`}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
