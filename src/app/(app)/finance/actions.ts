"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { aiEnabled, askText } from "@/lib/ai/client";
import type { AiState } from "@/components/ai-panel";
import { addDays, date, egp, num, str, ymd } from "@/lib/utils";

export async function addTransaction(fd: FormData) {
  const { user, ownerId } = await requirePerm("finance");
  const amount = num(fd, "amount");
  if (!amount) return;
  await db.insert(schema.transactions).values({
    ownerId: ownerId,
    kind: str(fd, "kind") ?? "EXPENSE",
    category: str(fd, "category") ?? "Other",
    amount,
    date: date(fd, "date") ?? new Date(),
    horseId: str(fd, "horseId"),
    description: str(fd, "description"),
  });
  revalidatePath("/finance");
}

export async function deleteTransaction(id: string) {
  const { user, ownerId } = await requirePerm("finance");
  await db.delete(schema.transactions).where(and(eq(schema.transactions.id, id), eq(schema.transactions.ownerId, ownerId)));
  revalidatePath("/finance");
}

export async function addClient(fd: FormData) {
  const { user, ownerId } = await requirePerm("finance");
  const name = str(fd, "name");
  if (!name) return;
  await db.insert(schema.clients).values({ ownerId: ownerId, name, phone: str(fd, "phone"), email: str(fd, "email") });
  revalidatePath("/finance");
}

export async function linkHorseToClient(fd: FormData) {
  const { user, ownerId } = await requirePerm("finance");
  const horseId = str(fd, "horseId");
  if (!horseId) return;
  await db.update(schema.horses).set({ clientId: str(fd, "clientId") }).where(and(eq(schema.horses.id, horseId), eq(schema.horses.ownerId, ownerId)));
  revalidatePath("/finance");
}

export async function createInvoice(fd: FormData) {
  const { user, ownerId } = await requirePerm("finance");
  const clientId = str(fd, "clientId");
  const client = clientId ? await db.query.clients.findFirst({ where: and(eq(schema.clients.id, clientId), eq(schema.clients.ownerId, ownerId)) }) : null;
  const clientName = client?.name ?? str(fd, "clientName");
  if (!clientName) return;
  const items = [0, 1, 2, 3, 4]
    .map((i) => ({ description: str(fd, `desc${i}`), quantity: num(fd, `qty${i}`) ?? 1, unitPrice: num(fd, `price${i}`) ?? 0 }))
    .filter((i): i is { description: string; quantity: number; unitPrice: number } => Boolean(i.description) && i.unitPrice > 0);
  if (!items.length) return;
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const count = (await db.query.invoices.findMany({ where: eq(schema.invoices.ownerId, ownerId) })).length;
  const [inv] = await db
    .insert(schema.invoices)
    .values({
      ownerId: ownerId,
      clientId: client?.id ?? null,
      clientName,
      number: `VS-${String(count + 1).padStart(4, "0")}`,
      items: JSON.stringify(items),
      total,
      status: "DRAFT",
      issuedAt: new Date(),
      dueAt: addDays(new Date(), num(fd, "dueDays") ?? 14),
      notes: str(fd, "notes"),
    })
    .returning();
  redirect(`/finance/invoices/${inv.id}`);
}

export async function setInvoiceStatus(id: string, status: string) {
  const { user, ownerId } = await requirePerm("finance");
  const inv = await db.query.invoices.findFirst({ where: and(eq(schema.invoices.id, id), eq(schema.invoices.ownerId, ownerId)) });
  if (!inv) return;
  await db.update(schema.invoices).set({ status }).where(eq(schema.invoices.id, id));
  if (status === "PAID" && inv.status !== "PAID") {
    await db.insert(schema.transactions).values({ ownerId: ownerId, kind: "INCOME", category: "Invoices", amount: inv.total, date: new Date(), description: `Invoice ${inv.number} - ${inv.clientName}` });
  }
  revalidatePath("/finance");
  revalidatePath(`/finance/invoices/${id}`);
}

/** AI Enhancement: plain-language finance review and next-month forecast. */
export async function financeInsightsAction(): Promise<AiState> {
  try {
    const { user, ownerId } = await requirePerm("finance");
    const since = addDays(new Date(), -90);
    const tx = await db.query.transactions.findMany({ where: and(eq(schema.transactions.ownerId, ownerId), gte(schema.transactions.date, since)), with: { horse: true }, orderBy: desc(schema.transactions.date) });
    const inv = await db.query.invoices.findMany({ where: eq(schema.invoices.ownerId, ownerId) });
    const income = tx.filter((t) => t.kind === "INCOME").reduce((s, t) => s + t.amount, 0);
    const expense = tx.filter((t) => t.kind === "EXPENSE").reduce((s, t) => s + t.amount, 0);
    const unpaid = inv.filter((i) => i.status === "SENT" || i.status === "OVERDUE");
    if (!aiEnabled()) {
      const byCat: Record<string, number> = {};
      tx.filter((t) => t.kind === "EXPENSE").forEach((t) => (byCat[t.category] = (byCat[t.category] ?? 0) + t.amount));
      const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return {
        text: `**Last 90 days (demo mode)**\n\n- Income ${egp(income)}, expenses ${egp(expense)}, net ${egp(income - expense)}\n- Biggest costs: ${top.map(([c, v]) => `${c} ${egp(v)}`).join(", ")}\n- Unpaid invoices: ${unpaid.length} (${egp(unpaid.reduce((s, i) => s + i.total, 0))})\n- Forecast next month: about ${egp((income - expense) / 3)} net if nothing changes.\n\n_Connect the AI for deeper insights._`,
      };
    }
    const text = await askText({
      system: "You are a finance advisor for horse yards. Be concrete, use EGP, max 200 words, markdown bullets.",
      prompt: `Transactions (last 90 days):\n${tx.map((t) => `${ymd(t.date)} ${t.kind} ${t.category} ${t.amount} ${t.horse?.name ?? ""} ${t.description ?? ""}`).join("\n")}
Unpaid invoices: ${unpaid.map((i) => `${i.number} ${i.clientName} ${i.total} due ${ymd(i.dueAt)}`).join("; ") || "none"}
Give: 1) a summary, 2) where money is leaking, 3) cost per horse insight, 4) a forecast for next month, 5) three actions.`,
      maxTokens: 800,
    });
    return { text };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
