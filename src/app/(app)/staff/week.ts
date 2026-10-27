import { addDays, startOfDay, zonedWeekday } from "@/lib/utils";

/** Weeks start on Saturday (Egyptian working week), in the stable's time zone. */
export function weekStart(offset = 0) {
  const today = startOfDay();
  const diff = (zonedWeekday(today) + 1) % 7; // days since Saturday
  return startOfDay(addDays(today, -diff + offset * 7 + 0.5)); // +0.5 day guards against DST shifts
}
export const DAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
