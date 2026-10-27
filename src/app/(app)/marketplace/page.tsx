import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { parseSearch, type SearchFilters } from "@/lib/ai/features";
import { HorseCard } from "@/components/horse-card";
import { AiTag, Empty, PageHeader } from "@/components/ui";
import { DISCIPLINES, age } from "@/lib/utils";

type SP = Record<string, string | undefined>;

export default async function Marketplace({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const all = sp.all === "1";

  let horses = await db.query.horses.findMany({
    where: and(eq(schema.horses.isPublic, true), all ? undefined : ne(schema.horses.listingType, "NONE")),
    with: { owner: true },
    orderBy: desc(schema.horses.createdAt),
  });

  let ai: SearchFilters | null = null;
  let aiError: string | null = null;
  if (sp.q) {
    try {
      ai = await parseSearch(sp.q, DISCIPLINES);
    } catch (e) {
      aiError = (e as Error).message;
    }
  }

  const f = {
    discipline: sp.discipline || ai?.discipline || null,
    sex: sp.sex || ai?.sex || null,
    type: sp.type || ai?.listingType || null,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : ai?.maxPrice ?? null,
    minPrice: ai?.minPrice ?? null,
    minAge: ai?.minAge ?? null,
    maxAge: sp.maxAge ? Number(sp.maxAge) : ai?.maxAge ?? null,
    minHeight: ai?.minHeight ?? null,
    city: sp.city || ai?.city || null,
    keywords: ai?.keywords ?? [],
  };

  horses = horses.filter((h) => {
    const a = age(h.birthYear);
    if (f.discipline && h.discipline !== f.discipline) return false;
    if (f.sex && h.sex !== f.sex) return false;
    if (f.type && h.listingType !== f.type) return false;
    // Hidden prices still match budget filters so sellers are not excluded; price stays private.
    if (f.maxPrice && h.price && h.price > f.maxPrice) return false;
    if (f.minPrice && h.price && h.price < f.minPrice) return false;
    if (f.minAge && a && a < f.minAge) return false;
    if (f.maxAge && a && a > f.maxAge) return false;
    if (f.minHeight && h.heightCm && h.heightCm < f.minHeight) return false;
    if (f.city && !(h.owner.city ?? "").toLowerCase().includes(f.city.toLowerCase())) return false;
    if (f.keywords.length) {
      const text = `${h.description ?? ""} ${h.temperament ?? ""} ${h.breed ?? ""}`.toLowerCase();
      if (!f.keywords.some((k) => text.includes(k.toLowerCase()))) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Marketplace" subtitle="Horses for sale and lease across Egypt" />

      <form className="card space-y-3 border-violet-200">
        <div className="flex items-center gap-2"><h2 className="font-semibold">Describe the horse you want</h2><AiTag /></div>
        <div className="flex gap-2">
          <input name="q" defaultValue={sp.q ?? ""} className="input" placeholder='e.g. "calm gelding for an amateur, around 1.20m, under 1.5 million EGP"' />
          <button className="btn-ai shrink-0">✦ Search</button>
        </div>
        {ai && <p className="text-sm text-violet-700">✦ {ai.explanation}</p>}
        {aiError && <p className="text-sm text-red-600">{aiError}</p>}
      </form>

      <form className="flex flex-wrap items-end gap-3 text-sm">
        <label><span className="lbl">Discipline</span>
          <select name="discipline" defaultValue={sp.discipline ?? ""} className="input"><option value="">Any</option>{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}</select>
        </label>
        <label><span className="lbl">Sex</span>
          <select name="sex" defaultValue={sp.sex ?? ""} className="input"><option value="">Any</option><option value="MARE">Mare</option><option value="GELDING">Gelding</option><option value="STALLION">Stallion</option></select>
        </label>
        <label><span className="lbl">Type</span>
          <select name="type" defaultValue={sp.type ?? ""} className="input"><option value="">Sale or lease</option><option value="SALE">Sale</option><option value="LEASE">Lease</option></select>
        </label>
        <label><span className="lbl">Max price (EGP)</span><input name="maxPrice" type="number" defaultValue={sp.maxPrice ?? ""} className="input w-36" /></label>
        <label><span className="lbl">Max age</span><input name="maxAge" type="number" defaultValue={sp.maxAge ?? ""} className="input w-20" /></label>
        <label><span className="lbl">City</span><input name="city" defaultValue={sp.city ?? ""} className="input w-28" /></label>
        <label className="flex items-center gap-2 pb-2"><input type="checkbox" name="all" value="1" defaultChecked={all} /> Include horses not for sale</label>
        <button className="btn-secondary">Filter</button>
      </form>

      {horses.length === 0 ? (
        <Empty>No horses match. Try a wider search.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {horses.map((h) => <HorseCard key={h.id} h={h} />)}
        </div>
      )}
    </div>
  );
}
