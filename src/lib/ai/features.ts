import "server-only";
import { aiEnabled, askJson, askText } from "./client";
import type { SavedUpload } from "@/lib/uploads";
import type { schema } from "@/db";
import { age, label } from "@/lib/utils";

type Horse = typeof schema.horses.$inferSelect;
type Health = typeof schema.healthRecords.$inferSelect;
type Feed = typeof schema.feedPlans.$inferSelect;

function horseFacts(h: Horse) {
  return [
    `Name: ${h.name}`,
    h.breed && `Breed: ${h.breed}`,
    h.sex && `Sex: ${label(h.sex)}`,
    h.birthYear && `Age: ${age(h.birthYear)} years`,
    h.heightCm && `Height: ${h.heightCm} cm`,
    h.weightKg && `Weight: ${h.weightKg} kg`,
    h.color && `Colour: ${h.color}`,
    h.discipline && `Discipline: ${h.discipline}`,
    h.level && `Level: ${h.level}`,
    h.temperament && `Temperament: ${h.temperament}`,
    (h.sire || h.dam) && `Pedigree: by ${h.sire ?? "unknown"} out of ${h.dam ?? "unknown"}${h.damSire ? ` (dam sire ${h.damSire})` : ""}`,
    h.feiId && `FEI ID: ${h.feiId}`,
    h.description && `Owner notes: ${h.description}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function healthFacts(records: Health[]) {
  if (!records.length) return "No health records logged.";
  return records
    .slice(0, 25)
    .map(
      (r) =>
        `- ${r.date.toISOString().slice(0, 10)} ${label(r.type)}${r.provider ? ` by ${r.provider}` : ""}${r.notes ? `: ${r.notes}` : ""}${r.nextDue ? ` (next due ${r.nextDue.toISOString().slice(0, 10)})` : ""}`,
    )
    .join("\n");
}

// ───────────── 1. AI Horse Valuation (AI Added Service) ─────────────

export type Valuation = { low: number; high: number; confidence: "low" | "medium" | "high"; factors: string[]; summary: string };

export async function valuateHorse(h: Horse, records: Health[]): Promise<Valuation> {
  if (!aiEnabled()) return demoValuation(h);
  return askJson<Valuation>({
    system: "You are an experienced equine appraiser for the Egyptian and Middle East market.",
    prompt: `Estimate a fair market value range in EGP for this horse.

${horseFacts(h)}

Health history:
${healthFacts(records)}

Return JSON: {"low": number, "high": number, "confidence": "low"|"medium"|"high", "factors": [up to 5 short strings explaining what moves the price up or down], "summary": "2 sentences"}`,
  });
}

function demoValuation(h: Horse): Valuation {
  const a = age(h.birthYear) ?? 10;
  let base = 250_000;
  if (h.discipline === "Show jumping") base = 600_000;
  if (h.discipline === "Dressage") base = 550_000;
  if (h.discipline === "Polo") base = 350_000;
  if (h.discipline === "Racing" || h.breed?.includes("Arabian")) base = 450_000;
  if (a >= 6 && a <= 11) base *= 1.3;
  if (a > 15) base *= 0.5;
  if (h.feiId) base *= 1.25;
  if (h.sex === "STALLION") base *= 1.15;
  return {
    low: Math.round((base * 0.85) / 5000) * 5000,
    high: Math.round((base * 1.2) / 5000) * 5000,
    confidence: "low",
    factors: [
      `Discipline: ${h.discipline ?? "not set"}`,
      `Age ${a} ${a >= 6 && a <= 11 ? "(prime age adds value)" : ""}`.trim(),
      h.feiId ? "FEI registration adds buyer trust" : "No FEI registration",
      "Demo mode: add an AI key in .env for a real AI appraisal",
    ],
    summary: `Demo estimate for ${h.name} based on simple rules. Connect the AI for a full appraisal using pedigree, results and health history.`,
  };
}

// ───────────── 2. AI Listing Writer (AI Added Service) ─────────────

export async function writeListing(h: Horse): Promise<{ title: string; description: string }> {
  if (!aiEnabled()) {
    return {
      title: `${h.name} - ${age(h.birthYear) ?? ""}yo ${h.breed ?? ""} ${h.discipline ?? ""}`.replace(/\s+/g, " ").trim(),
      description: `${h.name} is a ${age(h.birthYear) ?? "mature"}-year-old ${label(h.sex).toLowerCase()} ${h.breed ?? ""} with a ${h.temperament ?? "kind"} temperament, working in ${h.discipline ?? "general riding"}${h.level ? ` at ${h.level}` : ""}. ${h.sire ? `By ${h.sire}. ` : ""}Healthy, well handled and ready for a new rider. Trials welcome at our yard. (Demo mode text - connect the AI for a tailored listing.)`,
    };
  }
  return askJson({
    system: "You write honest, appealing horse sale listings. Never invent results, prices or health claims that are not in the facts.",
    prompt: `Write a marketplace listing for this horse.

${horseFacts(h)}

Return JSON: {"title": "max 70 characters", "description": "120-180 words, warm and factual, ends with an invitation to book a trial"}`,
  });
}

// ───────────── 3. AI Health Early-Warning (AI Added Service) ─────────────

export type HealthRisk = {
  riskLevel: "low" | "medium" | "high";
  callVet: boolean;
  alerts: string[];
  recommendations: string[];
};

export async function healthRiskCheck(h: Horse, records: Health[], feed: Feed | null, recentNotes: string[]): Promise<HealthRisk> {
  if (!aiEnabled()) return demoHealthRisk(records);
  return askJson<HealthRisk>({
    system: "You are an equine health assistant that spots patterns in yard records. You do not diagnose; you flag risks and advise when to call a vet.",
    prompt: `Review this horse's records and flag health risks.

${horseFacts(h)}

Health history (newest first):
${healthFacts(records)}

Feeding plan: ${feed ? `AM ${feed.morning ?? "-"}, midday ${feed.midday ?? "-"}, PM ${feed.evening ?? "-"}, supplements ${feed.supplements ?? "-"}` : "none logged"}
Recent yard notes: ${recentNotes.length ? recentNotes.join(" | ") : "none"}
Today: ${new Date().toISOString().slice(0, 10)}

Look for: overdue vaccinations/worming/dental/farrier, repeated injuries or treatments, weight or appetite changes, feeding that does not match workload, seasonal risks in Egypt (heat stress, dehydration, colic in summer).

Return JSON: {"riskLevel": "low"|"medium"|"high", "callVet": boolean, "alerts": [short strings], "recommendations": [short actionable strings]}`,
  });
}

function demoHealthRisk(records: Health[]): HealthRisk {
  const now = Date.now();
  const latest = (t: string) => records.filter((r) => r.type === t).sort((a, b) => +b.date - +a.date)[0];
  const alerts: string[] = [];
  const checks: [string, number][] = [
    ["VACCINATION", 365],
    ["WORMING", 90],
    ["DENTAL", 365],
    ["FARRIER", 49],
  ];
  for (const [t, days] of checks) {
    const r = latest(t);
    if (!r) alerts.push(`No ${label(t).toLowerCase()} on record`);
    else if (r.nextDue && +r.nextDue < now) alerts.push(`${label(t)} overdue since ${r.nextDue.toISOString().slice(0, 10)}`);
    else if (now - +r.date > days * 86_400_000) alerts.push(`${label(t)} last done ${Math.round((now - +r.date) / 86_400_000)} days ago`);
  }
  const injuries = records.filter((r) => r.type === "INJURY" || r.type === "TREATMENT").length;
  if (injuries >= 2) alerts.push(`${injuries} injuries/treatments on record - watch for a recurring problem`);
  const riskLevel = alerts.length >= 3 ? "high" : alerts.length ? "medium" : "low";
  return {
    riskLevel,
    callVet: riskLevel === "high",
    alerts: alerts.length ? alerts : ["No overdue care found"],
    recommendations: [
      "Keep fresh water available - summer heat in Egypt raises colic and dehydration risk",
      "Book overdue items with your vet or farrier",
      "Demo mode: connect the AI to analyse notes, feeding and patterns",
    ],
  };
}

// ───────────── 4. AI Feeding Plan (AI Enhancement) ─────────────

export type FeedSuggestion = { name: string; morning: string; midday: string; evening: string; supplements: string; notes: string };

export async function generateFeedPlan(h: Horse, goal: string, workload: string): Promise<FeedSuggestion> {
  if (!aiEnabled()) {
    const kg = h.weightKg ?? 500;
    const hay = Math.round(kg * 0.02);
    return {
      name: `${workload} workload plan`,
      morning: `${Math.round(hay * 0.35)} kg berseem/alfalfa hay + 1.5 kg performance cubes`,
      midday: `${Math.round(hay * 0.25)} kg hay, free water with electrolytes in hot months`,
      evening: `${Math.round(hay * 0.4)} kg hay + 1.5 kg cubes + 0.5 kg soaked beet pulp`,
      supplements: "Salt lick, electrolytes after work, vitamin E if little fresh grass",
      notes: `Based on ${kg} kg body weight (2% per day forage) and goal: ${goal}. Demo mode - connect the AI for a tailored plan.`,
    };
  }
  return askJson<FeedSuggestion>({
    system: "You are an equine nutritionist familiar with feeds available in Egypt (berseem, alfalfa, wheat straw, barley, bran, local performance cubes).",
    prompt: `Create a daily feeding plan.

${horseFacts(h)}
Workload: ${workload}
Owner goal: ${goal}
Season: ${["Winter", "Winter", "Spring", "Spring", "Spring", "Summer", "Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter"][new Date().getMonth()]} in Egypt

Return JSON: {"name": "short plan name", "morning": "...", "midday": "...", "evening": "...", "supplements": "...", "notes": "why, plus water/heat advice"}. Use kg amounts.`,
  });
}

// ───────────── 5. Smart Scan (AI Enhancement) ─────────────

export type ScanResult = {
  type: string;
  date: string | null;
  nextDue: string | null;
  provider: string | null;
  cost: number | null;
  notes: string;
  horseName: string | null;
};

export async function smartScan(image: SavedUpload): Promise<ScanResult> {
  if (!aiEnabled()) {
    return {
      type: "VACCINATION",
      date: new Date().toISOString().slice(0, 10),
      nextDue: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
      provider: "Demo Vet Clinic",
      cost: 850,
      notes: "Demo mode: sample data. Connect the AI to read real documents in Arabic or English.",
      horseName: null,
    };
  }
  return askJson<ScanResult>({
    system: "You read veterinary documents, vaccination cards, farrier notes, lab results and invoices in any language (often Arabic or English).",
    prompt: `Read this document and extract one health record.
Return JSON: {"type": one of ${["VACCINATION", "WORMING", "DENTAL", "FARRIER", "TREATMENT", "BLOOD_TEST", "VET_VISIT", "INJURY", "OTHER"].join("|")}, "date": "YYYY-MM-DD" or null, "nextDue": "YYYY-MM-DD" or null, "provider": string or null, "cost": number in EGP or null, "notes": "short English summary incl. product names/doses", "horseName": string or null}`,
    images: [image],
  });
}

// ───────────── 6. AI Marketplace Search (AI Enhancement) ─────────────

export type SearchFilters = {
  discipline?: string | null;
  sex?: string | null;
  minAge?: number | null;
  maxAge?: number | null;
  maxPrice?: number | null;
  minPrice?: number | null;
  minHeight?: number | null;
  listingType?: "SALE" | "LEASE" | null;
  city?: string | null;
  keywords?: string[];
  explanation: string;
};

export async function parseSearch(query: string, disciplines: string[]): Promise<SearchFilters> {
  if (!aiEnabled()) {
    const q = query.toLowerCase();
    const price = q.match(/(\d[\d,.]*)\s*(k|thousand|million|m)?\s*(egp|pounds|le)?/);
    let maxPrice: number | null = null;
    if (price && /under|below|max|less|up to/.test(q)) {
      let n = Number(price[1].replace(/,/g, ""));
      if (price[2] === "k" || price[2] === "thousand") n *= 1000;
      if (price[2] === "m" || price[2] === "million") n *= 1_000_000;
      maxPrice = n;
    }
    const ageMatch = q.match(/(\d+)\s*(yo|year)/);
    const f = {
      discipline: disciplines.find((d) => q.includes(d.toLowerCase()) || q.includes(d.toLowerCase().split(" ")[0])) ?? null,
      sex: q.includes("mare") ? "MARE" : q.includes("stallion") ? "STALLION" : q.includes("gelding") ? "GELDING" : null,
      maxAge: ageMatch ? Number(ageMatch[1]) + 1 : null,
      minAge: ageMatch ? Number(ageMatch[1]) - 1 : null,
      maxPrice,
      listingType: q.includes("lease") ? ("LEASE" as const) : null,
      keywords: ["calm", "quiet", "kind", "brave", "forward", "arabian"].filter((k) => q.includes(k)),
    };
    const parts = [
      f.keywords.length && f.keywords.join(", "),
      f.sex && label(f.sex).toLowerCase() + "s",
      f.discipline,
      f.listingType && "for lease",
      f.maxPrice && `under ${f.maxPrice.toLocaleString("en")} EGP`,
      ageMatch && `about ${ageMatch[1]} years old`,
    ].filter(Boolean);
    return {
      ...f,
      explanation: `Searched for: ${parts.length ? parts.join(" · ") : "all horses"}. (Demo mode - connect the AI to understand any request.)`,
    };
  }
  return askJson<SearchFilters>({
    system: "You turn a buyer's plain-language request into marketplace search filters.",
    prompt: `Buyer request: "${query}"
Available disciplines: ${disciplines.join(", ")}
Return JSON: {"discipline": one of the list or null, "sex": "MARE"|"STALLION"|"GELDING"|null, "minAge": number|null, "maxAge": number|null, "minPrice": EGP number|null, "maxPrice": EGP number|null, "minHeight": cm|null, "listingType": "SALE"|"LEASE"|null, "city": string|null, "keywords": [temperament or breed words to match in descriptions], "explanation": "one sentence describing what you searched for"}
If a price is given in euros or dollars, convert to EGP (1 EUR ≈ 59 EGP, 1 USD ≈ 50 EGP).`,
  });
}

// ───────────── 7. AI Rota Suggestion (AI Enhancement) ─────────────

export type RotaSuggestion = { shifts: { staffName: string; day: number; start: string; end: string }[]; reasoning: string };

export async function suggestRota(
  staffList: { name: string; role: string; skills: string | null }[],
  horseCount: number,
  notes: string,
): Promise<RotaSuggestion> {
  if (!aiEnabled()) {
    const shifts: RotaSuggestion["shifts"] = [];
    staffList.forEach((s, i) => {
      for (let day = 0; day < 7; day++) {
        if ((day + i) % 7 === 5) continue; // one day off each, staggered
        const early = (day + i) % 2 === 0;
        shifts.push({ staffName: s.name, day, start: early ? "06:00" : "12:00", end: early ? "14:00" : "20:00" });
      }
    });
    return { shifts, reasoning: `Demo rota: each person works 6 days with a staggered day off and alternating early/late shifts for ${horseCount} horses.` };
  }
  return askJson<RotaSuggestion>({
    system: "You plan weekly staff rotas for horse yards. Cover early feeds (from 06:00) and late checks (until 20:00) every day, respect one or two days off per person, and match skills to needs.",
    prompt: `Staff: ${JSON.stringify(staffList)}
Horses in the yard: ${horseCount}
Manager notes: ${notes || "none"}
Return JSON: {"shifts": [{"staffName": exact name, "day": 0-6 where 0 = Saturday, "start": "HH:MM", "end": "HH:MM"}], "reasoning": "2-3 sentences"}`,
    maxTokens: 3000,
  });
}

// ───────────── 8. AI Mating Advisor (AI Added Service) ─────────────

export type MatingAdvice = { ranking: { stallionId: string; score: number; strengths: string[]; risks: string[] }[]; summary: string };

export async function matingAdvisor(mare: Horse, stallions: Horse[], goal: string): Promise<MatingAdvice> {
  if (!aiEnabled()) {
    const ranking = stallions
      .map((s) => {
        const shared = [s.sire, s.dam, s.damSire].filter((x) => x && [mare.sire, mare.dam, mare.damSire].includes(x));
        const sameDisc = s.discipline && s.discipline === mare.discipline;
        const score = Math.max(10, 60 + (sameDisc ? 25 : 0) - shared.length * 40 + (s.feiId ? 10 : 0));
        return {
          stallionId: s.id,
          score: Math.min(score, 98),
          strengths: [sameDisc ? `Same discipline (${s.discipline})` : `Brings ${s.discipline ?? "different"} genetics`, s.feiId ? "FEI registered" : "Local line"].filter(Boolean),
          risks: shared.length ? [`Shared ancestor: ${shared.join(", ")} - inbreeding risk`] : [],
        };
      })
      .sort((a, b) => b.score - a.score);
    return { ranking, summary: "Demo ranking based on discipline match and shared ancestors. Connect the AI for full pedigree analysis." };
  }
  return askJson<MatingAdvice>({
    system: "You are an equine breeding advisor. Assess pedigree compatibility, discipline fit, conformation complement and inbreeding risk from the data given. Be honest about uncertainty.",
    prompt: `Mare:
${horseFacts(mare)}

Breeding goal: ${goal || "a sound, talented foal for the mare's discipline"}

Candidate stallions:
${stallions.map((s) => `[${s.id}]\n${horseFacts(s)}`).join("\n\n")}

Return JSON: {"ranking": [{"stallionId": id from brackets, "score": 0-100, "strengths": [..], "risks": [..]}] sorted best first, "summary": "2 sentences"}`,
    maxTokens: 2000,
  });
}

// ───────────── 9. AI Ride & Gait Analysis (AI Added Service) ─────────────

export async function gaitAnalysis(h: Horse, frames: SavedUpload[], context: string): Promise<string> {
  if (!aiEnabled()) {
    return `**Demo mode** - sample assessment for ${h.name}.

- **Rhythm:** looks regular in the frames provided.
- **Symmetry:** no obvious head nod; compare left and right rein next time.
- **Balance:** rider position centred; horse slightly on the forehand.
- **Next step:** film 20 seconds of trot on a straight line, from behind and the side.

Connect the AI (add GEMINI_API_KEY or ANTHROPIC_API_KEY in .env) to analyse real photos or video frames.`;
  }
  return askText({
    system: "You are an equine biomechanics coach reviewing still frames from a ride or trot-up. You comment on rhythm, symmetry, balance, rider position and possible lameness signs. You cannot diagnose; if you see possible lameness, say a vet should assess it.",
    prompt: `Horse:
${horseFacts(h)}
Context from rider: ${context || "none"}

Assess the frames. Use short markdown sections: Rhythm, Symmetry, Balance, Rider, Watch-outs, Exercises to try. Score overall movement quality from 1-10 at the end.`,
    images: frames,
    maxTokens: 1500,
  });
}

// ───────────── 10. AI Job Matching (AI Enhancement) ─────────────

export type ApplicantRank = { applicationId: string; score: number; reason: string }[];

export async function rankApplicants(
  job: { title: string; role: string; description: string; location: string | null },
  apps: { id: string; name: string; city: string | null; bio: string | null; message: string }[],
): Promise<ApplicantRank> {
  if (!aiEnabled()) {
    const words = `${job.title} ${job.role} ${job.description}`.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    return apps
      .map((a) => {
        const text = `${a.bio ?? ""} ${a.message}`.toLowerCase();
        const hits = words.filter((w) => text.includes(w)).length;
        const local = job.location && a.city && job.location.toLowerCase().includes(a.city.toLowerCase());
        return { applicationId: a.id, score: Math.min(95, 40 + hits * 8 + (local ? 15 : 0)), reason: `Demo: ${hits} keyword matches${local ? ", lives nearby" : ""}` };
      })
      .sort((x, y) => y.score - x.score);
  }
  return askJson<ApplicantRank>({
    system: "You help equestrian employers shortlist applicants fairly, based only on experience and fit described in the text. Ignore names, gender, religion and nationality.",
    prompt: `Job: ${JSON.stringify(job)}
Applicants: ${JSON.stringify(apps)}
Return JSON array: [{"applicationId": id, "score": 0-100, "reason": "one sentence"}] sorted best first.`,
  });
}

// ───────────── 11. Visit notes → health record + invoice (AI Enhancement for professionals) ─────────────

export type VisitResult = {
  record: { type: string; notes: string; nextDue: string | null };
  invoiceItems: { description: string; quantity: number; unitPrice: number }[];
  clientSummary: string;
};

export async function visitNotesToRecord(notes: string, service: string, horseName: string | null): Promise<VisitResult> {
  if (!aiEnabled()) {
    return {
      record: { type: service.toLowerCase().includes("shoe") || service.toLowerCase().includes("farrier") ? "FARRIER" : "VET_VISIT", notes, nextDue: null },
      invoiceItems: [{ description: service, quantity: 1, unitPrice: 1000 }],
      clientSummary: `Visit completed${horseName ? ` for ${horseName}` : ""}. ${notes.slice(0, 160)} (Demo mode)`,
    };
  }
  return askJson<VisitResult>({
    system: "You turn an equine professional's rough visit notes (often dictated, may mix Arabic and English) into a clean health record and invoice lines in EGP.",
    prompt: `Service booked: ${service}
Horse: ${horseName ?? "not specified"}
Raw notes: """${notes}"""

Return JSON: {"record": {"type": one of VACCINATION|WORMING|DENTAL|FARRIER|TREATMENT|BLOOD_TEST|VET_VISIT|INJURY|OTHER, "notes": "clean English summary", "nextDue": "YYYY-MM-DD" or null}, "invoiceItems": [{"description": "...", "quantity": number, "unitPrice": EGP number - use prices mentioned in the notes, else a typical Egyptian price}], "clientSummary": "2-3 friendly sentences for the owner"}`,
  });
}

// ───────────── 12. AI Daily Briefing (AI Enhancement of the Command Centre) ─────────────

export async function dailyBriefing(data: {
  yardName: string;
  tasksToday: string[];
  overdue: string[];
  healthDue: string[];
  trials: string[];
  onShift: string[];
}): Promise<string> {
  if (!aiEnabled()) {
    return [
      `**Good morning, ${data.yardName}.** Here is today's plan (demo mode).`,
      data.overdue.length ? `- **Do first:** ${data.overdue.length} overdue task(s): ${data.overdue.slice(0, 3).join("; ")}` : "- No overdue tasks.",
      `- **Today:** ${data.tasksToday.length} task(s) scheduled.`,
      data.healthDue.length ? `- **Health due this week:** ${data.healthDue.join("; ")}` : "- No health care due this week.",
      data.trials.length ? `- **Trials:** ${data.trials.join("; ")}` : "",
      `- **On shift:** ${data.onShift.length ? data.onShift.join(", ") : "nobody rostered - check the rota"}`,
      "- **Heat tip:** schedule hard work before 10:00 and after 17:00 in summer.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return askText({
    system: "You are the yard manager's assistant. Write a short morning briefing in markdown: what to do first, who does what, risks to watch. Max 180 words.",
    prompt: `Yard: ${data.yardName}
Date: ${new Date().toDateString()}
Overdue tasks: ${data.overdue.join("; ") || "none"}
Today's tasks: ${data.tasksToday.join("; ") || "none"}
Health care due within 7 days: ${data.healthDue.join("; ") || "none"}
Trials today/tomorrow: ${data.trials.join("; ") || "none"}
Staff on shift today: ${data.onShift.join(", ") || "none rostered"}`,
    maxTokens: 600,
  });
}

// ───────────── 13. Passport / FEI card scan (AI Enhancement) ─────────────

export type PassportScan = {
  name: string | null;
  breed: string | null;
  sex: "MARE" | "STALLION" | "GELDING" | null;
  color: string | null;
  birthYear: number | null;
  heightCm: number | null;
  microchip: string | null;
  feiId: string | null;
  sire: string | null;
  dam: string | null;
  damSire: string | null;
};

export async function scanPassport(images: SavedUpload[]): Promise<PassportScan> {
  if (!aiEnabled()) {
    return { name: "Demo Horse", breed: "Arabian", sex: "MARE", color: "Grey", birthYear: 2018, heightCm: 152, microchip: "818000000000001", feiId: null, sire: "Demo Sire", dam: "Demo Dam", damSire: null };
  }
  return askJson<PassportScan>({
    system: "You read horse passports (EU, FEI, Egyptian Agricultural Organization, WAHO Arabian certificates) in any language, including Arabic.",
    prompt: `Extract the horse's identity from these passport pages. Translate names to English letters.
Return JSON: {"name","breed","sex": "MARE"|"STALLION"|"GELDING"|null,"color","birthYear": number,"heightCm": number,"microchip","feiId","sire","dam","damSire"} using null for anything not visible.`,
    images,
  });
}

// ───────────── 14. AI Symptom Triage / tele-vet first opinion (AI Added Service) ─────────────

export async function symptomTriage(h: Horse, description: string, photos: SavedUpload[], records: Health[]): Promise<string> {
  const emergencyWords = ["colic", "rolling", "not eating", "bleeding", "can't stand", "cannot stand", "down", "fever", "choke", "non weight", "three-legged"];
  if (!aiEnabled()) {
    const urgent = emergencyWords.some((w) => description.toLowerCase().includes(w));
    return `${urgent ? "🔴 **EMERGENCY - call your vet now.**" : "🟠 **Call your vet today if it does not improve within a few hours.**"}

**While you wait (demo mode):**
- Keep ${h.name} calm in a safe stable with water.
- Check temperature (normal 37.2-38.3 °C), pulse (28-44 bpm) and gut sounds on both sides.
- Do not give medication unless your vet tells you to.
- Note when it started and take a short video for the vet.

_AI guidance only - not a diagnosis. Connect the AI for an assessment of your description and photos._`;
  }
  return askText({
    system: `You are an equine triage assistant (like a vet nurse on the phone). You never diagnose. You:
1) Start with ONE urgency line: "🔴 EMERGENCY - call your vet now", "🟠 Call your vet today", or "🟢 Monitor at home and book a routine check".
2) Explain briefly what signs led to that level.
3) Give safe first-aid steps while waiting (no prescription drugs or doses).
4) List what to check and tell the vet (TPR, gut sounds, duration, photos/video).
If there is any sign of colic, severe lameness, uncontrolled bleeding, eye injury, choke, or a horse that is down, always choose EMERGENCY.`,
    prompt: `Horse:
${horseFacts(h)}
Recent health history:
${healthFacts(records.slice(0, 8))}

Owner's description: """${description}"""
${photos.length ? `${photos.length} photo(s) attached.` : "No photos."}`,
    images: photos,
    maxTokens: 900,
  });
}

// ───────────── 15. AI Training Planner (AI Added Service) ─────────────

export async function trainingPlan(h: Horse, goal: string, daysPerWeek: number, recentNotes: string): Promise<string> {
  if (!aiEnabled()) {
    const days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const plan = ["Flatwork - transitions and suppleness (40 min)", "Hack / light conditioning (30-45 min)", "Gymnastic grid or poles (35 min)", "Rest / turnout", "Flatwork - lateral work (40 min)", "Course work or discipline practice (30 min)", "Rest / turnout"];
    let used = 0;
    const lines = days.map((d, i) => {
      const ride = !plan[i].startsWith("Rest") && used < daysPerWeek;
      if (ride) used++;
      return `- **${d}:** ${ride ? plan[i] : "Rest / turnout"}`;
    });
    return `**Weekly plan for ${h.name} - goal: ${goal || "general fitness"} (demo mode)**\n\n${lines.join("\n")}\n\nRide before 10:00 or after 17:00 in summer heat. _Connect the AI for a plan built on your horse's history._`;
  }
  return askText({
    system: "You are a professional equestrian coach. Build safe, progressive weekly training plans. Include warm-up/cool-down, one or two rest days, and heat management for Egypt.",
    prompt: `Horse:
${horseFacts(h)}
Goal: ${goal || "general fitness and progression"}
Riding days per week: ${daysPerWeek}
Recent notes / results / gait analysis: ${recentNotes || "none"}

Give a 7-day plan (Saturday to Friday) as markdown bullets with session type, duration and key exercises, then 3 progress markers to watch this week.`,
    maxTokens: 1000,
  });
}
