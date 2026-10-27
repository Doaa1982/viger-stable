"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { rankApplicants } from "@/lib/ai/features";
import type { AiState } from "@/components/ai-panel";
import { str } from "@/lib/utils";

export async function createJob(fd: FormData) {
  const user = await requireUser();
  const title = str(fd, "title");
  const description = str(fd, "description");
  if (!title || !description) return;
  const [job] = await db
    .insert(schema.jobs)
    .values({ posterId: user.id, title, description, role: str(fd, "role") ?? "Groom", location: str(fd, "location"), salary: str(fd, "salary"), type: str(fd, "type") ?? "FULL_TIME" })
    .returning();
  redirect(`/jobs/${job.id}`);
}

export async function applyToJob(jobId: string, fd: FormData) {
  const user = await requireUser();
  const message = str(fd, "message");
  if (!message) return;
  await db.insert(schema.applications).values({ jobId, applicantId: user.id, message }).onConflictDoNothing();
  revalidatePath(`/jobs/${jobId}`);
}

export async function withdrawApplication(jobId: string) {
  const user = await requireUser();
  await db.delete(schema.applications).where(and(eq(schema.applications.jobId, jobId), eq(schema.applications.applicantId, user.id)));
  revalidatePath(`/jobs/${jobId}`);
}

async function ownJob(jobId: string) {
  const user = await requireUser();
  const job = await db.query.jobs.findFirst({ where: and(eq(schema.jobs.id, jobId), eq(schema.jobs.posterId, user.id)) });
  if (!job) throw new Error("Job not found");
  return job;
}

export async function setApplicationStatus(jobId: string, applicationId: string, status: string) {
  await ownJob(jobId);
  await db.update(schema.applications).set({ status }).where(and(eq(schema.applications.id, applicationId), eq(schema.applications.jobId, jobId)));
  revalidatePath(`/jobs/${jobId}`);
}

export async function toggleJobOpen(jobId: string) {
  const job = await ownJob(jobId);
  await db.update(schema.jobs).set({ open: !job.open }).where(eq(schema.jobs.id, jobId));
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

/** AI Enhancement: rank applicants against the job description. */
export async function rankApplicantsAction(_: AiState, fd: FormData): Promise<AiState> {
  try {
    const job = await ownJob(String(fd.get("jobId")));
    const apps = await db.query.applications.findMany({ where: eq(schema.applications.jobId, job.id), with: { applicant: true } });
    if (!apps.length) return { error: "No applicants yet." };
    const ranking = await rankApplicants(
      job,
      apps.map((a) => ({ id: a.id, name: a.applicant.name, city: a.applicant.city, bio: a.applicant.bio, message: a.message })),
    );
    for (const r of ranking) {
      await db.update(schema.applications).set({ aiScore: r.score, aiReason: r.reason }).where(eq(schema.applications.id, r.applicationId));
    }
    revalidatePath(`/jobs/${job.id}`);
    return { text: `Ranked ${ranking.length} applicant(s). Scores are shown next to each one - the decision is always yours.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
