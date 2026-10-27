import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/access";
import { AcceptForm } from "./accept-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const m = await db.query.memberships.findFirst({ where: eq(schema.memberships.inviteToken, token) });
  const owner = m ? await db.query.users.findFirst({ where: eq(schema.users.id, m.ownerId) }) : null;
  const valid = m && m.status === "INVITED" && (!m.inviteExpires || m.inviteExpires > new Date());
  const current = await getCurrentUser();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="text-xl font-bold text-forest-700">🐎 {owner?.name ?? "Viger Stable"}</div>
          {valid ? (
            <p className="mt-2 text-sm text-stone-600">
              Hello <strong>{m.name}</strong> - you&apos;re invited to join as <strong>{ROLE_LABEL[m.role]}</strong>. Create your login below.
            </p>
          ) : (
            <p className="mt-2 text-sm text-red-600">This invite link is not valid any more. Ask the stable to send a new one.</p>
          )}
        </div>
        {valid && <AcceptForm token={token} signedInAs={current ? `${current.name} (${current.email})` : null} defaults={{ name: m.name, email: m.email, phone: m.phone }} />}
        <p className="text-center text-xs text-stone-500">Already have a login? <Link href="/login" className="link">Sign in</Link>, then open this link again.</p>
      </div>
    </main>
  );
}
