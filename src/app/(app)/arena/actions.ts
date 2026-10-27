"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/utils";

export async function createPost(fd: FormData) {
  const user = await requireUser();
  const content = str(fd, "content");
  if (!content) return;
  await db.insert(schema.posts).values({ authorId: user.id, content, tag: str(fd, "tag") ?? "UPDATE", horseId: str(fd, "horseId") });
  revalidatePath("/arena");
}

export async function toggleLike(postId: string) {
  const user = await requireUser();
  const where = and(eq(schema.likes.postId, postId), eq(schema.likes.userId, user.id));
  const existing = await db.query.likes.findFirst({ where });
  if (existing) await db.delete(schema.likes).where(where);
  else await db.insert(schema.likes).values({ postId, userId: user.id });
  revalidatePath("/arena");
}

export async function addComment(postId: string, fd: FormData) {
  const user = await requireUser();
  const content = str(fd, "content");
  if (!content) return;
  await db.insert(schema.comments).values({ postId, authorId: user.id, content });
  revalidatePath("/arena");
}

export async function toggleFollow(userId: string) {
  const user = await requireUser();
  if (userId === user.id) return;
  const where = and(eq(schema.follows.followerId, user.id), eq(schema.follows.followingId, userId));
  const existing = await db.query.follows.findFirst({ where });
  if (existing) await db.delete(schema.follows).where(where);
  else await db.insert(schema.follows).values({ followerId: user.id, followingId: userId });
  revalidatePath("/arena");
}

export async function deletePost(postId: string) {
  const user = await requireUser();
  await db.delete(schema.posts).where(and(eq(schema.posts.id, postId), eq(schema.posts.authorId, user.id)));
  revalidatePath("/arena");
}
