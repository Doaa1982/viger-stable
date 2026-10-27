"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/utils";

export async function updateProfile(fd: FormData) {
  const user = await requireUser();
  await db
    .update(schema.users)
    .set({
      name: str(fd, "name") ?? user.name,
      bio: str(fd, "bio"),
      city: str(fd, "city"),
      phone: str(fd, "phone"),
      credentials: str(fd, "credentials"),
      rates: str(fd, "rates"),
      serviceArea: str(fd, "serviceArea"),
    })
    .where(eq(schema.users.id, user.id));
  revalidatePath("/", "layout");
}
