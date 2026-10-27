"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { ROLES, TRADES, str } from "@/lib/utils";

export type AuthState = { error?: string } | undefined;

export async function login(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = str(fd, "email")?.toLowerCase();
  const password = str(fd, "password");
  if (!email || !password) return { error: "Enter your email and password." };
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "Wrong email or password." };
  await createSession(user.id);
  redirect("/dashboard");
}

export async function register(_: AuthState, fd: FormData): Promise<AuthState> {
  const name = str(fd, "name");
  const email = str(fd, "email")?.toLowerCase();
  const password = str(fd, "password");
  const role = str(fd, "role") ?? "STABLE";
  const trade = str(fd, "trade");
  if (!name || !email || !password) return { error: "Please fill in all fields." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!ROLES.includes(role as (typeof ROLES)[number])) return { error: "Choose an account type." };
  if (role === "PROFESSIONAL" && !TRADES.includes(trade as (typeof TRADES)[number])) return { error: "Choose your trade." };
  const exists = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (exists) return { error: "An account with this email already exists." };
  const [user] = await db
    .insert(schema.users)
    .values({ name, email, role, trade: role === "PROFESSIONAL" ? trade : null, city: str(fd, "city"), passwordHash: await hashPassword(password) })
    .returning();
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
