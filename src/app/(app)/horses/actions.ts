"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { saveImage } from "@/lib/uploads";
import { gaitAnalysis, healthRiskCheck, scanPassport, symptomTriage, trainingPlan, valuateHorse, writeListing, type PassportScan } from "@/lib/ai/features";
import type { AiState } from "@/components/ai-panel";
import { date, egp, num, str } from "@/lib/utils";
import { getOwnedHorse } from "./data";

function horseFields(fd: FormData) {
  return {
    name: str(fd, "name") ?? "Unnamed",
    breed: str(fd, "breed"),
    sex: str(fd, "sex"),
    color: str(fd, "color"),
    birthYear: num(fd, "birthYear"),
    heightCm: num(fd, "heightCm"),
    weightKg: num(fd, "weightKg"),
    discipline: str(fd, "discipline"),
    level: str(fd, "level"),
    temperament: str(fd, "temperament"),
    feiId: str(fd, "feiId"),
    microchip: str(fd, "microchip"),
    sire: str(fd, "sire"),
    dam: str(fd, "dam"),
    damSire: str(fd, "damSire"),
    description: str(fd, "description"),
    isPublic: fd.get("isPublic") === "on",
  };
}

export async function createHorse(fd: FormData) {
  const user = await requireUser();
  const photo = await saveImage(fd.get("photo") as File | null);
  const [h] = await db
    .insert(schema.horses)
    .values({ ...horseFields(fd), ownerId: user.id, photoUrl: photo?.url ?? null })
    .returning();
  revalidatePath("/horses");
  redirect(`/horses/${h.id}`);
}

export async function updateHorse(id: string, fd: FormData) {
  const user = await requireUser();
  await getOwnedHorse(user, id);
  const photo = await saveImage(fd.get("photo") as File | null);
  await db
    .update(schema.horses)
    .set({ ...horseFields(fd), ...(photo ? { photoUrl: photo.url } : {}) })
    .where(eq(schema.horses.id, id));
  revalidatePath(`/horses/${id}`);
  redirect(`/horses/${id}`);
}

export async function deleteHorse(id: string) {
  const user = await requireUser();
  await getOwnedHorse(user, id);
  await db.delete(schema.horses).where(eq(schema.horses.id, id));
  revalidatePath("/horses");
  redirect("/horses");
}

export async function updateListing(id: string, fd: FormData) {
  const user = await requireUser();
  await getOwnedHorse(user, id);
  await db
    .update(schema.horses)
    .set({
      listingType: str(fd, "listingType") ?? "NONE",
      price: num(fd, "price"),
      showPrice: fd.get("showPrice") === "on",
      budgetStars: num(fd, "budgetStars"),
    })
    .where(eq(schema.horses.id, id));
  revalidatePath(`/horses/${id}`);
  revalidatePath("/marketplace");
}

export async function addTrialSlot(id: string, fd: FormData) {
  const user = await requireUser();
  await getOwnedHorse(user, id);
  const start = date(fd, "start");
  const hours = num(fd, "hours") ?? 2;
  if (!start) return;
  await db.insert(schema.trialSlots).values({ horseId: id, start, end: new Date(start.getTime() + hours * 3_600_000) });
  revalidatePath(`/horses/${id}`);
}

export async function deleteTrialSlot(horseId: string, slotId: string) {
  const user = await requireUser();
  await getOwnedHorse(user, horseId);
  await db.delete(schema.trialSlots).where(and(eq(schema.trialSlots.id, slotId), eq(schema.trialSlots.horseId, horseId)));
  revalidatePath(`/horses/${horseId}`);
}

// ───── AI ─────

export async function valuationAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const user = await requireUser();
    const horse = await getOwnedHorse(user, String(fd.get("horseId")));
    const records = await db.query.healthRecords.findMany({ where: eq(schema.healthRecords.horseId, horse.id), orderBy: desc(schema.healthRecords.date) });
    const v = await valuateHorse(horse, records);
    await db.update(schema.horses).set({ aiValuationLow: v.low, aiValuationHigh: v.high }).where(eq(schema.horses.id, horse.id));
    revalidatePath(`/horses/${horse.id}`);
    return {
      text: `**Estimated value: ${egp(v.low)} - ${egp(v.high)}** (confidence: ${v.confidence})\n\n${v.summary}\n\n${v.factors.map((f) => `- ${f}`).join("\n")}\n\n_Suggested budget stars: ${starsFor(v.high)} of 5._`,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

function starsFor(price: number) {
  if (price < 300_000) return 1;
  if (price < 700_000) return 2;
  if (price < 1_200_000) return 3;
  if (price < 2_500_000) return 4;
  return 5;
}

export async function healthRiskAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const user = await requireUser();
    const horse = await getOwnedHorse(user, String(fd.get("horseId")));
    const records = await db.query.healthRecords.findMany({ where: eq(schema.healthRecords.horseId, horse.id), orderBy: desc(schema.healthRecords.date) });
    const feed = await db.query.feedPlans.findFirst({ where: and(eq(schema.feedPlans.horseId, horse.id), eq(schema.feedPlans.active, true)) });
    const notes = str(fd, "notes");
    const r = await healthRiskCheck(horse, records, feed ?? null, notes ? [notes] : []);
    const icon = r.riskLevel === "high" ? "🔴" : r.riskLevel === "medium" ? "🟠" : "🟢";
    return {
      text: `${icon} **Risk level: ${r.riskLevel.toUpperCase()}**${r.callVet ? "\n\n**Call your vet now.**" : ""}\n\n**Alerts**\n${r.alerts.map((a) => `- ${a}`).join("\n")}\n\n**Recommendations**\n${r.recommendations.map((a) => `- ${a}`).join("\n")}\n\n_AI advice only - always follow your vet's guidance._`,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function listingAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const user = await requireUser();
    const horse = await getOwnedHorse(user, String(fd.get("horseId")));
    const l = await writeListing(horse);
    if (fd.get("apply") === "on") {
      await db.update(schema.horses).set({ description: l.description }).where(eq(schema.horses.id, horse.id));
      revalidatePath(`/horses/${horse.id}`);
    }
    return { text: `**${l.title}**\n\n${l.description}${fd.get("apply") === "on" ? "\n\n_Saved as the horse's description._" : ""}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function gaitAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const user = await requireUser();
    const horse = await getOwnedHorse(user, String(fd.get("horseId")));
    const files = fd.getAll("frames").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4);
    if (!files.length) return { error: "Upload 1-4 photos or video frames of the horse moving." };
    const frames = (await Promise.all(files.map((f) => saveImage(f)))).filter((x) => x !== null);
    const result = await gaitAnalysis(horse, frames, str(fd, "context") ?? "");
    await db.insert(schema.gaitAnalyses).values({ horseId: horse.id, imageUrls: JSON.stringify(frames.map((f) => f.url)), result });
    revalidatePath(`/horses/${horse.id}`);
    return { text: result };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type ScanState = { data?: PassportScan; error?: string } | undefined;

export async function scanPassportAction(_: ScanState, fd: FormData): Promise<ScanState> {
  try {
    await requireUser();
    const files = fd.getAll("pages").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4);
    if (!files.length) return { error: "Choose one or more photos of the passport pages." };
    const pages = (await Promise.all(files.map((f) => saveImage(f)))).filter((x) => x !== null);
    return { data: await scanPassport(pages) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function triageAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const user = await requireUser();
    const horse = await getOwnedHorse(user, String(fd.get("horseId")));
    const description = str(fd, "description");
    if (!description) return { error: "Describe what you see." };
    const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
    const photos = (await Promise.all(files.map((f) => saveImage(f)))).filter((x) => x !== null);
    const records = await db.query.healthRecords.findMany({ where: eq(schema.healthRecords.horseId, horse.id), orderBy: desc(schema.healthRecords.date) });
    const text = await symptomTriage(horse, description, photos, records);
    if (fd.get("log") === "on") {
      await db.insert(schema.healthRecords).values({ horseId: horse.id, type: "OTHER", date: new Date(), notes: `Symptom reported: ${description}`, source: "ASSISTANT", attachmentUrl: photos[0]?.url ?? null });
      revalidatePath(`/horses/${horse.id}`);
    }
    return { text };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function trainingPlanAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const user = await requireUser();
    const horse = await getOwnedHorse(user, String(fd.get("horseId")));
    const gait = await db.query.gaitAnalyses.findFirst({ where: eq(schema.gaitAnalyses.horseId, horse.id), orderBy: desc(schema.gaitAnalyses.createdAt) });
    const notes = [str(fd, "notes"), gait ? `Latest gait analysis: ${gait.result.slice(0, 600)}` : null].filter(Boolean).join("\n");
    return { text: await trainingPlan(horse, str(fd, "goal") ?? "", num(fd, "days") ?? 5, notes) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
