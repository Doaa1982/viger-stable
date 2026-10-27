import Link from "next/link";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { AiPanel } from "@/components/ai-panel";
import { SubmitButton } from "@/components/client";
import { AiTag, Badge, Card, Empty, PageHeader, Stat, Tabs } from "@/components/ui";
import { egp, fmtDate, label } from "@/lib/utils";
import { addClient, addTransaction, createInvoice, deleteTransaction, financeInsightsAction, linkHorseToClient } from "./actions";

const CATEGORIES = ["Feed", "Bedding", "Vet", "Farrier", "Salaries", "Livery", "Lessons", "Sale", "Stud fees", "Prize money", "Transport", "Equipment", "Utilities", "Other"];
const statusTone = (s: string) => (s === "PAID" ? "green" : s === "OVERDUE" ? "red" : s === "SENT" ? "blue" : "gray");

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { tab = "overview" } = await searchParams;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [tx, invoices, clients, horses] = await Promise.all([
    db.query.transactions.findMany({ where: eq(schema.transactions.ownerId, user.id), with: { horse: true }, orderBy: desc(schema.transactions.date) }),
    db.query.invoices.findMany({ where: eq(schema.invoices.ownerId, user.id), orderBy: desc(schema.invoices.issuedAt) }),
    db.query.clients.findMany({ where: eq(schema.clients.ownerId, user.id), with: { horses: true }, orderBy: asc(schema.clients.name) }),
    db.query.horses.findMany({ where: eq(schema.horses.ownerId, user.id), orderBy: asc(schema.horses.name) }),
  ]);
  const month = tx.filter((t) => t.date >= monthStart);
  const income = month.filter((t) => t.kind === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = month.filter((t) => t.kind === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const owed = invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE");
  const byCat = Object.entries(month.filter((t) => t.kind === "EXPENSE").reduce<Record<string, number>>((m, t) => ((m[t.category] = (m[t.category] ?? 0) + t.amount), m), {})).sort((a, b) => b[1] - a[1]);
  const byHorse = horses
    .map((h) => ({ h, cost: tx.filter((t) => t.horseId === h.id && t.kind === "EXPENSE").reduce((s, t) => s + t.amount, 0), income: tx.filter((t) => t.horseId === h.id && t.kind === "INCOME").reduce((s, t) => s + t.amount, 0) }))
    .filter((x) => x.cost || x.income)
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="space-y-6">
      <PageHeader title="Finance" subtitle="Income, expenses, invoices and livery clients (EGP)" actions={<a href="/finance/export" className="btn-secondary">Export CSV</a>} />
      <Tabs active={`/finance?tab=${tab}`} items={[
        { href: "/finance?tab=overview", label: "Overview" },
        { href: "/finance?tab=transactions", label: "Transactions" },
        { href: "/finance?tab=invoices", label: "Invoices" },
        { href: "/finance?tab=clients", label: "Livery clients" },
      ]} />

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Income this month" value={egp(income)} tone="good" />
            <Stat label="Expenses this month" value={egp(expense)} />
            <Stat label="Net" value={egp(income - expense)} tone={income - expense >= 0 ? "good" : "warn"} />
            <Stat label="Owed to you" value={egp(owed.reduce((s, i) => s + i.total, 0))} hint={`${owed.length} unpaid invoice(s)`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Spending by category (this month)">
              {byCat.length === 0 ? <Empty>No expenses yet.</Empty> : (
                <ul className="space-y-2 text-sm">
                  {byCat.map(([c, v]) => (
                    <li key={c}>
                      <div className="flex justify-between"><span>{c}</span><span>{egp(v)}</span></div>
                      <div className="mt-1 h-1.5 rounded bg-stone-100"><div className="h-1.5 rounded bg-forest-500" style={{ width: `${(v / byCat[0][1]) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="By horse (all time)">
              {byHorse.length === 0 ? <Empty>Link transactions to horses to see this.</Empty> : (
                <table className="table">
                  <thead><tr><th>Horse</th><th>Costs</th><th>Income</th></tr></thead>
                  <tbody>{byHorse.map(({ h, cost, income }) => <tr key={h.id}><td>{h.name}</td><td>{egp(cost)}</td><td>{egp(income)}</td></tr>)}</tbody>
                </table>
              )}
            </Card>
            <Card title={<span className="flex items-center gap-2">Finance insights <AiTag /></span>}>
              <p className="mb-3 text-sm text-stone-500">A plain-language review of the last 90 days and a forecast for next month.</p>
              <AiPanel action={financeInsightsAction} button="Review my finances" />
            </Card>
          </div>
        </>
      )}

      {tab === "transactions" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            {tx.length === 0 ? <Empty>No transactions.</Empty> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Date</th><th>Category</th><th>Horse</th><th>Description</th><th className="text-right">Amount</th><th></th></tr></thead>
                  <tbody>
                    {tx.map((t) => (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap">{fmtDate(t.date)}</td><td>{t.category}</td><td>{t.horse?.name ?? "—"}</td><td className="text-stone-600">{t.description}</td>
                        <td className={`whitespace-nowrap text-right font-medium ${t.kind === "INCOME" ? "text-emerald-700" : ""}`}>{t.kind === "INCOME" ? "+" : "−"}{egp(t.amount)}</td>
                        <td><form action={deleteTransaction.bind(null, t.id)}><button className="text-xs text-stone-400 hover:text-red-600">✕</button></form></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Add transaction">
            <form action={addTransaction} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select name="kind" className="input"><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></select>
                <input name="amount" type="number" step="0.01" className="input" placeholder="Amount (EGP)" required />
                <select name="category" className="input">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                <input name="date" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <select name="horseId" className="input" defaultValue=""><option value="">No horse</option>{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <input name="description" className="input" placeholder="Description" />
              <SubmitButton>Add</SubmitButton>
            </form>
          </Card>
        </div>
      )}

      {tab === "invoices" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            {invoices.length === 0 ? <Empty>No invoices yet.</Empty> : (
              <table className="table">
                <thead><tr><th>No.</th><th>Client</th><th>Issued</th><th>Due</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <td><Link href={`/finance/invoices/${i.id}`} className="link">{i.number}</Link></td><td>{i.clientName}</td><td>{fmtDate(i.issuedAt)}</td>
                      <td>{fmtDate(i.dueAt)}</td><td>{egp(i.total)}</td>
                      <td><Badge tone={statusTone(i.status !== "PAID" && i.dueAt < now && i.status !== "DRAFT" ? "OVERDUE" : i.status)}>{label(i.status !== "PAID" && i.dueAt < now && i.status !== "DRAFT" ? "OVERDUE" : i.status)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="New invoice">
            <form action={createInvoice} className="space-y-2">
              <select name="clientId" className="input" defaultValue=""><option value="">Choose client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input name="clientName" className="input" placeholder="…or type a name" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-1 rounded-lg bg-stone-50 p-2">
                  <input name={`desc${i}`} className="input" placeholder={i === 0 ? "Item, e.g. Full livery - October" : `Item ${i + 1} (optional)`} />
                  <div className="grid grid-cols-3 gap-1">
                    <input name={`qty${i}`} type="number" className="input" placeholder="Qty" defaultValue={1} title="Quantity" />
                    <input name={`price${i}`} type="number" className="input col-span-2" placeholder="Unit price (EGP)" />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <label><span className="lbl">Due in (days)</span><input name="dueDays" type="number" defaultValue={14} className="input" /></label>
              </div>
              <textarea name="notes" rows={2} className="input" placeholder="Notes / bank details" />
              <SubmitButton>Create invoice</SubmitButton>
            </form>
          </Card>
        </div>
      )}

      {tab === "clients" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Livery clients">
            {clients.length === 0 ? <Empty>No clients yet.</Empty> : (
              <table className="table">
                <thead><tr><th>Name</th><th>Contact</th><th>Horses</th><th>Owes</th></tr></thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.name}</td>
                      <td className="text-stone-600">{[c.phone, c.email].filter(Boolean).join(" · ")}</td>
                      <td>{c.horses.map((h) => h.name).join(", ") || "—"}</td>
                      <td>{egp(owed.filter((i) => i.clientId === c.id).reduce((s, i) => s + i.total, 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <form action={linkHorseToClient} className="mt-4 flex flex-wrap gap-2 text-sm">
              <select name="horseId" className="input w-auto">{horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
              <span className="self-center">belongs to</span>
              <select name="clientId" className="input w-auto" defaultValue=""><option value="">— nobody (own horse) —</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <SubmitButton className="btn-secondary btn-sm">Link</SubmitButton>
            </form>
          </Card>
          <Card title="Add client">
            <form action={addClient} className="space-y-2">
              <input name="name" className="input" placeholder="Name" required />
              <input name="phone" className="input" placeholder="Phone / WhatsApp" />
              <input name="email" className="input" placeholder="Email" />
              <SubmitButton>Add client</SubmitButton>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
