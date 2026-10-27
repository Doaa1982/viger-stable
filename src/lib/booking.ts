import { and, eq, gte, lt, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, startOfDay, zonedWeekday } from "@/lib/utils";

export const SERVICE_CATEGORIES = ["RIDE", "LESSON", "CAMEL", "LIVERY"] as const;
export const CATEGORY_LABEL: Record<string, string> = {
  RIDE: "Horse rides & tours",
  LESSON: "Riding lessons",
  CAMEL: "Camel rides",
  LIVERY: "Livery & boarding",
};
export const PRICE_UNIT_LABEL: Record<string, string> = { PERSON: "per person", GROUP: "per group", MONTH: "per month" };
export const BOOKING_STATUSES = ["REQUESTED", "CONFIRMED", "PAID", "COMPLETED", "CANCELLED"] as const;

export function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40) || "stable"
  );
}

/** Short, easy-to-read booking reference, e.g. VS-7KQ2MD (no 0/O/1/I). */
export function newReference() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "VS-" + Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export type Service = typeof schema.services.$inferSelect;
export type BookingSettings = typeof schema.bookingSettings.$inferSelect;

export function priceUsd(service: Service, settings: BookingSettings) {
  return service.priceUsd ?? Math.round(service.priceEgp / (settings.usdRate || 50));
}

export function bookingTotal(service: Service, settings: BookingSettings, guests: number) {
  const multiplier = service.priceUnit === "PERSON" ? guests : 1;
  return { egp: service.priceEgp * multiplier, usd: priceUsd(service, settings) * multiplier };
}

export function timeSlots(settings: BookingSettings) {
  return settings.timeSlots
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{2}:\d{2}$/.test(s))
    .sort();
}

export function isClosedDay(settings: BookingSettings, day: Date) {
  const closed = (settings.closedDays ?? "").split(",").filter(Boolean).map(Number);
  return closed.includes(zonedWeekday(day));
}

/** Guests already booked for a service in one time slot (cancelled bookings don't count). */
export async function bookedGuests(serviceId: string, start: Date) {
  const rows = await db
    .select({ guests: schema.customerBookings.guests })
    .from(schema.customerBookings)
    .where(
      and(
        eq(schema.customerBookings.serviceId, serviceId),
        gte(schema.customerBookings.date, start),
        lt(schema.customerBookings.date, new Date(start.getTime() + 60_000)),
        ne(schema.customerBookings.status, "CANCELLED"),
      ),
    );
  return rows.reduce((s, r) => s + r.guests, 0);
}

/** Next 60 days the customer can pick (not closed days). */
export function bookableDays(settings: BookingSettings, count = 60) {
  const today = startOfDay();
  const days: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = startOfDay(addDays(today, i + 0.5));
    if (!isClosedDay(settings, d)) days.push(d);
  }
  return days;
}

/** Example services so a new stable has a working booking page straight away. All editable. */
export const EXAMPLE_SERVICES: Omit<typeof schema.services.$inferInsert, "ownerId">[] = [
  { name: "1-hour Pyramids horse ride", category: "RIDE", durationMin: 60, priceEgp: 900, priceUsd: 25, maxGuests: 8, minAge: 8, sortOrder: 1, description: "Ride through the desert with a view of the Giza Pyramids. Calm horses and an experienced guide - perfect for first-timers." },
  { name: "Sunset ride at the Pyramids", category: "RIDE", durationMin: 120, priceEgp: 1600, priceUsd: 45, maxGuests: 8, minAge: 10, sortOrder: 2, description: "Our most popular tour: two hours across the dunes, stopping for photos as the sun sets behind the Pyramids." },
  { name: "Beginner riding lesson", category: "LESSON", durationMin: 45, priceEgp: 700, priceUsd: 20, maxGuests: 1, minAge: 6, sortOrder: 3, description: "One-to-one lesson in the arena: mounting, walking, trotting and steering, on a kind schoolmaster." },
  { name: "Show jumping lesson", category: "LESSON", durationMin: 60, priceEgp: 1100, priceUsd: 30, maxGuests: 2, minAge: 10, sortOrder: 4, description: "For riders who already canter confidently. Gridwork and small courses with a national coach." },
  { name: "Desert camel ride (30 min)", category: "CAMEL", durationMin: 30, priceEgp: 500, priceUsd: 15, maxGuests: 10, minAge: 5, sortOrder: 5, description: "A short, gentle camel ride with great Pyramid photo stops. Suitable for all ages." },
  { name: "Horse & camel combo tour (3 hours)", category: "CAMEL", durationMin: 180, priceEgp: 2500, priceUsd: 70, maxGuests: 6, minAge: 12, sortOrder: 6, description: "Half a day in the desert: ride out on horseback, swap to camels at the panorama point, with mint tea at our Bedouin tent." },
  { name: "Full livery (monthly)", category: "LIVERY", durationMin: null, priceEgp: 12000, priceUsd: 250, priceUnit: "MONTH", maxGuests: 3, sortOrder: 7, description: "Stable box, feeding, daily turnout, mucking out and care by our grooms. Vet and farrier arranged on request." },
];

/** Create a booking page (settings + example services) for a stable owner if they don't have one. */
export async function ensureBookingPage(owner: { id: string; name: string; city?: string | null; phone?: string | null }) {
  const existing = await db.query.bookingSettings.findFirst({ where: eq(schema.bookingSettings.ownerId, owner.id) });
  if (existing) return existing;
  let slug = slugify(owner.name);
  if (await db.query.bookingSettings.findFirst({ where: eq(schema.bookingSettings.slug, slug) })) slug = `${slug}-${owner.id.slice(0, 4)}`;
  const [settings] = await db
    .insert(schema.bookingSettings)
    .values({
      ownerId: owner.id,
      slug,
      displayName: owner.name,
      tagline: "Horse & camel rides at the Giza Pyramids",
      about: "A family-run stable near the Pyramids. Well-cared-for horses, experienced guides and riding lessons for every level - from first-timers to show jumpers.",
      address: owner.city ? `${owner.city}, Egypt` : "Giza, Egypt",
      whatsapp: owner.phone ?? null,
      transferDetails: "InstaPay: (add your InstaPay address)\nBank: (add bank name, account name and IBAN)\nPlease send a screenshot of the transfer on WhatsApp with your booking reference.",
    })
    .returning();
  const hasServices = await db.query.services.findFirst({ where: eq(schema.services.ownerId, owner.id) });
  if (!hasServices) await db.insert(schema.services).values(EXAMPLE_SERVICES.map((s) => ({ ...s, ownerId: owner.id })));
  return settings;
}

export function whatsappLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}
