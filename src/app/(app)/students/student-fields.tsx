import { LEVELS } from "@/lib/riders";
import { label } from "@/lib/utils";

type S = { name?: string; phone?: string | null; email?: string | null; guardianName?: string | null; birthYear?: number | null; level?: string; goals?: string | null; coachStaffId?: string | null; notes?: string | null };

export function StudentFields({ s, coaches }: { s?: S; coaches: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="block"><span className="lbl">Name *</span><input name="name" defaultValue={s?.name} className="input" required /></label>
      <label className="block"><span className="lbl">Phone / WhatsApp</span><input name="phone" defaultValue={s?.phone ?? ""} className="input" /></label>
      <label className="block"><span className="lbl">Email</span><input name="email" type="email" defaultValue={s?.email ?? ""} className="input" /></label>
      <label className="block"><span className="lbl">Parent / guardian (for children)</span><input name="guardianName" defaultValue={s?.guardianName ?? ""} className="input" /></label>
      <label className="block"><span className="lbl">Year of birth</span><input name="birthYear" type="number" defaultValue={s?.birthYear ?? ""} className="input" /></label>
      <label className="block"><span className="lbl">Level</span>
        <select name="level" defaultValue={s?.level ?? "BEGINNER"} className="input">{LEVELS.map((l) => <option key={l} value={l}>{label(l)}</option>)}</select>
      </label>
      <label className="block"><span className="lbl">Coach</span>
        <select name="coachStaffId" defaultValue={s?.coachStaffId ?? ""} className="input"><option value="">-</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>
      <label className="block md:col-span-2"><span className="lbl">Goals</span><input name="goals" defaultValue={s?.goals ?? ""} className="input" placeholder="e.g. canter confidently, first show in spring" /></label>
      <label className="block md:col-span-3"><span className="lbl">Private notes (staff only)</span><textarea name="notes" rows={2} defaultValue={s?.notes ?? ""} className="input" /></label>
    </div>
  );
}
