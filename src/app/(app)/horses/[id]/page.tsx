import Link from "next/link";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { AiPanel } from "@/components/ai-panel";
import { SubmitButton } from "@/components/client";
import { Markdown } from "@/components/markdown";
import { AiTag, Badge, Card, Empty, HorseAvatar, PageHeader, Stars } from "@/components/ui";
import { age, egp, fmtDate, fmtDateTime, label } from "@/lib/utils";
import { getOwnedHorse } from "../data";
import { addTrialSlot, deleteTrialSlot, gaitAction, healthRiskAction, listingAction, trainingPlanAction, triageAction, updateListing, valuationAction } from "../actions";
import { decideTrial } from "../../trials/actions";

export default async function HorseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const horse = await getOwnedHorse(user, id);
  const [records, feed, slots, requests, gaits, stall] = await Promise.all([
    db.query.healthRecords.findMany({ where: eq(schema.healthRecords.horseId, id), orderBy: desc(schema.healthRecords.date), limit: 8 }),
    db.query.feedPlans.findFirst({ where: and(eq(schema.feedPlans.horseId, id), eq(schema.feedPlans.active, true)) }),
    db.query.trialSlots.findMany({ where: and(eq(schema.trialSlots.horseId, id), gte(schema.trialSlots.end, new Date())), orderBy: asc(schema.trialSlots.start) }),
    db.query.trialRequests.findMany({ where: eq(schema.trialRequests.horseId, id), with: { requester: true }, orderBy: desc(schema.trialRequests.createdAt) }),
    db.query.gaitAnalyses.findMany({ where: eq(schema.gaitAnalyses.horseId, id), orderBy: desc(schema.gaitAnalyses.createdAt), limit: 3 }),
    horse.stallId ? db.query.stalls.findFirst({ where: eq(schema.stalls.id, horse.stallId) }) : null,
  ]);

  const facts: [string, string | number | null][] = [
    ["Breed", horse.breed],
    ["Sex", label(horse.sex)],
    ["Age", age(horse.birthYear) ? `${age(horse.birthYear)} (born ${horse.birthYear})` : null],
    ["Colour", horse.color],
    ["Height", horse.heightCm ? `${horse.heightCm} cm` : null],
    ["Weight", horse.weightKg ? `${horse.weightKg} kg` : null],
    ["Discipline", horse.discipline],
    ["Level", horse.level],
    ["Temperament", horse.temperament],
    ["FEI ID", horse.feiId],
    ["Microchip", horse.microchip],
    ["Pedigree", horse.sire || horse.dam ? `${horse.sire ?? "?"} × ${horse.dam ?? "?"}${horse.damSire ? ` (${horse.damSire})` : ""}` : null],
    ["Stall", stall?.name ?? null],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={horse.name}
        subtitle={[horse.breed, horse.discipline].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/marketplace/${horse.id}`} className="btn-secondary">Public page</Link>
            <Link href={`/horses/${horse.id}/edit`} className="btn-secondary">Edit</Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex gap-5">
            <HorseAvatar name={horse.name} url={horse.photoUrl} size={120} />
            <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              {facts.filter(([, v]) => v && v !== "—").map(([k, v]) => (
                <div key={k}><dt className="text-xs text-stone-500">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
          </div>
          {horse.description && <p className="mt-4 text-sm text-stone-600">{horse.description}</p>}
        </Card>

        <Card title="Feeding" actions={<Link href={`/feeding?horse=${horse.id}`} className="link text-sm">Edit →</Link>}>
          {feed ? (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-stone-500">Morning</dt><dd>{feed.morning ?? "—"}</dd></div>
              <div><dt className="text-xs text-stone-500">Midday</dt><dd>{feed.midday ?? "—"}</dd></div>
              <div><dt className="text-xs text-stone-500">Evening</dt><dd>{feed.evening ?? "—"}</dd></div>
              {feed.supplements && <div><dt className="text-xs text-stone-500">Supplements</dt><dd>{feed.supplements}</dd></div>}
            </dl>
          ) : (
            <Empty action={<Link href={`/feeding?horse=${horse.id}`} className="btn-secondary btn-sm">Create plan</Link>}>No feeding plan.</Empty>
          )}
        </Card>
      </div>

      <Card title="Health records" actions={<Link href={`/health?horse=${horse.id}`} className="link text-sm">Add record / Smart Scan →</Link>}>
        {records.length === 0 ? (
          <Empty>No records yet.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>Date</th><th>Type</th><th>Notes</th><th>Next due</th><th>Cost</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{label(r.type)}</td>
                  <td className="text-stone-600">{r.notes}{r.provider && <span className="text-stone-400"> · {r.provider}</span>}</td>
                  <td>{r.nextDue ? <Badge tone={r.nextDue < new Date() ? "red" : "gray"}>{fmtDate(r.nextDue)}</Badge> : "—"}</td>
                  <td>{egp(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">✦ AI tools for {horse.name}</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={<span className="flex items-center gap-2">Health Early-Warning <AiTag kind="added" /></span>}>
            <p className="mb-3 text-sm text-stone-500">Checks the health history, feeding and your notes for risks and overdue care.</p>
            <AiPanel action={healthRiskAction} button="Check health risks" hidden={{ horseId: horse.id }}>
              <textarea name="notes" rows={2} className="input" placeholder="Anything you noticed? e.g. left half his dinner, warm left fore" />
            </AiPanel>
          </Card>

          <Card title={<span className="flex items-center gap-2">Symptom Triage <AiTag kind="added" /></span>}>
            <p className="mb-3 text-sm text-stone-500">Something wrong? Describe it (and add photos). The AI tells you how urgent it is and what to do while you wait for the vet.</p>
            <AiPanel action={triageAction} button="How urgent is this?" hidden={{ horseId: horse.id }}>
              <textarea name="description" rows={2} className="input" placeholder="e.g. pawing and looking at his belly since lunch, no droppings" />
              <input type="file" name="photos" accept="image/*" multiple className="text-sm" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="log" defaultChecked /> Log it in the health record</label>
            </AiPanel>
          </Card>

          <Card title={<span className="flex items-center gap-2">Training Planner <AiTag kind="added" /></span>}>
            <p className="mb-3 text-sm text-stone-500">A weekly plan from {horse.name}&apos;s level, goal and latest gait analysis.</p>
            <AiPanel action={trainingPlanAction} button="Plan this week" hidden={{ horseId: horse.id }}>
              <div className="grid grid-cols-3 gap-2">
                <input name="goal" className="input col-span-2" placeholder="Goal, e.g. step up to 1.30m in 2 months" />
                <select name="days" className="input" defaultValue="5">{[3, 4, 5, 6].map((d) => <option key={d} value={d}>{d} days/wk</option>)}</select>
              </div>
              <input name="notes" className="input" placeholder="Recent results or notes (optional)" />
            </AiPanel>
          </Card>

          <Card title={<span className="flex items-center gap-2">Horse Valuation <AiTag kind="added" /></span>}>
            <p className="mb-3 text-sm text-stone-500">
              Estimated market value in EGP.{" "}
              {horse.aiValuationLow && horse.aiValuationHigh && <>Last estimate: <strong>{egp(horse.aiValuationLow)} - {egp(horse.aiValuationHigh)}</strong></>}
            </p>
            <AiPanel action={valuationAction} button="Estimate value" hidden={{ horseId: horse.id }} />
          </Card>

          <Card title={<span className="flex items-center gap-2">Listing Writer <AiTag kind="added" /></span>}>
            <p className="mb-3 text-sm text-stone-500">Writes an honest sale or lease advert from the horse&apos;s profile.</p>
            <AiPanel action={listingAction} button="Write listing" hidden={{ horseId: horse.id }}>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="apply" /> Save as the horse&apos;s description</label>
            </AiPanel>
          </Card>

          <Card title={<span className="flex items-center gap-2">Ride &amp; Gait Analysis <AiTag kind="added" /></span>}>
            <p className="mb-3 text-sm text-stone-500">Upload 1-4 photos or video frames of {horse.name} moving (side and behind views work best).</p>
            <AiPanel action={gaitAction} button="Analyse movement" hidden={{ horseId: horse.id }} pendingText="Analysing frames...">
              <input type="file" name="frames" accept="image/*" multiple className="text-sm" />
              <input name="context" className="input" placeholder="Context, e.g. trot on hard ground, left rein" />
            </AiPanel>
            {gaits.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-stone-600">Previous analyses ({gaits.length})</summary>
                {gaits.map((g) => (
                  <div key={g.id} className="mt-3 rounded-lg bg-stone-50 p-3">
                    <div className="mb-1 text-xs text-stone-500">{fmtDateTime(g.createdAt)}</div>
                    <Markdown text={g.result} />
                  </div>
                ))}
              </details>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Sell or lease">
          <form action={updateListing.bind(null, horse.id)} className="grid grid-cols-2 gap-3">
            <label className="block"><span className="lbl">Listing</span>
              <select name="listingType" className="input" defaultValue={horse.listingType}>
                <option value="NONE">Not listed</option><option value="SALE">For sale</option><option value="LEASE">For lease</option>
              </select>
            </label>
            <label className="block"><span className="lbl">Price (EGP{horse.listingType === "LEASE" ? " / month" : ""})</span><input name="price" type="number" className="input" defaultValue={horse.price ?? ""} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="showPrice" defaultChecked={horse.showPrice} /> Show price publicly</label>
            <label className="block"><span className="lbl">Budget stars (if price hidden)</span>
              <select name="budgetStars" className="input" defaultValue={horse.budgetStars ?? ""}>
                <option value="">-</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
            </label>
            <div className="col-span-2 flex items-center justify-between">
              <SubmitButton className="btn-primary btn-sm">Save listing</SubmitButton>
              {horse.listingType !== "NONE" && <span className="text-sm text-stone-500">{horse.showPrice ? egp(horse.price) : <Stars n={horse.budgetStars} />}</span>}
            </div>
          </form>
        </Card>

        <Card title="Trial availability">
          <form action={addTrialSlot.bind(null, horse.id)} className="mb-4 flex flex-wrap items-end gap-2">
            <label className="block"><span className="lbl">Start</span><input name="start" type="datetime-local" className="input" required /></label>
            <label className="block"><span className="lbl">Hours</span><input name="hours" type="number" defaultValue={2} min={1} max={8} className="input w-20" /></label>
            <SubmitButton className="btn-secondary btn-sm">Add slot</SubmitButton>
          </form>
          {slots.length === 0 ? (
            <p className="text-sm text-stone-500">No open slots. Buyers can still request a custom date.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {slots.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  {fmtDateTime(s.start)} - {s.end.toTimeString().slice(0, 5)}
                  <form action={deleteTrialSlot.bind(null, horse.id, s.id)}><button className="text-xs text-red-600">Remove</button></form>
                </li>
              ))}
            </ul>
          )}
          {requests.length > 0 && (
            <div className="mt-4 border-t border-stone-100 pt-3">
              <h3 className="mb-2 text-sm font-semibold">Requests</h3>
              <ul className="space-y-2 text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="rounded-lg bg-stone-50 p-2">
                    <div className="flex items-center justify-between">
                      <span><strong>{r.requester.name}</strong> · {fmtDateTime(r.date)}</span>
                      {r.status === "PENDING" ? (
                        <span className="flex gap-1">
                          <form action={decideTrial.bind(null, r.id, "APPROVED")}><button className="btn-primary btn-sm">Approve</button></form>
                          <form action={decideTrial.bind(null, r.id, "DECLINED")}><button className="btn-secondary btn-sm">Decline</button></form>
                        </span>
                      ) : (
                        <Badge tone={r.status === "APPROVED" ? "green" : "gray"}>{label(r.status)}</Badge>
                      )}
                    </div>
                    {r.message && <p className="mt-1 text-stone-600">{r.message}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
