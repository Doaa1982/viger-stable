"use client";

import { useActionState } from "react";
import { scanPassportAction } from "./actions";
import { SubmitButton } from "@/components/client";
import { ImageInput } from "@/components/image-input";

type HorseLike = Partial<{
  name: string; breed: string | null; sex: string | null; color: string | null; birthYear: number | null; heightCm: number | null;
  weightKg: number | null; discipline: string | null; level: string | null; temperament: string | null; feiId: string | null;
  microchip: string | null; sire: string | null; dam: string | null; damSire: string | null; description: string | null; isPublic: boolean;
}>;

const DISCIPLINES = ["Show jumping", "Dressage", "Endurance", "Polo", "Racing", "Eventing", "Leisure", "Breeding"];

export function HorseForm({ action, horse, submitLabel }: { action: (fd: FormData) => Promise<void>; horse?: HorseLike; submitLabel: string }) {
  const [scan, scanAction, scanning] = useActionState(scanPassportAction, undefined);
  const h: HorseLike = { ...horse, ...Object.fromEntries(Object.entries(scan?.data ?? {}).filter(([, v]) => v != null)) };
  const key = JSON.stringify(scan?.data ?? {});

  return (
    <div className="space-y-6">
      <form action={scanAction} className="card space-y-3 border-violet-200">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Scan passport</h2>
          <span className="badge bg-violet-100 text-violet-800">✦ AI Enhancement</span>
        </div>
        <p className="text-sm text-stone-500">Photograph the passport or FEI card pages (Arabic or English). The AI fills in the form below.</p>
        <ImageInput name="pages" multiple />
        <div>
          <button className="btn-ai btn-sm" disabled={scanning}>{scanning ? "Reading passport..." : "✦ Read passport"}</button>
        </div>
        {scan?.error && <p className="text-sm text-red-600">{scan.error}</p>}
        {scan?.data && <p className="text-sm text-violet-700">Filled in from the passport - check the details before saving.</p>}
      </form>

      <form action={action} key={key} className="card grid gap-4 md:grid-cols-3">
        <label className="block"><span className="lbl">Name *</span><input name="name" className="input" required defaultValue={h.name ?? ""} /></label>
        <label className="block"><span className="lbl">Breed</span><input name="breed" className="input" defaultValue={h.breed ?? ""} /></label>
        <label className="block"><span className="lbl">Sex</span>
          <select name="sex" className="input" defaultValue={h.sex ?? ""}>
            <option value="">-</option><option value="MARE">Mare</option><option value="STALLION">Stallion</option><option value="GELDING">Gelding</option>
          </select>
        </label>
        <label className="block"><span className="lbl">Colour</span><input name="color" className="input" defaultValue={h.color ?? ""} /></label>
        <label className="block"><span className="lbl">Year of birth</span><input name="birthYear" type="number" className="input" defaultValue={h.birthYear ?? ""} /></label>
        <label className="block"><span className="lbl">Height (cm)</span><input name="heightCm" type="number" className="input" defaultValue={h.heightCm ?? ""} /></label>
        <label className="block"><span className="lbl">Weight (kg)</span><input name="weightKg" type="number" className="input" defaultValue={h.weightKg ?? ""} /></label>
        <label className="block"><span className="lbl">Discipline</span>
          <select name="discipline" className="input" defaultValue={h.discipline ?? ""}>
            <option value="">-</option>{DISCIPLINES.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="block"><span className="lbl">Level</span><input name="level" className="input" placeholder="e.g. 1.20m" defaultValue={h.level ?? ""} /></label>
        <label className="block"><span className="lbl">Temperament</span><input name="temperament" className="input" defaultValue={h.temperament ?? ""} /></label>
        <label className="block"><span className="lbl">FEI ID</span><input name="feiId" className="input" defaultValue={h.feiId ?? ""} /></label>
        <label className="block"><span className="lbl">Microchip</span><input name="microchip" className="input" defaultValue={h.microchip ?? ""} /></label>
        <label className="block"><span className="lbl">Sire</span><input name="sire" className="input" defaultValue={h.sire ?? ""} /></label>
        <label className="block"><span className="lbl">Dam</span><input name="dam" className="input" defaultValue={h.dam ?? ""} /></label>
        <label className="block"><span className="lbl">Dam sire</span><input name="damSire" className="input" defaultValue={h.damSire ?? ""} /></label>
        <label className="block md:col-span-3"><span className="lbl">Description</span><textarea name="description" rows={3} className="input" defaultValue={h.description ?? ""} /></label>
        <label className="block"><span className="lbl">Photo</span><ImageInput name="photo" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked={h.isPublic ?? true} /> Show in public search</label>
        <div className="md:col-span-3"><SubmitButton>{submitLabel}</SubmitButton></div>
      </form>
    </div>
  );
}
