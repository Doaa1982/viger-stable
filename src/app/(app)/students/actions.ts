"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/access";
import { riderProgressReport } from "@/lib/ai/features";
import type { AiState } from "@/components/ai-panel";
import { addDays, date, num, str } from "@/lib/utils";
import { LEVELS } from "@/lib/riders";

async function ownStudent(id: string) {
  const access = await requirePerm("students");
  const st = await db.query.students.findFirst({ where: and(eq(schema.students.id, id), eq(schema.students.ownerId, access.ownerId)) });
  if (!st) throw new Error("Student not found");
  return { ...access, st };
}

function studentFields(fd: FormData) {
  const level = str(fd, "level") ?? "BEGINNER";
  return {
    name: str(fd, "name") ?? "Student",
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    guardianName: str(fd, "guardianName"),
    birthYear: num(fd, "birthYear"),
    level: (LEVELS as readonly string[]).includes(level) ? level : "BEGINNER",
    goals: str(fd, "goals"),
    coachStaffId: str(fd, "coachStaffId"),
    notes: str(fd, "notes"),
  };
}

export async function addStudent(fd: FormData) {
  const { ownerId } = await requirePerm("students");
  const [st] = await db.insert(schema.students).values({ ...studentFields(fd), ownerId }).returning();
  redirect(`/students/${st.id}`);
}

export async function updateStudent(id: string, fd: FormData) {
  await ownStudent(id);
  await db.update(schema.students).set({ ...studentFields(fd), active: fd.get("active") === "on" }).where(eq(schema.students.id, id));
  revalidatePath(`/students/${id}`);
}

export async function addPackage(studentId: string, fd: FormData) {
  await ownStudent(studentId);
  const lessonsTotal = Math.max(1, num(fd, "lessonsTotal") ?? 10);
  const validDays = num(fd, "validDays");
  await db.insert(schema.lessonPackages).values({
    studentId,
    name: str(fd, "name") ?? `${lessonsTotal} lessons`,
    lessonsTotal,
    priceEgp: num(fd, "priceEgp") ?? 0,
    paid: fd.get("paid") === "on",
    purchasedAt: new Date(),
    expiresAt: validDays ? addDays(new Date(), validDays) : null,
  });
  revalidatePath(`/students/${studentId}`);
}

export async function markPackagePaid(studentId: string, packageId: string) {
  const { ownerId, st } = await ownStudent(studentId);
  const pkg = await db.query.lessonPackages.findFirst({ where: and(eq(schema.lessonPackages.id, packageId), eq(schema.lessonPackages.studentId, studentId)) });
  if (!pkg || pkg.paid) return;
  await db.update(schema.lessonPackages).set({ paid: true }).where(eq(schema.lessonPackages.id, packageId));
  await db.insert(schema.transactions).values({ ownerId, kind: "INCOME", category: "Lessons", amount: pkg.priceEgp, date: new Date(), description: `${pkg.name} - ${st.name}` });
  revalidatePath(`/students/${studentId}`);
}

/** Lessons already used (attended or no-show) per package. */
async function usedCount(packageId: string) {
  const rows = await db.query.lessons.findMany({ where: eq(schema.lessons.packageId, packageId) });
  return rows.filter((l) => l.status !== "CANCELLED").length;
}

export async function scheduleLesson(studentId: string, fd: FormData) {
  const { ownerId } = await ownStudent(studentId);
  const when = date(fd, "date");
  if (!when) return;
  // Use the oldest package that still has lessons left
  const pkgs = await db.query.lessonPackages.findMany({ where: eq(schema.lessonPackages.studentId, studentId), orderBy: schema.lessonPackages.purchasedAt });
  let packageId: string | null = null;
  for (const p of pkgs) {
    if ((p.expiresAt && p.expiresAt < when) || (await usedCount(p.id)) >= p.lessonsTotal) continue;
    packageId = p.id;
    break;
  }
  const coachStaffId = str(fd, "coachStaffId");
  const horseId = str(fd, "horseId");
  await db.insert(schema.lessons).values({ studentId, packageId, coachStaffId, horseId, date: when, durationMin: num(fd, "durationMin") ?? 45, focus: str(fd, "focus") });
  // Put it on the yard's task list so the horse is ready
  const st = await db.query.students.findFirst({ where: eq(schema.students.id, studentId) });
  await db.insert(schema.tasks).values({ ownerId, title: `Lesson: ${st?.name}${str(fd, "focus") ? ` - ${str(fd, "focus")}` : ""}`, category: "TRAINING", priority: 2, dueAt: when, horseId, staffId: coachStaffId });
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
}

export async function recordLesson(studentId: string, lessonId: string, fd: FormData) {
  await ownStudent(studentId);
  const status = str(fd, "status") ?? "ATTENDED";
  if (!["SCHEDULED", "ATTENDED", "NO_SHOW", "CANCELLED"].includes(status)) return;
  await db
    .update(schema.lessons)
    .set({ status, coachNotes: str(fd, "coachNotes"), rating: num(fd, "rating"), focus: str(fd, "focus") })
    .where(and(eq(schema.lessons.id, lessonId), eq(schema.lessons.studentId, studentId)));
  revalidatePath(`/students/${studentId}`);
}

export async function progressReportAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const { st, stableName } = await ownStudent(String(fd.get("studentId")));
    const lessons = await db.query.lessons.findMany({ where: eq(schema.lessons.studentId, st.id), with: { horse: true }, orderBy: desc(schema.lessons.date) });
    const text = await riderProgressReport(st, lessons.map((l) => ({ ...l, horse: l.horse?.name ?? null })), stableName);
    return { text };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
