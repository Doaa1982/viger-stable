import "server-only";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";
import { requireUser, type CurrentUser } from "@/lib/auth";

/**
 * Who can do what at a stable.
 *  OWNER       - the stable account (your brother): everything
 *  MANAGER     - runs the yard and bookings, no prices / finance / team
 *  COACH       - students & lessons, horses, tasks
 *  GROOM       - tasks, feeding, health logs, yard board
 *  STAFF_RIDER - like a groom, plus training
 *  STUDENT / CUSTOMER / HORSE_OWNER - only their own portal (/me)
 */
export type StableRole = "OWNER" | "MANAGER" | "COACH" | "GROOM" | "STAFF_RIDER" | "STUDENT" | "CUSTOMER" | "HORSE_OWNER";

export const STAFF_ROLES = ["MANAGER", "COACH", "GROOM", "STAFF_RIDER"] as const;
export const RIDER_ROLES = ["STUDENT", "CUSTOMER", "HORSE_OWNER"] as const;
export const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Yard manager",
  COACH: "Coach",
  GROOM: "Groom",
  STAFF_RIDER: "Staff rider",
  STUDENT: "Riding student",
  CUSTOMER: "Customer",
  HORSE_OWNER: "Horse owner (livery)",
};

const ALL_STAFF: StableRole[] = ["OWNER", "MANAGER", "COACH", "GROOM", "STAFF_RIDER"];

export const PERMISSIONS = {
  yard: ALL_STAFF, // dashboard, tasks, horses (view), health, feeding, yard board
  horsesEdit: ["OWNER", "MANAGER"],
  breeding: ["OWNER", "MANAGER"],
  staffRota: ["OWNER", "MANAGER"],
  finance: ["OWNER"],
  bookingSettings: ["OWNER"], // prices, services, payment details
  customerBookings: ["OWNER", "MANAGER"],
  students: ["OWNER", "MANAGER", "COACH"],
  team: ["OWNER"],
  assistant: ["OWNER", "MANAGER", "COACH"],
  marketplace: ["OWNER", "MANAGER"],
  portal: ["STUDENT", "CUSTOMER", "HORSE_OWNER", "GROOM", "STAFF_RIDER", "COACH", "MANAGER"],
} satisfies Record<string, StableRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export type Access = {
  user: CurrentUser;
  ownerId: string; // whose stable data this person works with
  role: StableRole;
  membership: typeof schema.memberships.$inferSelect | null;
  stableName: string;
  can: (p: Permission) => boolean;
};

/** Work out the signed-in person's stable and role. Cached per request. */
export const getAccess = cache(async (): Promise<Access> => {
  const user = await requireUser();
  // Stable / rider / professional accounts own their own workspace
  let role: StableRole = "OWNER";
  let ownerId = user.id;
  let stableName = user.name;
  let membership: Access["membership"] = null;
  if (user.role === "MEMBER") {
    membership =
      (await db.query.memberships.findFirst({
        where: and(eq(schema.memberships.userId, user.id), eq(schema.memberships.status, "ACTIVE")),
        orderBy: asc(schema.memberships.createdAt),
      })) ?? null;
    if (membership) {
      role = membership.role as StableRole;
      ownerId = membership.ownerId;
      const owner = await db.query.users.findFirst({ where: eq(schema.users.id, ownerId) });
      stableName = owner?.name ?? "Stable";
    } else {
      role = "CUSTOMER"; // signed up but not approved yet
    }
  }
  const can = (p: Permission) => (PERMISSIONS[p] as StableRole[]).includes(role);
  return { user, ownerId, role, membership, stableName, can };
});

/** Use in pages and server actions: returns access or sends the person to their home page. */
export async function requirePerm(p: Permission): Promise<Access> {
  const access = await getAccess();
  if (!access.can(p)) redirect(homeFor(access.role));
  return access;
}

export function homeFor(role: StableRole) {
  return RIDER_ROLES.includes(role as (typeof RIDER_ROLES)[number]) ? "/me" : "/dashboard";
}

export function isStaffRole(role: string) {
  return (STAFF_ROLES as readonly string[]).includes(role);
}
