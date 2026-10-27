"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { bookedGuests, bookingTotal, isClosedDay, newReference, timeSlots } from "@/lib/booking";
import { addDays, num, startOfDay, str, zonedDate } from "@/lib/utils";

async function load(slug: string, serviceId: string) {
  const settings = await db.query.bookingSettings.findFirst({ where: eq(schema.bookingSettings.slug, slug) });
  if (!settings || !settings.isPublished) throw new Error("This booking page is not available.");
  const service = await db.query.services.findFirst({
    where: and(eq(schema.services.id, serviceId), eq(schema.services.ownerId, settings.ownerId), eq(schema.services.active, true)),
  });
  if (!service) throw new Error("This service is not available.");
  return { settings, service };
}

export type Availability = { closed: boolean; slots: { time: string; remaining: number; past: boolean }[] };

/** Free places per time slot for one day (public, no login). */
export async function getAvailability(slug: string, serviceId: string, day: string): Promise<Availability> {
  const { settings, service } = await load(slug, serviceId);
  const date = zonedDate(day);
  if (!date) return { closed: true, slots: [] };
  if (isClosedDay(settings, date)) return { closed: true, slots: [] };
  const now = Date.now();
  const slots = await Promise.all(
    timeSlots(settings).map(async (time) => {
      const start = zonedDate(`${day}T${time}`)!;
      const remaining = Math.max(0, service.maxGuests - (await bookedGuests(service.id, start)));
      return { time, remaining, past: start.getTime() < now + 60 * 60_000 }; // at least 1 hour notice
    }),
  );
  return { closed: false, slots };
}

export type BookingState = { error?: string; fields?: Record<string, string> } | undefined;

export async function createCustomerBooking(slug: string, serviceId: string, _prev: BookingState, fd: FormData): Promise<BookingState> {
  const fields = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const fail = (error: string): BookingState => ({ error, fields });
  // Hidden field that real people leave empty - simple protection against spam bots
  if (str(fd, "website")) return fail("Something went wrong. Please try again.");

  let ctx;
  try {
    ctx = await load(slug, serviceId);
  } catch (e) {
    return fail((e as Error).message);
  }
  const { settings, service } = ctx;
  const isLivery = service.category === "LIVERY";

  const name = str(fd, "name");
  const phone = str(fd, "phone");
  const email = str(fd, "email");
  const day = str(fd, "day");
  const time = isLivery ? "09:00" : str(fd, "time");
  const guests = Math.max(1, Math.min(num(fd, "guests") ?? 1, service.maxGuests));
  const payment = str(fd, "payment") === "TRANSFER" ? "TRANSFER" : "ARRIVAL";

  if (!name || name.length < 2) return fail("Please enter your name.");
  if (!phone || phone.replace(/\D/g, "").length < 8) return fail("Please enter a phone / WhatsApp number with country code, e.g. +20 100 123 4567.");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return fail("Please check your email address.");
  if (!day) return fail("Please choose a date.");
  if (!time) return fail("Please choose a time.");
  if (payment === "ARRIVAL" && !settings.payOnArrival) return fail("Please choose a payment method.");
  if (payment === "TRANSFER" && !settings.payByTransfer) return fail("Please choose a payment method.");

  const start = zonedDate(`${day}T${time}`);
  if (!start) return fail("Please choose a valid date.");
  if (start < startOfDay()) return fail("Please choose a date in the future.");
  if (start > addDays(new Date(), 366)) return fail("Bookings can be made up to one year ahead.");
  if (isClosedDay(settings, start)) return fail("We are closed on that day. Please choose another date.");
  if (!isLivery) {
    if (!timeSlots(settings).includes(time)) return fail("Please choose one of the available times.");
    if (start.getTime() < Date.now() + 60 * 60_000) return fail("That time is too soon. Please choose a later time.");
    const remaining = service.maxGuests - (await bookedGuests(service.id, start));
    if (guests > remaining) return fail(remaining > 0 ? `Only ${remaining} place(s) left at ${time}. Please reduce the number or pick another time.` : `${time} is fully booked. Please pick another time.`);
  }

  const total = bookingTotal(service, settings, guests);
  const reference = newReference();
  await db.insert(schema.customerBookings).values({
    ownerId: settings.ownerId,
    serviceId: service.id,
    serviceName: service.name,
    reference,
    customerName: name,
    phone,
    email,
    country: str(fd, "country"),
    guests,
    date: start,
    experience: str(fd, "experience"),
    notes: str(fd, "notes")?.slice(0, 1000) ?? null,
    paymentMethod: payment,
    totalEgp: total.egp,
    totalUsd: total.usd,
  });
  revalidatePath("/customer-bookings");
  redirect(`/s/${slug}/booking/${reference}`);
}
