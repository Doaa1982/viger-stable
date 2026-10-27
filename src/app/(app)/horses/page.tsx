import { stallLabel } from "@/lib/yard";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { Badge, Empty, HorseAvatar, PageHeader } from "@/components/ui";
import { age, label } from "@/lib/utils";

export default async function HorsesPage() {
  const { user, ownerId } = await requirePerm("yard");
  const horses = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, ownerId), with: { stall: true }, orderBy: asc(schema.horses.name) });
  return (
    <div>
      <PageHeader title="My horses" subtitle={`${horses.length} horses`} actions={<Link href="/horses/new" className="btn-primary">+ Add horse</Link>} />
      {horses.length === 0 ? (
        <Empty action={<Link href="/horses/new" className="btn-primary">Add your first horse</Link>}>No horses yet.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {horses.map((h) => (
            <Link key={h.id} href={`/horses/${h.id}`} className="card flex gap-4 hover:border-forest-500">
              <HorseAvatar name={h.name} url={h.photoUrl} size={64} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{h.name}</h3>
                  {h.listingType !== "NONE" && <Badge tone={h.listingType === "SALE" ? "green" : "blue"}>For {h.listingType.toLowerCase()}</Badge>}
                </div>
                <p className="text-sm text-stone-500">{[h.breed, label(h.sex), age(h.birthYear) && `${age(h.birthYear)} yrs`].filter((x) => x && x !== "—").join(" · ")}</p>
                <p className="text-sm text-stone-500">{h.discipline ?? "No discipline"}{h.stall && ` · ${stallLabel(h.stall)}`}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
