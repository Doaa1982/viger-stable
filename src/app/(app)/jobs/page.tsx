import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/client";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate, label } from "@/lib/utils";
import { createJob } from "./actions";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const user = await requireUser();
  const { role } = await searchParams;
  let jobs = await db.query.jobs.findMany({ with: { poster: true, applications: true }, orderBy: desc(schema.jobs.createdAt) });
  if (role) jobs = jobs.filter((j) => j.role === role);
  const roles = [...new Set(jobs.map((j) => j.role))];
  const canPost = user.role !== "FAN";
  return (
    <div>
      <PageHeader title="Jobs & talent" subtitle="Work with horses across Egypt" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/jobs" className={!role ? "font-semibold" : "link"}>All</Link>
            {roles.map((r) => <Link key={r} href={`/jobs?role=${encodeURIComponent(r)}`} className={role === r ? "font-semibold" : "link"}>{r}</Link>)}
          </div>
          {jobs.length === 0 && <Empty>No jobs posted yet.</Empty>}
          {jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="card block hover:border-forest-500">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{j.title}</h3>
                {j.open ? <Badge tone="green">Open</Badge> : <Badge>Closed</Badge>}
              </div>
              <p className="text-sm text-stone-500">{j.poster.name} · {j.location ?? "Egypt"} · {label(j.type)} · {fmtDate(j.createdAt)}</p>
              {j.salary && <p className="mt-1 text-sm">{j.salary}</p>}
              <p className="mt-2 line-clamp-2 text-sm text-stone-600">{j.description}</p>
              {j.posterId === user.id && <p className="mt-2 text-xs text-forest-600">{j.applications.length} applicant(s)</p>}
            </Link>
          ))}
        </div>
        {canPost && (
          <Card title="Post a job">
            <form action={createJob} className="space-y-3">
              <input name="title" className="input" placeholder="Job title" required />
              <div className="grid grid-cols-2 gap-2">
                <input name="role" className="input" placeholder="Role (Groom, Rider…)" />
                <select name="type" className="input">{["FULL_TIME", "PART_TIME", "SEASONAL", "FREELANCE"].map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
                <input name="location" className="input" placeholder="Location" />
                <input name="salary" className="input" placeholder="Salary (EGP)" />
              </div>
              <textarea name="description" rows={4} className="input" placeholder="Duties, experience needed, accommodation…" required />
              <SubmitButton>Post job</SubmitButton>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
