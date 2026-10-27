import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { Badge, Empty, PageHeader, Tabs } from "@/components/ui";
import { TRADES, label } from "@/lib/utils";

export default async function ProfessionalsPage({ searchParams }: { searchParams: Promise<{ trade?: string }> }) {
  await requireUser();
  const { trade } = await searchParams;
  let pros = await db.query.users.findMany({ where: eq(schema.users.role, "PROFESSIONAL"), orderBy: asc(schema.users.name) });
  if (trade) pros = pros.filter((p) => p.trade === trade);
  return (
    <div>
      <PageHeader title="Professionals" subtitle="Vets, farriers, coaches and more - book straight from their profile" />
      <Tabs active={trade ? `/professionals?trade=${trade}` : "/professionals"} items={[{ href: "/professionals", label: "All" }, ...TRADES.map((t) => ({ href: `/professionals?trade=${t}`, label: label(t) }))]} />
      {pros.length === 0 ? <Empty>No professionals found.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pros.map((p) => (
            <Link key={p.id} href={`/professionals/${p.id}`} className="card hover:border-forest-500">
              <div className="flex items-center justify-between"><h3 className="font-semibold">{p.name}</h3><Badge tone="blue">{label(p.trade)}</Badge></div>
              <p className="mt-1 text-sm text-stone-500">{p.serviceArea ?? p.city}</p>
              {p.credentials && <p className="mt-2 text-sm">{p.credentials}</p>}
              {p.rates && <p className="mt-1 text-sm text-stone-600">{p.rates}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
