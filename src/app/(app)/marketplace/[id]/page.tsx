import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/client";
import { Badge, Card, HorseAvatar, PageHeader, Stars } from "@/components/ui";
import { age, egp, fmtDateTime, label } from "@/lib/utils";
import { toggleSave } from "../actions";
import { requestTrial } from "../../trials/actions";
import { sendMessage } from "../../messages/actions";

export default async function PublicHorse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const h = await db.query.horses.findFirst({ where: eq(schema.horses.id, id), with: { owner: true } });
  if (!h || (!h.isPublic && h.ownerId !== user.id)) notFound();
  const isOwner = h.ownerId === user.id;
  const [slots, saved, myRequests] = await Promise.all([
    db.query.trialSlots.findMany({ where: and(eq(schema.trialSlots.horseId, id), gte(schema.trialSlots.start, new Date())), orderBy: asc(schema.trialSlots.start) }),
    db.query.savedHorses.findFirst({ where: and(eq(schema.savedHorses.userId, user.id), eq(schema.savedHorses.horseId, id)) }),
    db.query.trialRequests.findMany({ where: and(eq(schema.trialRequests.horseId, id), eq(schema.trialRequests.requesterId, user.id)) }),
  ]);

  const facts: [string, string | number | null | undefined][] = [
    ["Breed", h.breed], ["Sex", label(h.sex)], ["Age", age(h.birthYear)], ["Height", h.heightCm && `${h.heightCm} cm`],
    ["Colour", h.color], ["Discipline", h.discipline], ["Level", h.level], ["Temperament", h.temperament],
    ["Sire", h.sire], ["Dam", h.dam], ["Dam sire", h.damSire],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={h.name}
        subtitle={`${h.owner.name}${h.owner.city ? ` · ${h.owner.city}` : ""}`}
        actions={
          isOwner ? <Link href={`/horses/${h.id}`} className="btn-secondary">Manage</Link> : (
            <form action={toggleSave.bind(null, h.id)}><button className="btn-secondary">{saved ? "★ Saved" : "☆ Save"}</button></form>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex gap-5">
            <HorseAvatar name={h.name} url={h.photoUrl} size={140} />
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {h.listingType !== "NONE" && <Badge tone={h.listingType === "SALE" ? "green" : "blue"}>For {h.listingType.toLowerCase()}</Badge>}
                {h.feiId && <Badge tone="blue">FEI verified · {h.feiId}</Badge>}
                <span className="text-lg font-bold">{h.listingType === "NONE" ? "" : h.showPrice ? `${egp(h.price)}${h.listingType === "LEASE" ? " / month" : ""}` : <span title="Price shared privately">Budget <Stars n={h.budgetStars} /></span>}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
                {facts.filter(([, v]) => v && v !== "—").map(([k, v]) => <div key={k}><dt className="text-xs text-stone-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
              </dl>
            </div>
          </div>
          {h.description && <p className="mt-4 whitespace-pre-line text-sm text-stone-700">{h.description}</p>}
        </Card>

        {!isOwner && (
          <div className="space-y-6">
            <Card title="Book a trial">
              {myRequests.length > 0 && <p className="mb-3 rounded bg-emerald-50 p-2 text-sm text-emerald-800">You requested a trial: {myRequests.map((r) => `${fmtDateTime(r.date)} (${r.status.toLowerCase()})`).join(", ")}</p>}
              <form action={requestTrial.bind(null, h.id)} className="space-y-3">
                {slots.length > 0 && (
                  <div className="space-y-1 text-sm">
                    <span className="lbl">Open slots</span>
                    {slots.map((s) => (
                      <label key={s.id} className="flex items-center gap-2">
                        <input type="radio" name="date" value={s.start.toISOString()} required /> {fmtDateTime(s.start)}
                      </label>
                    ))}
                    <span className="lbl pt-2">…or pick your own date</span>
                  </div>
                )}
                <input type="datetime-local" name="date" className="input" required={slots.length === 0} />
                <textarea name="message" rows={2} className="input" placeholder="Tell the owner about you and your riding" />
                <SubmitButton>Request trial</SubmitButton>
              </form>
            </Card>
            <Card title={`Message ${h.owner.name}`}>
              <form action={sendMessage} className="space-y-2">
                <input type="hidden" name="to" value={h.ownerId} />
                <input type="hidden" name="horseId" value={h.id} />
                <textarea name="content" rows={3} className="input" defaultValue={`Hi, I'm interested in ${h.name}. `} required />
                <SubmitButton className="btn-secondary">Send with horse card</SubmitButton>
              </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
