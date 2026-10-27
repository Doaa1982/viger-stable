export const CURRENCY = "EGP";

/** All dates are shown and entered in the stable's time zone (Egypt), whatever the server's clock. */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || process.env.APP_TIMEZONE || "Africa/Cairo";

function tzParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { y: +get("year"), m: +get("month"), d: +get("day"), h: +get("hour"), min: +get("minute"), s: +get("second"), weekday: get("weekday") };
}

/** Turn a wall-clock time in the stable's time zone ("2026-10-27" or "2026-10-27T10:00") into a real Date. */
export function zonedDate(value: string): Date | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, da, h = "0", mi = "0"] = m;
  const guess = Date.UTC(+y, +mo - 1, +da, +h, +mi);
  // Find the zone offset at that moment and correct for it (twice handles DST edges)
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const p = tzParts(new Date(t));
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    t = guess - (asUtc - t);
  }
  return new Date(t);
}

/** Day of week in the stable's time zone: 0 = Sunday ... 6 = Saturday. */
export function zonedWeekday(d = new Date()) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(tzParts(d).weekday);
}

export function egp(amount: number | null | undefined) {
  if (amount == null) return "—";
  return `${new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(amount)} EGP`;
}

export function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIMEZONE }).format(d);
}

export function fmtDateTime(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: APP_TIMEZONE,
  }).format(d);
}

export function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: APP_TIMEZONE }).format(d);
}

export function age(birthYear: number | null | undefined) {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}

export function daysUntil(d: Date) {
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/** Midnight (in the stable's time zone) of the day containing d. */
export function startOfDay(d = new Date()) {
  return zonedDate(ymd(d))!;
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Read a string field from FormData ("" becomes null). */
export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Read a date / datetime-local field, interpreted in the stable's time zone. */
export function date(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  return v ? zonedDate(v) : null;
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const HEALTH_TYPES = [
  "VACCINATION",
  "WORMING",
  "DENTAL",
  "FARRIER",
  "TREATMENT",
  "BLOOD_TEST",
  "VET_VISIT",
  "INJURY",
  "OTHER",
] as const;

export const ROLES = ["STABLE", "RIDER", "PROFESSIONAL", "FAN"] as const;
export const TRADES = ["VET", "FARRIER", "COACH", "GROOM", "TRANSPORTER", "BODYWORKER", "OTHER"] as const;
export const DISCIPLINES = ["Show jumping", "Dressage", "Endurance", "Polo", "Racing", "Eventing", "Leisure", "Breeding"];

export function label(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** YYYY-MM-DD in the server's local time zone (toISOString would shift to UTC). */
export function ymd(d: Date) {
  const p = tzParts(d);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** "YYYY-MM-DDTHH:MM" in the stable's time zone (for datetime-local inputs and AI prompts). */
export function ymdhm(d: Date) {
  const p = tzParts(d);
  return `${ymd(d)}T${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`;
}
