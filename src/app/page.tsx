import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";

const features = [
  { t: "Run your yard", d: "Daily tasks, staff rota and time clock, health records, feeding plans, stall board, livery billing and finance in EGP." },
  { t: "Horse marketplace", d: "Horse profiles, private pricing with budget stars, trial booking, and AI search that understands plain language." },
  { t: "Breeding & stud", d: "Season board for every mare, foaling dates, and an AI mating advisor that flags inbreeding risk." },
  { t: "Online booking", d: "A public page where Egyptians and tourists book rides, lessons, camel tours and livery - prices in EGP and USD." },
  { t: "Community", d: "The Arena feed, direct messages with horse cards, professional bookings and an equestrian jobs board." },
];

const ai = [
  "AI Yard Assistant - ask or tell it anything about your yard",
  "AI Health Early-Warning - spots risks before they become vet bills",
  "AI Horse Valuation and listing writer",
  "AI Ride & Gait Analysis from photos",
  "Smart Scan - photograph a vet card, the record fills itself",
  "AI feeding plans, rota builder, job matching and daily briefing",
];

export default async function Landing() {
  if (await getUserId()) redirect("/dashboard");
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-xl font-bold text-forest-700">🐎 Viger Stable</div>
        <nav className="flex gap-3">
          <Link href="/login" className="btn-secondary">Sign in</Link>
          <Link href="/register" className="btn-primary">Start free</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-600">Made in Egypt for the horse world</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">The equestrian platform that thinks with you.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-stone-600">
          Manage your stable, care for your horses, sell with confidence and connect with riders and professionals - with AI working in every corner.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">Create a free account</Link>
          <Link href="/login" className="btn-secondary px-6 py-3 text-base">Try the demo</Link>
        </div>
        <p className="mt-3 text-xs text-stone-500">Demo login: demo@vigerstable.com / password123</p>
        <p className="mt-2 text-sm"><Link href="/s/viger-stable" className="link">See a stable&apos;s public booking page →</Link></p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 md:grid-cols-5">
        {features.map((f) => (
          <div key={f.t} className="card">
            <h3 className="font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm text-stone-600">{f.d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto my-16 max-w-6xl px-6">
        <div className="rounded-2xl bg-gradient-to-br from-violet-700 to-indigo-800 p-8 text-white md:p-12">
          <h2 className="text-2xl font-bold text-white">✦ AI in every module</h2>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {ai.map((a) => (
              <li key={a} className="rounded-lg bg-white/10 px-4 py-3 text-sm">{a}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-stone-200 py-8 text-center text-xs text-stone-500">© {new Date().getFullYear()} Viger Stable</footer>
    </main>
  );
}
