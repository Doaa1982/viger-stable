import { ymd } from "@/lib/utils";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";

/** CSV export of all transactions (opens in Excel). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const tx = await db.query.transactions.findMany({ where: eq(schema.transactions.ownerId, user.id), with: { horse: true }, orderBy: desc(schema.transactions.date) });
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Date", "Type", "Category", "Horse", "Description", "Amount (EGP)"], ...tx.map((t) => [ymd(t.date), t.kind, t.category, t.horse?.name ?? "", t.description ?? "", t.amount])];
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="viger-finance.csv"` } });
}
