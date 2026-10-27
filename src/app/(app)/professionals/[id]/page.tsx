import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/client";
import { Badge, Card, PageHeader } from "@/components/ui";
import { label } from "@/lib/utils";
import { createBooking } from "../../bookings/actions";
import { sendMessage } from "../../messages/actions";

const SERVICES: Record<string, string[]> = {
  VET: ["Routine check", "Vaccination", "Lameness check", "Dental", "Pre-purchase exam", "Emergency"],
  FARRIER: ["Full set of shoes", "Front shoes", "Trim", "Corrective shoeing"],
  COACH: ["Private lesson", "Group lesson", "Competition coaching"],
  GROOM: ["Show grooming", "Clipping", "Daily care"],
  TRANSPORTER: ["Local transport", "Transport to show", "Long distance"],
  BODYWORKER: ["Massage", "Physio session"],
  OTHER: ["Session"],
};

export default async function ProProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const pro = await db.query.users.findFirst({ where: and(eq(schema.users.id, id), eq(schema.users.role, "PROFESSIONAL")) });
  if (!pro) notFound();
  const myHorses = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, user.id) });
  return (
    <div>
      <PageHeader title={pro.name} subtitle={`${label(pro.trade)}${pro.city ? ` · ${pro.city}` : ""}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Badge tone="blue">{label(pro.trade)}</Badge>
          {pro.bio && <p className="mt-3 text-sm">{pro.bio}</p>}
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="text-xs text-stone-500">Credentials</dt><dd>{pro.credentials ?? "—"}</dd></div>
            <div><dt className="text-xs text-stone-500">Rates</dt><dd>{pro.rates ?? "—"}</dd></div>
            <div><dt className="text-xs text-stone-500">Service area</dt><dd>{pro.serviceArea ?? "—"}</dd></div>
            <div><dt className="text-xs text-stone-500">Phone</dt><dd>{pro.phone ?? "Message in app"}</dd></div>
          </dl>
        </Card>
        {pro.id !== user.id && (
          <div className="space-y-6">
            <Card title="Book">
              <form action={createBooking.bind(null, pro.id)} className="space-y-3">
                <label className="block"><span className="lbl">Service</span>
                  <select name="service" className="input">{(SERVICES[pro.trade ?? "OTHER"] ?? SERVICES.OTHER).map((s) => <option key={s}>{s}</option>)}</select>
                </label>
                <label className="block"><span className="lbl">Horse (optional)</span>
                  <select name="horseId" className="input" defaultValue=""><option value="">No horse / lesson</option>{myHorses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
                </label>
                <label className="block"><span className="lbl">Date and time</span><input name="date" type="datetime-local" className="input" required /></label>
                <textarea name="notes" rows={2} className="input" placeholder="What do you need?" />
                <SubmitButton>Request booking</SubmitButton>
              </form>
            </Card>
            <Card title="Message">
              <form action={sendMessage} className="space-y-2">
                <input type="hidden" name="to" value={pro.id} />
                <textarea name="content" rows={2} className="input" required />
                <SubmitButton className="btn-secondary">Send</SubmitButton>
              </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
