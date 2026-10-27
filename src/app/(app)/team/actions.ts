"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm, RIDER_ROLES, STAFF_ROLES } from "@/lib/access";
import { linkMembership, newInviteToken } from "@/lib/members";
import { str } from "@/lib/utils";

const ROLES = [...STAFF_ROLES, ...RIDER_ROLES] as string[];
const INVITE_DAYS = 14;

export type TeamState = { error?: string; ok?: string } | undefined;

export async function addPerson(_: TeamState, fd: FormData): Promise<TeamState> {
  const { ownerId } = await requirePerm("team");
  const name = str(fd, "name");
  const role = str(fd, "role") ?? "";
  if (!name) return { error: "Enter a name." };
  if (!ROLES.includes(role)) return { error: "Choose a role." };
  const [m] = await db
    .insert(schema.memberships)
    .values({
      ownerId,
      name,
      role,
      phone: str(fd, "phone"),
      email: str(fd, "email")?.toLowerCase() ?? null,
      status: "INVITED",
      inviteToken: newInviteToken(),
      inviteExpires: new Date(Date.now() + INVITE_DAYS * 86_400_000),
    })
    .returning();
  await linkMembership(m);
  revalidatePath("/team");
  return { ok: `${name} added. Send them the invite link below.` };
}

async function own(id: string) {
  const { ownerId } = await requirePerm("team");
  const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.id, id), eq(schema.memberships.ownerId, ownerId)) });
  if (!m) throw new Error("Person not found");
  return m;
}

export async function newInviteLink(id: string) {
  await own(id);
  await db
    .update(schema.memberships)
    .set({ inviteToken: newInviteToken(), inviteExpires: new Date(Date.now() + INVITE_DAYS * 86_400_000) })
    .where(eq(schema.memberships.id, id));
  revalidatePath("/team");
}

export async function setMemberStatus(id: string, status: "ACTIVE" | "DISABLED") {
  const m = await own(id);
  if (status === "ACTIVE" && !m.userId) return; // they must accept the invite first
  await db.update(schema.memberships).set({ status }).where(eq(schema.memberships.id, id));
  if (status === "ACTIVE") await linkMembership({ ...m, status });
  revalidatePath("/team");
}

export async function changeRole(id: string, fd: FormData) {
  const m = await own(id);
  const role = str(fd, "role") ?? m.role;
  if (!ROLES.includes(role)) return;
  await db.update(schema.memberships).set({ role }).where(eq(schema.memberships.id, id));
  await linkMembership({ ...m, role });
  revalidatePath("/team");
}

export async function removePerson(id: string) {
  await own(id);
  await db.delete(schema.memberships).where(eq(schema.memberships.id, id));
  revalidatePath("/team");
}
