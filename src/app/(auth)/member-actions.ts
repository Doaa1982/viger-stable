"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { homeFor, type StableRole } from "@/lib/access";
import { linkMembership } from "@/lib/members";
import { str } from "@/lib/utils";

export type JoinState = { error?: string } | undefined;

/** Create a member login, or sign in to an existing one with the same email. */
async function userForJoin(fd: FormData): Promise<{ id: string } | { error: string }> {
  const current = await getCurrentUser();
  if (current) return current;
  const name = str(fd, "name");
  const email = str(fd, "email")?.toLowerCase();
  const password = str(fd, "password");
  if (!name || !email || !password) return { error: "Please fill in your name, email and a password." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) {
    if (!(await verifyPassword(password, existing.passwordHash))) return { error: "An account with this email already exists. Enter its password to connect it." };
    return existing;
  }
  const [u] = await db.insert(schema.users).values({ name, email, phone: str(fd, "phone"), role: "MEMBER", passwordHash: await hashPassword(password) }).returning();
  return u;
}

export async function acceptInvite(token: string, _: JoinState, fd: FormData): Promise<JoinState> {
  const m = await db.query.memberships.findFirst({ where: eq(schema.memberships.inviteToken, token) });
  if (!m || m.status !== "INVITED") return { error: "This invite was already used or cancelled. Ask the stable for a new link." };
  if (m.inviteExpires && m.inviteExpires < new Date()) return { error: "This invite has expired. Ask the stable for a new link." };
  const u = await userForJoin(fd);
  if ("error" in u) return u;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, u.id) });
  if (user && user.role !== "MEMBER" && user.id === m.ownerId) return { error: "This is the stable owner's own account - sign out and open the link on the person's phone." };
  await db.update(schema.memberships).set({ userId: u.id, status: "ACTIVE", inviteToken: null, inviteExpires: null, email: m.email ?? user?.email ?? null }).where(eq(schema.memberships.id, m.id));
  await linkMembership({ ...m, userId: u.id, status: "ACTIVE" });
  await createSession(u.id);
  redirect(homeFor(m.role as StableRole));
}

const SELF_ROLES = ["CUSTOMER", "STUDENT", "HORSE_OWNER"];

export async function selfJoin(slug: string, _: JoinState, fd: FormData): Promise<JoinState> {
  const settings = await db.query.bookingSettings.findFirst({ where: eq(schema.bookingSettings.slug, slug) });
  if (!settings || !settings.isPublished) return { error: "This stable is not taking sign-ups right now." };
  const role = str(fd, "role") ?? "CUSTOMER";
  if (!SELF_ROLES.includes(role)) return { error: "Choose an account type." };
  if (!str(fd, "phone") || (str(fd, "phone") ?? "").replace(/\D/g, "").length < 8) return { error: "Please enter your phone / WhatsApp number with country code." };
  const u = await userForJoin(fd);
  if ("error" in u) return u;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, u.id) });
  if (user?.id === settings.ownerId) return { error: "You are the owner of this stable." };
  const existing = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.ownerId, settings.ownerId), eq(schema.memberships.userId, u.id)) });
  if (!existing) {
    const status = role === "CUSTOMER" ? "ACTIVE" : "PENDING"; // the stable approves students and horse owners
    const [m] = await db
      .insert(schema.memberships)
      .values({ ownerId: settings.ownerId, userId: u.id, role, name: user?.name ?? str(fd, "name") ?? "Rider", phone: str(fd, "phone"), email: user?.email ?? null, status })
      .returning();
    if (status === "ACTIVE") await linkMembership(m);
    // Let the stable know on its task list
    if (status === "PENDING") {
      await db.insert(schema.tasks).values({ ownerId: settings.ownerId, title: `Approve new ${role === "STUDENT" ? "riding student" : "horse owner"}: ${m.name} (People & access)`, category: "OTHER", priority: 2, dueAt: new Date() });
    }
  }
  await createSession(u.id);
  redirect("/me");
}
