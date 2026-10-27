import Link from "next/link";
import { Badge, HorseAvatar, Stars } from "./ui";
import { age, egp, label } from "@/lib/utils";

type H = {
  id: string; name: string; breed: string | null; sex: string | null; birthYear: number | null; discipline: string | null; level: string | null;
  heightCm: number | null; listingType: string; price: number | null; showPrice: boolean; budgetStars: number | null; photoUrl: string | null; feiId: string | null;
  owner?: { name: string; city: string | null } | null;
};

export function HorseCard({ h }: { h: H }) {
  return (
    <Link href={`/marketplace/${h.id}`} className="card flex flex-col gap-3 hover:border-forest-500">
      <div className="flex items-start gap-3">
        <HorseAvatar name={h.name} url={h.photoUrl} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{h.name}</h3>
            {h.feiId && <Badge tone="blue">FEI ✓</Badge>}
          </div>
          <p className="text-sm text-stone-500">{[h.breed, label(h.sex), age(h.birthYear) && `${age(h.birthYear)} yrs`, h.heightCm && `${h.heightCm} cm`].filter((x) => x && x !== "—").join(" · ")}</p>
        </div>
      </div>
      <p className="text-sm text-stone-600">{h.discipline}{h.level && ` · ${h.level}`}</p>
      <div className="mt-auto flex items-center justify-between text-sm">
        {h.listingType === "NONE" ? <Badge>Not for sale</Badge> : <Badge tone={h.listingType === "SALE" ? "green" : "blue"}>For {h.listingType.toLowerCase()}</Badge>}
        <span className="font-semibold">{h.listingType === "NONE" ? "" : h.showPrice ? `${egp(h.price)}${h.listingType === "LEASE" ? "/mo" : ""}` : <Stars n={h.budgetStars} />}</span>
      </div>
      {h.owner && <p className="text-xs text-stone-400">{h.owner.name}{h.owner.city && ` · ${h.owner.city}`}</p>}
    </Link>
  );
}
