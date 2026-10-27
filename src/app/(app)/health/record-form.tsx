"use client";

import { useActionState } from "react";
import { addHealthRecord, smartScanAction } from "./actions";
import { SubmitButton } from "@/components/client";

const TYPES = ["VACCINATION", "WORMING", "DENTAL", "FARRIER", "TREATMENT", "BLOOD_TEST", "VET_VISIT", "INJURY", "OTHER"];
const nice = (t: string) => t.charAt(0) + t.slice(1).toLowerCase().replace("_", " ");

export function RecordForm({ horses, defaultHorse }: { horses: { id: string; name: string }[]; defaultHorse?: string }) {
  const [scan, scanAction, scanning] = useActionState(smartScanAction, undefined);
  const d = scan?.data;
  const matched = d?.horseName ? horses.find((h) => h.name.toLowerCase() === d.horseName!.toLowerCase())?.id : undefined;

  return (
    <div className="space-y-4">
      <form action={scanAction} className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">Smart Scan <span className="badge bg-violet-100 text-violet-800">✦ AI Enhancement</span></div>
        <p className="mb-2 text-xs text-stone-500">Photo of a vaccination card, vet invoice, lab result or farrier note - Arabic or English.</p>
        <input type="file" name="document" accept="image/*" capture="environment" className="mb-2 block text-sm" />
        <button className="btn-ai btn-sm" disabled={scanning}>{scanning ? "Reading..." : "✦ Read document"}</button>
        {scan?.error && <p className="mt-2 text-sm text-red-600">{scan.error}</p>}
        {d && <p className="mt-2 text-sm text-violet-700">Filled in below - check and save.</p>}
      </form>

      <form action={addHealthRecord} key={JSON.stringify(d ?? {})} className="space-y-3">
        <input type="hidden" name="attachmentUrl" value={d?.attachmentUrl ?? ""} />
        <input type="hidden" name="source" value={d ? "SMART_SCAN" : "MANUAL"} />
        <select name="horseId" className="input" defaultValue={matched ?? defaultHorse ?? ""} required>
          <option value="" disabled>Choose horse</option>
          {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select name="type" className="input" defaultValue={d?.type ?? "VACCINATION"}>{TYPES.map((t) => <option key={t} value={t}>{nice(t)}</option>)}</select>
          <input name="date" type="date" className="input" defaultValue={d?.date ?? new Date().toISOString().slice(0, 10)} required />
          <input name="provider" className="input" placeholder="Vet / farrier" defaultValue={d?.provider ?? ""} />
          <input name="cost" type="number" className="input" placeholder="Cost (EGP)" defaultValue={d?.cost ?? ""} />
        </div>
        <label className="block"><span className="lbl">Next due (reminder)</span><input name="nextDue" type="date" className="input" defaultValue={d?.nextDue ?? ""} /></label>
        <textarea name="notes" rows={2} className="input" placeholder="Notes" defaultValue={d?.notes ?? ""} />
        <SubmitButton>Save record</SubmitButton>
      </form>
    </div>
  );
}
