import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { aiEnabled, aiModelName, aiProvider } from "@/lib/ai/client";
import { AiTag, Card, PageHeader } from "@/components/ui";

const FEATURES: { name: string; kind: "added" | "enhancement"; where: string; href: string; what: string }[] = [
  { name: "AI Yard Assistant", kind: "added", where: "AI Assistant", href: "/assistant", what: "Chat with your yard: answers questions and logs updates, tasks and health events." },
  { name: "Daily briefing", kind: "enhancement", where: "Dashboard", href: "/dashboard", what: "Writes the morning plan from tasks, health calendar, trials and rota." },
  { name: "Health Early-Warning", kind: "added", where: "Each horse", href: "/horses", what: "Flags overdue care, recurring injuries and seasonal risks." },
  { name: "Symptom Triage", kind: "added", where: "Each horse", href: "/horses", what: "How urgent is it? First-aid steps while waiting for the vet." },
  { name: "Horse Valuation", kind: "added", where: "Each horse", href: "/horses", what: "Estimated market value in EGP and suggested budget stars." },
  { name: "Listing Writer", kind: "added", where: "Each horse", href: "/horses", what: "Writes an honest sale or lease advert." },
  { name: "Ride & Gait Analysis", kind: "added", where: "Each horse", href: "/horses", what: "Assesses rhythm, symmetry and balance from photos or video frames." },
  { name: "Training Planner", kind: "added", where: "Each horse", href: "/horses", what: "A weekly plan built from level, goal and gait analysis." },
  { name: "Passport scan", kind: "enhancement", where: "Add horse", href: "/horses/new", what: "Reads passports and FEI cards (Arabic or English) into the horse profile." },
  { name: "Smart Scan", kind: "enhancement", where: "Health Hub", href: "/health", what: "Photo of a vet card or invoice becomes a health record." },
  { name: "AI feeding plans", kind: "enhancement", where: "Feeding", href: "/feeding", what: "Nutrition plan from weight, workload, season and local feeds." },
  { name: "AI rota builder", kind: "enhancement", where: "Staff & rota", href: "/staff", what: "Fair weekly schedule covering early feeds and late checks." },
  { name: "Turnout groups", kind: "enhancement", where: "Yard board", href: "/yard-board", what: "Safe paddock groups that respect conflicts." },
  { name: "Finance insights", kind: "enhancement", where: "Finance", href: "/finance", what: "Plain-language review and next-month forecast." },
  { name: "Mating Advisor", kind: "added", where: "Breeding", href: "/breeding", what: "Ranks stallions for a mare and flags inbreeding risk." },
  { name: "AI search", kind: "enhancement", where: "Marketplace", href: "/marketplace", what: "Describe the horse you want in plain words." },
  { name: "Visit notes → record + invoice", kind: "enhancement", where: "Bookings (professionals)", href: "/bookings", what: "Rough notes become a health record, invoice and owner summary." },
  { name: "Applicant ranking", kind: "enhancement", where: "Jobs", href: "/jobs", what: "Scores applicants against the job, fairly." },
];

export default async function AiCenter() {
  await requireUser();
  return (
    <div>
      <PageHeader title="AI Center" subtitle={aiEnabled() ? `AI is connected (${aiProvider() === "gemini" ? "Google Gemini" : "Anthropic Claude"} · ${aiModelName()}).` : "Demo mode: every feature works with sample answers. Add GEMINI_API_KEY (free in Google AI Studio) or ANTHROPIC_API_KEY to .env for real AI."} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.name}>
            <div className="mb-2"><AiTag kind={f.kind} /></div>
            <h3 className="font-semibold">{f.name}</h3>
            <p className="mt-1 text-sm text-stone-600">{f.what}</p>
            <Link href={f.href} className="link mt-3 inline-block text-sm">Open in {f.where} →</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
