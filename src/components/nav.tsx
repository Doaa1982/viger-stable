"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type NavGroup = { title: string; items: { href: string; label: string; ai?: boolean }[] };

export function Sidebar({ groups, userName, role, aiOn, logout }: { groups: NavGroup[]; userName: string; role: string; aiOn: boolean; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 md:hidden">
        <Link href="/dashboard" className="font-bold text-forest-700">🐎 Viger Stable</Link>
        <button className="btn-secondary btn-sm" onClick={() => setOpen(!open)}>Menu</button>
      </div>
      <aside className={cn("w-full shrink-0 border-r border-stone-200 bg-white md:sticky md:top-0 md:block md:h-screen md:w-60 md:overflow-y-auto", open ? "block" : "hidden")}>
        <div className="hidden px-5 py-5 md:block">
          <Link href="/dashboard" className="text-lg font-bold text-forest-700">🐎 Viger Stable</Link>
        </div>
        <nav className="space-y-5 px-3 pb-6" onClick={() => setOpen(false)}>
          {groups.map((g) => (
            <div key={g.title}>
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{g.title}</div>
              {g.items.map((i) => {
                const active = path === i.href || (i.href !== "/dashboard" && path.startsWith(i.href + "/"));
                return (
                  <Link key={i.href} href={i.href} className={cn("flex items-center justify-between rounded-md px-2 py-1.5 text-sm", active ? "bg-emerald-50 font-medium text-forest-700" : "text-stone-700 hover:bg-stone-50")}>
                    {i.label}
                    {i.ai && <span className="text-xs text-violet-600">✦</span>}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="border-t border-stone-100 px-2 pt-4 text-xs text-stone-500">
            <div className="font-medium text-stone-700">{userName}</div>
            <div>{role}</div>
            <div className={cn("mt-2 inline-block rounded px-1.5 py-0.5", aiOn ? "bg-violet-100 text-violet-800" : "bg-amber-100 text-amber-800")}>
              {aiOn ? "✦ AI connected" : "AI demo mode"}
            </div>
            <form action={logout} className="mt-3">
              <button className="link">Sign out</button>
            </form>
          </div>
        </nav>
      </aside>
    </>
  );
}
