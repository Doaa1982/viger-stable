"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/utils";

export async function sendMessage(fd: FormData) {
  const user = await requireUser();
  const to = str(fd, "to");
  const content = str(fd, "content");
  if (!to || !content || to === user.id) return;
  await db.insert(schema.messages).values({ senderId: user.id, receiverId: to, content, horseId: str(fd, "horseId") });
  revalidatePath("/messages");
  redirect(`/messages?with=${to}`);
}
