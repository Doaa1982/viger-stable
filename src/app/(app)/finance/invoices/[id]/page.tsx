import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { egp, fmtDate, label } from "@/lib/utils";
import { setInvoiceStatus } from "../../actions";
import { PrintButton } from "./print-button";

type Item = { description: string; quantity: number; unitPrice: number };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const inv = await db.query.invoices.findFirst({ where: and(eq(schema.invoices.id, id), eq(schema.invoices.ownerId, user.id)), with: { client: true } });
  if (!inv) notFound();
  const items = JSON.parse(inv.items) as Item[];
  const phone = inv.client?.phone?.replace(/\D/g, "");
  const waText = encodeURIComponent(`Hello ${inv.clientName}, here is invoice ${inv.number} from ${user.name}: ${egp(inv.total)}, due ${fmtDate(inv.dueAt)}. Thank you!`);

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/finance?tab=invoices" className="link text-sm">← Invoices</Link>
        <div className="flex flex-wrap gap-2">
          {inv.status === "DRAFT" && <form action={setInvoiceStatus.bind(null, inv.id, "SENT")}><button className="btn-secondary btn-sm">Mark as sent</button></form>}
          {inv.status !== "PAID" && <form action={setInvoiceStatus.bind(null, inv.id, "PAID")}><button className="btn-primary btn-sm">Mark as paid</button></form>}
          <a className="btn-secondary btn-sm" target="_blank" rel="noreferrer" href={phone ? `https://wa.me/${phone}?text=${waText}` : `https://wa.me/?text=${waText}`}>Send on WhatsApp</a>
          {inv.client?.email && <a className="btn-secondary btn-sm" href={`mailto:${inv.client.email}?subject=Invoice ${inv.number}&body=${waText}`}>Email</a>}
          <PrintButton />
        </div>
      </div>
      <div className="card p-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold text-forest-700">🐎 {user.name}</div>
            <div className="text-sm text-stone-500">{user.city}{user.phone && ` · ${user.phone}`}</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold">INVOICE</div>
            <div className="text-sm">{inv.number}</div>
            <Badge tone={inv.status === "PAID" ? "green" : "gray"}>{label(inv.status)}</Badge>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 text-sm">
          <div><div className="text-xs uppercase text-stone-500">Bill to</div><div className="font-medium">{inv.clientName}</div></div>
          <div className="text-right"><div>Issued: {fmtDate(inv.issuedAt)}</div><div>Due: {fmtDate(inv.dueAt)}</div></div>
        </div>
        <table className="table mt-8">
          <thead><tr><th>Description</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}><td>{it.description}</td><td className="text-right">{it.quantity}</td><td className="text-right">{egp(it.unitPrice)}</td><td className="text-right">{egp(it.quantity * it.unitPrice)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 text-right text-lg font-bold">Total: {egp(inv.total)}</div>
        {inv.notes && <p className="mt-8 whitespace-pre-line text-sm text-stone-600">{inv.notes}</p>}
      </div>
    </div>
  );
}
