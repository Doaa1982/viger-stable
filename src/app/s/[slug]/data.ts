import "server-only";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";

/** Load a published stable booking page by its public slug, or 404. */
export const getBookingPage = cache(async (slug: string) => {
  const settings = await db.query.bookingSettings.findFirst({ where: eq(schema.bookingSettings.slug, slug) });
  if (!settings || !settings.isPublished) notFound();
  const services = await db.query.services.findMany({
    where: and(eq(schema.services.ownerId, settings.ownerId), eq(schema.services.active, true)),
    orderBy: [asc(schema.services.sortOrder), asc(schema.services.name)],
  });
  return { settings, services };
});
