import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "warn" | "good" }) {
  return (
    <div className="card">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold", tone === "warn" && "text-red-600", tone === "good" && "text-forest-600")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  gray: "bg-stone-100 text-stone-700",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-sky-100 text-sky-800",
  violet: "bg-violet-100 text-violet-800",
};

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={cn("badge", TONES[tone])}>{children}</span>;
}

/** Marks a feature as AI, matching the business plan tags. */
export function AiTag({ kind = "enhancement" }: { kind?: "enhancement" | "added" }) {
  return (
    <span className="badge bg-violet-100 text-violet-800" title={kind === "added" ? "New AI service" : "Feature improved with AI"}>
      ✦ {kind === "added" ? "AI Added Service" : "AI Enhancement"}
    </span>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="lbl">{label}</span>
      {children}
    </label>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string }[]; active: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-stone-100 p-1 text-sm">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={cn("rounded-md px-3 py-1.5", active === i.href ? "bg-white font-medium shadow-sm" : "text-stone-600 hover:text-stone-900")}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function Stars({ n }: { n: number | null | undefined }) {
  if (!n) return null;
  return (
    <span className="text-amber-500" title={`Budget bracket ${n} of 5`}>
      {"★".repeat(n)}
      <span className="text-stone-300">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function HorseAvatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} className="rounded-lg object-cover" style={{ width: size, height: size }} />;
  return (
    <div className="flex items-center justify-center rounded-lg bg-brand-200 font-bold text-brand-800" style={{ width: size, height: size, fontSize: size / 2.6 }}>
      {name.slice(0, 1)}
    </div>
  );
}
