/** Weeks start on Saturday (Egyptian working week). */
export function weekStart(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 1) % 7; // days since Saturday
  d.setDate(d.getDate() - diff + offset * 7);
  return d;
}
export const DAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
