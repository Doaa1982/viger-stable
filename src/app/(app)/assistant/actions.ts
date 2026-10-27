"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { runAssistant, type ChatTurn } from "@/lib/ai/assistant";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

export async function sendToAssistant(text: string): Promise<{ reply?: ChatMessage; error?: string }> {
  const { user, ownerId, stableName } = await requirePerm("assistant");
  const content = text.trim().slice(0, 4000);
  if (!content) return { error: "Type a message." };
  await db.insert(schema.assistantMessages).values({ userId: user.id, role: "user", content });
  const recent = await db.query.assistantMessages.findMany({ where: eq(schema.assistantMessages.userId, user.id), orderBy: desc(schema.assistantMessages.createdAt), limit: 20 });
  const history: ChatTurn[] = recent.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  // The API needs the conversation to start with a user turn
  while (history.length && history[0].role !== "user") history.shift();
  try {
    const answer = await runAssistant(ownerId, stableName, history);
    const [saved] = await db.insert(schema.assistantMessages).values({ userId: user.id, role: "assistant", content: answer || "Done." }).returning();
    revalidatePath("/tasks");
    revalidatePath("/health");
    return { reply: { id: saved.id, role: "assistant", content: saved.content } };
  } catch (e) {
    return { error: `The assistant could not answer: ${(e as Error).message}` };
  }
}

export async function clearAssistant() {
  const { user } = await requirePerm("assistant");
  await db.delete(schema.assistantMessages).where(eq(schema.assistantMessages.userId, user.id));
  revalidatePath("/assistant");
}
