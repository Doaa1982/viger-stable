import { headers } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { RIDER_ROLES, ROLE_LABEL, STAFF_ROLES, requirePerm } from "@/lib/access";
import { whatsappLink } from "@/lib/booking";
import { ConfirmButton } from "@/components/client";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { AddPersonForm } from "./add-form";
import { CopyButton } from "./copy-button";
import { changeRole, newInviteLink, removePerson, setMemberStatus } from "./actions";

const STATUS_TONE: Record<string, "amber" | "green" | "gray" | "blue"> = { INVITED: "blue", PENDING: "amber", ACTIVE: "green", DISABLED: "gray" };
const STATUS_TEXT: Record<string, string> = { INVITED: "Invite sent", PENDING: "Waiting for approval", ACTIVE: "Active", DISABLED: "Disabled" };

export default async function TeamPage() {
  const { ownerId, stableName } = await requirePerm("team");
  const people = await db.query.memberships.findMany({ where: eq(schema.memberships.ownerId, ownerId), with: { user: true }, orderBy: asc(schema.memberships.createdAt) });
  const settings = await db.query.bookingSettings.findFirst({ where: eq(schema.bookingSettings.ownerId, ownerId) });
  const host = (await headers()).get("host") ?? "viger-stable.vercel.app";
  const origin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const pending = people.filter((p) => p.status === "PENDING");

  const section = (title: string, roles: readonly string[]) => {
    const list = people.filter((p) => roles.includes(p.role));
    return (
      <Card title={`${title} (${list.length})`}>
        {list.length === 0 ? <Empty>Nobody yet.</Empty> : (
          <ul className="divide-y divide-stone-100">
            {list.map((p) => {
              const link = p.inviteToken ? `${origin}/invite/${p.inviteToken}` : null;
              const expired = p.inviteExpires && p.inviteExpires < new Date();
              const wa = link && whatsappLink(p.phone, `Hello ${p.name}, you're invited to ${stableName} on Viger Stable as ${ROLE_LABEL[p.role]}. Open this link to create your login: ${link}`);
              return (
                <li key={p.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong>{p.name}</strong> <span className="text-stone-500">· {ROLE_LABEL[p.role]}</span>
                      <div className="text-xs text-stone-500">{[p.phone, p.email, p.user && `login: ${p.user.email}`].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[p.status]}>{STATUS_TEXT[p.status]}</Badge>
                      <form action={changeRole.bind(null, p.id)} className="flex gap-1">
                        <select name="role" defaultValue={p.role} className="input w-auto py-1 text-xs">
                          {[...STAFF_ROLES, ...RIDER_ROLES].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                        <button className="btn-secondary btn-sm">Save</button>
                      </form>
                      {p.status === "PENDING" && <form action={setMemberStatus.bind(null, p.id, "ACTIVE")}><button className="btn-primary btn-sm">Approve</button></form>}
                      {p.status === "ACTIVE" && <form action={setMemberStatus.bind(null, p.id, "DISABLED")}><button className="btn-secondary btn-sm">Disable</button></form>}
                      {p.status === "DISABLED" && p.userId && <form action={setMemberStatus.bind(null, p.id, "ACTIVE")}><button className="btn-secondary btn-sm">Enable</button></form>}
                      <form action={removePerson.bind(null, p.id)}><ConfirmButton message={`Remove ${p.name}? They will lose access.`} className="text-xs text-red-600">Remove</ConfirmButton></form>
                    </div>
                  </div>
                  {p.status === "INVITED" && link && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 p-2">
                      <span className="break-all font-mono text-xs">{link}</span>
                      {expired ? <Badge tone="red">expired</Badge> : <span className="text-xs text-stone-500">valid until {fmtDate(p.inviteExpires)}</span>}
                      <CopyButton text={link} />
                      {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700">Send on WhatsApp</a>}
                      <form action={newInviteLink.bind(null, p.id)}><button className="btn-secondary btn-sm">New link</button></form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="People & access" subtitle="Staff logins and rider accounts - each person only sees what their role allows" />
      {pending.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><strong>{pending.length}</strong> sign-up(s) waiting for your approval below.</div>}
      <Card title="Add a person">
        <AddPersonForm />
        {settings && <p className="mt-4 text-xs text-stone-500">Customers, students and horse owners can also sign up themselves at <span className="font-mono">{origin}/s/{settings.slug}/join</span>. Students and horse owners wait for your approval.</p>}
      </Card>
      {section("Staff", STAFF_ROLES)}
      {section("Riders & customers", RIDER_ROLES)}
      <Card title="What each role can see">
        <table className="table text-xs">
          <thead><tr><th>Role</th><th>Can see / do</th></tr></thead>
          <tbody>
            <tr><td>Owner (you)</td><td>Everything, including prices, finance and this page</td></tr>
            <tr><td>Yard manager</td><td>Dashboard, tasks, horses, health, feeding, yard board, staff rota, breeding, customer bookings, riding school, AI assistant</td></tr>
            <tr><td>Coach</td><td>Riding school (students, lessons), horses, tasks, health, feeding, AI assistant, own shifts</td></tr>
            <tr><td>Groom / Staff rider</td><td>Tasks, horses (view), health logs, feeding, yard board, own shifts and clock in/out</td></tr>
            <tr><td>Riding student</td><td>Own lessons, package balance, coach notes and progress</td></tr>
            <tr><td>Horse owner</td><td>Own horses: health records, feeding plan, invoices</td></tr>
            <tr><td>Customer</td><td>Own bookings, rebook, leave a review</td></tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
