import { schema } from "@/db";

export const LEVELS = ["BEGINNER", "NOVICE", "INTERMEDIATE", "ADVANCED"] as const;

type Pkg = typeof schema.lessonPackages.$inferSelect;
type Lesson = typeof schema.lessons.$inferSelect;

/** Lessons left in a package: scheduled, attended and no-shows all use a lesson; cancelled ones don't. */
export function packageBalance(pkg: Pkg, lessons: Lesson[]) {
  const used = lessons.filter((l) => l.packageId === pkg.id && l.status !== "CANCELLED").length;
  const expired = pkg.expiresAt ? pkg.expiresAt < new Date() : false;
  return { used, left: Math.max(0, pkg.lessonsTotal - used), expired };
}

export const LESSON_STATUS_TONE: Record<string, "blue" | "green" | "red" | "gray"> = { SCHEDULED: "blue", ATTENDED: "green", NO_SHOW: "red", CANCELLED: "gray" };
