"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { ensureBookingPage, SERVICE_CATEGORIES, slugify } from "@/lib/booking";
import { num, str } from "@/lib/utils";

export async function createBookingPage() {
  const user = await requireUser();
  await ensureBookingPage(user);
  revalidatePath("/booking-page");
}

export type SettingsState = { ok?: string; error?: string } | undefined;

export async function saveSettings(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const current = await db.query.bookingSettings.findFirst({ where: eq(schema.bookingSettings.ownerId, user.id) });
  if (!current) return { error: "Create your booking page first." };
  const slug = slugify(str(fd, "slug") ?? current.slug);
  const taken = await db.query.bookingSettings.findFirst({ where: and(eq(schema.bookingSettings.slug, slug), ne(schema.bookingSettings.id, current.id)) });
  if (taken) return { error: `The address /s/${slug} is already used. Choose another.` };
  const slots = (str(fd, "timeSlots") ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{1,2}:\d{2}$/.test(s))
    .map((s) => s.padStart(5, "0"));
  if (!slots.length) return { error: "Add at least one time slot, e.g. 08:00, 10:00, 16:00" };
  const closed = SERVICE_DAYS.filter((d) => fd.get(`closed-${d}`) === "on").join(",");
  const payOnArrival = fd.get("payOnArrival") === "on";
  const payByTransfer = fd.get("payByTransfer") === "on";
  if (!payOnArrival && !payByTransfer) return { error: "Keep at least one payment method on." };
  await db
    .update(schema.bookingSettings)
    .set({
      slug,
      displayName: str(fd, "displayName") ?? current.displayName,
      tagline: str(fd, "tagline"),
      about: str(fd, "about"),
      address: str(fd, "address"),
      mapUrl: str(fd, "mapUrl"),
      whatsapp: str(fd, "whatsapp"),
      email: str(fd, "email"),
      timeSlots: [...new Set(slots)].sort().join(","),
      closedDays: closed,
      usdRate: num(fd, "usdRate") ?? current.usdRate,
      payOnArrival,
      payByTransfer,
      transferDetails: str(fd, "transferDetails"),
      isPublished: fd.get("isPublished") === "on",
    })
    .where(eq(schema.bookingSettings.id, current.id));
  revalidatePath("/booking-page");
  revalidatePath(`/s/${slug}`);
  return { ok: "Saved." };
}

const SERVICE_DAYS = [0, 1, 2, 3, 4, 5, 6];

function serviceFields(fd: FormData) {
  const category = str(fd, "category") ?? "RIDE";
  return {
    name: str(fd, "name") ?? "New service",
    category: (SERVICE_CATEGORIES as readonly string[]).includes(category) ? category : "RIDE",
    description: str(fd, "description"),
    durationMin: num(fd, "durationMin"),
    priceEgp: num(fd, "priceEgp") ?? 0,
    priceUsd: num(fd, "priceUsd"),
    priceUnit: str(fd, "priceUnit") ?? (category === "LIVERY" ? "MONTH" : "PERSON"),
    maxGuests: Math.max(1, num(fd, "maxGuests") ?? 6),
    minAge: num(fd, "minAge"),
    sortOrder: num(fd, "sortOrder") ?? 0,
    active: fd.get("active") === "on",
  };
}

export async function addService(fd: FormData) {
  const user = await requireUser();
  await db.insert(schema.services).values({ ...serviceFields(fd), active: true, ownerId: user.id });
  revalidatePath("/booking-page");
}

export async function updateService(id: string, fd: FormData) {
  const user = await requireUser();
  await db.update(schema.services).set(serviceFields(fd)).where(and(eq(schema.services.id, id), eq(schema.services.ownerId, user.id)));
  revalidatePath("/booking-page");
}

export async function deleteService(id: string) {
  const user = await requireUser();
  await db.delete(schema.services).where(and(eq(schema.services.id, id), eq(schema.services.ownerId, user.id)));
  revalidatePath("/booking-page");
}
