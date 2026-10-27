import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { AiPanel } from "@/components/ai-panel";
import { SubmitButton } from "@/components/client";
import { AiTag, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate, label } from "@/lib/utils";
import { applyToJob, rankApplicantsAction, setApplicationStatus, toggleJobOpen, withdrawApplication } from "../actions";

const tone = (s: string) => (s === "ACCEPTED" ? "green" : s === "SHORTLISTED" ? "blue" : s === "DECLINED" ? "gray" : "amber");

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, id), with: { poster: true } });
  if (!job) notFound();
  const isOwner = job.posterId === user.id;
  const apps = await db.query.applications.findMany({ where: eq(schema.applications.jobId, id), with: { applicant: true }, orderBy: desc(schema.applications.aiScore) });
  const mine = apps.find((a) => a.applicantId === user.id);

  return (
    <div>
      <PageHeader
        title={job.title}
        subtitle={`${job.poster.name} · ${job.location ?? "Egypt"} · ${label(job.type)}`}
        actions={isOwner && <form action={toggleJobOpen.bind(null, job.id)}><button className="btn-secondary">{job.open ? "Close job" : "Reopen job"}</button></form>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {job.salary && <p className="mb-2 font-medium">{job.salary}</p>}
          <p className="whitespace-pre-line text-sm">{job.description}</p>
          <p className="mt-4 text-xs text-stone-400">Posted {fmtDate(job.createdAt)}</p>
        </Card>
        {!isOwner && (
          <Card title="Apply">
            {mine ? (
              <div className="space-y-3 text-sm">
                <p>You applied on {fmtDate(mine.createdAt)}.</p>
                <Badge tone={tone(mine.status)}>{label(mine.status)}</Badge>
                <form action={withdrawApplication.bind(null, job.id)}><button className="text-xs text-red-600">Withdraw application</button></form>
              </div>
            ) : job.open ? (
              <form action={applyToJob.bind(null, job.id)} className="space-y-3">
                <textarea name="message" rows={5} className="input" placeholder="Your experience and why you are a good fit" required />
                <SubmitButton>Send application</SubmitButton>
              </form>
            ) : (
              <p className="text-sm text-stone-500">This job is closed.</p>
            )}
          </Card>
        )}
      </div>
      {isOwner && (
        <Card title={`Applicants (${apps.length})`} className="mt-6" actions={<AiTag />}>
          <div className="mb-4">
            <AiPanel action={rankApplicantsAction} button="Rank applicants with AI" hidden={{ jobId: job.id }} />
          </div>
          {apps.length === 0 ? <Empty>No applicants yet.</Empty> : (
            <ul className="space-y-3">
              {apps.map((a) => (
                <li key={a.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong>{a.applicant.name}</strong> <span className="text-stone-500">{a.applicant.city}</span>
                      {a.aiScore != null && <span className="ml-2 badge bg-violet-100 text-violet-800">✦ {a.aiScore}/100</span>}
                    </div>
                    <Badge tone={tone(a.status)}>{label(a.status)}</Badge>
                  </div>
                  <p className="mt-1 text-stone-700">{a.message}</p>
                  {a.aiReason && <p className="mt-1 text-xs text-violet-700">✦ {a.aiReason}</p>}
                  <div className="mt-2 flex gap-2">
                    {([["SHORTLISTED", "Shortlist"], ["ACCEPTED", "Accept"], ["DECLINED", "Decline"]] as const).map(([s, text]) => (
                      <form key={s} action={setApplicationStatus.bind(null, job.id, a.id, s)}>
                        <button className={s === "ACCEPTED" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{text}</button>
                      </form>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
