import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, gte, like, lt, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Content, FunctionDeclaration } from "@google/genai";
import { ANTHROPIC_MODEL, BASE_SYSTEM, aiEnabled, aiProvider, anthropic, friendlyAiError, geminiGenerate } from "./client";
import { addDays, egp, fmtDate, fmtDateTime, label, startOfDay } from "@/lib/utils";

/**
 * AI Yard Assistant (AI Added Service)
 * A chat assistant that can read and update the yard's data through tools.
 * The same tools can later be exposed over WhatsApp Business.
 */

const tools: Anthropic.Tool[] = [
  {
    name: "list_horses",
    description: "List all horses in the user's yard with breed, age, discipline, stall and listing status.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_horse",
    description: "Get full details for one horse by (partial) name, including recent health records and active feeding plan.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "list_tasks",
    description: "List tasks. scope: 'today', 'overdue', 'upcoming' (next 7 days) or 'all_open'.",
    input_schema: {
      type: "object",
      properties: { scope: { type: "string", enum: ["today", "overdue", "upcoming", "all_open"] } },
      required: ["scope"],
    },
  },
  {
    name: "create_task",
    description: "Create a yard task. due_date is YYYY-MM-DD or YYYY-MM-DDTHH:MM.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_date: { type: "string" },
        horse_name: { type: "string" },
        staff_name: { type: "string" },
        category: { type: "string", enum: ["CARE", "HEALTH", "TRAINING", "TRIAL", "OTHER"] },
        priority: { type: "integer", enum: [1, 2, 3], description: "1 high, 2 normal, 3 low" },
      },
      required: ["title", "due_date"],
    },
  },
  {
    name: "complete_task",
    description: "Mark a task as done by its id (get ids from list_tasks).",
    input_schema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] },
  },
  {
    name: "health_due",
    description: "List health care (vaccinations, worming, farrier, dental...) that is overdue or due within the given number of days.",
    input_schema: { type: "object", properties: { days: { type: "integer" } }, required: ["days"] },
  },
  {
    name: "log_health_record",
    description: "Log a health event for a horse (e.g. after a groom reports something or a vet visit).",
    input_schema: {
      type: "object",
      properties: {
        horse_name: { type: "string" },
        type: { type: "string", enum: ["VACCINATION", "WORMING", "DENTAL", "FARRIER", "TREATMENT", "BLOOD_TEST", "VET_VISIT", "INJURY", "OTHER"] },
        date: { type: "string", description: "YYYY-MM-DD, default today" },
        notes: { type: "string" },
        provider: { type: "string" },
        cost: { type: "number", description: "EGP" },
        next_due: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["horse_name", "type", "notes"],
    },
  },
  {
    name: "finance_summary",
    description: "Income, expenses and net for the current month, plus top expense categories and unpaid invoices.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "staff_on_shift",
    description: "Which staff are rostered on a date (YYYY-MM-DD, default today) and who is clocked in now.",
    input_schema: { type: "object", properties: { date: { type: "string" } } },
  },
];

async function findHorse(userId: string, name: string) {
  return db.query.horses.findFirst({
    where: and(eq(schema.horses.ownerId, userId), like(schema.horses.name, `%${name}%`)),
  });
}

async function runTool(userId: string, name: string, input: Record<string, unknown>): Promise<string> {
  const today = startOfDay();
  switch (name) {
    case "list_horses": {
      const rows = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, userId), with: { stall: true } });
      if (!rows.length) return "No horses yet.";
      return rows
        .map((h) => `${h.name}: ${h.breed ?? "?"}, ${h.sex ?? "?"}, born ${h.birthYear ?? "?"}, ${h.discipline ?? "-"}, stall ${h.stall?.name ?? "none"}, listing ${h.listingType}`)
        .join("\n");
    }
    case "get_horse": {
      const h = await findHorse(userId, String(input.name));
      if (!h) return `No horse found matching "${input.name}".`;
      const records = await db.query.healthRecords.findMany({ where: eq(schema.healthRecords.horseId, h.id), orderBy: desc(schema.healthRecords.date), limit: 8 });
      const feed = await db.query.feedPlans.findFirst({ where: and(eq(schema.feedPlans.horseId, h.id), eq(schema.feedPlans.active, true)) });
      return JSON.stringify({
        ...h,
        recentHealth: records.map((r) => ({ type: r.type, date: r.date, notes: r.notes, nextDue: r.nextDue })),
        feedPlan: feed ? { morning: feed.morning, midday: feed.midday, evening: feed.evening, supplements: feed.supplements } : null,
      });
    }
    case "list_tasks": {
      const scope = String(input.scope);
      const base = and(eq(schema.tasks.ownerId, userId), eq(schema.tasks.done, false));
      const where =
        scope === "today"
          ? and(base, gte(schema.tasks.dueAt, today), lt(schema.tasks.dueAt, addDays(today, 1)))
          : scope === "overdue"
            ? and(base, lt(schema.tasks.dueAt, today))
            : scope === "upcoming"
              ? and(base, gte(schema.tasks.dueAt, today), lt(schema.tasks.dueAt, addDays(today, 8)))
              : base;
      const rows = await db.query.tasks.findMany({ where, with: { horse: true, staff: true }, orderBy: asc(schema.tasks.dueAt), limit: 40 });
      if (!rows.length) return "No tasks.";
      return rows
        .map((t) => `[${t.id}] ${t.title} - due ${fmtDateTime(t.dueAt)}, ${label(t.category)}, ${t.priority === 1 ? "high priority" : t.priority === 3 ? "low priority" : "normal priority"}${t.horse ? `, horse ${t.horse.name}` : ""}${t.staff ? `, assigned ${t.staff.name}` : ""}`)
        .join("\n");
    }
    case "create_task": {
      const horse = input.horse_name ? await findHorse(userId, String(input.horse_name)) : null;
      const st = input.staff_name
        ? await db.query.staff.findFirst({ where: and(eq(schema.staff.ownerId, userId), like(schema.staff.name, `%${input.staff_name}%`)) })
        : null;
      const due = new Date(String(input.due_date));
      const [t] = await db
        .insert(schema.tasks)
        .values({
          ownerId: userId,
          title: String(input.title),
          dueAt: Number.isNaN(due.getTime()) ? new Date() : due,
          horseId: horse?.id ?? null,
          staffId: st?.id ?? null,
          category: (input.category as string) ?? "CARE",
          priority: (input.priority as number) ?? 2,
        })
        .returning();
      return `Created task "${t.title}" due ${fmtDateTime(t.dueAt)}${horse ? ` for ${horse.name}` : ""}${st ? `, assigned to ${st.name}` : ""}.`;
    }
    case "complete_task": {
      const res = await db
        .update(schema.tasks)
        .set({ done: true, doneAt: new Date() })
        .where(and(eq(schema.tasks.id, String(input.task_id)), eq(schema.tasks.ownerId, userId)))
        .returning();
      return res.length ? `Marked "${res[0].title}" as done.` : "Task not found.";
    }
    case "health_due": {
      const days = Number(input.days ?? 14);
      const rows = await db
        .select({ horse: schema.horses.name, type: schema.healthRecords.type, nextDue: schema.healthRecords.nextDue })
        .from(schema.healthRecords)
        .innerJoin(schema.horses, eq(schema.healthRecords.horseId, schema.horses.id))
        .where(and(eq(schema.horses.ownerId, userId), lte(schema.healthRecords.nextDue, addDays(today, days))))
        .orderBy(asc(schema.healthRecords.nextDue));
      if (!rows.length) return `Nothing due in the next ${days} days.`;
      return rows.map((r) => `${r.horse}: ${label(r.type)} due ${fmtDate(r.nextDue)}${r.nextDue && r.nextDue < today ? " (OVERDUE)" : ""}`).join("\n");
    }
    case "log_health_record": {
      const horse = await findHorse(userId, String(input.horse_name));
      if (!horse) return `No horse found matching "${input.horse_name}".`;
      await db.insert(schema.healthRecords).values({
        horseId: horse.id,
        type: String(input.type),
        date: input.date ? new Date(String(input.date)) : new Date(),
        notes: String(input.notes),
        provider: (input.provider as string) ?? null,
        cost: (input.cost as number) ?? null,
        nextDue: input.next_due ? new Date(String(input.next_due)) : null,
        source: "ASSISTANT",
      });
      if (input.cost) {
        await db.insert(schema.transactions).values({
          ownerId: userId,
          horseId: horse.id,
          kind: "EXPENSE",
          category: label(String(input.type)),
          amount: Number(input.cost),
          date: new Date(),
          description: String(input.notes).slice(0, 120),
        });
      }
      return `Logged ${label(String(input.type))} for ${horse.name}.`;
    }
    case "finance_summary": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const tx = await db.query.transactions.findMany({ where: and(eq(schema.transactions.ownerId, userId), gte(schema.transactions.date, monthStart)) });
      const income = tx.filter((t) => t.kind === "INCOME").reduce((s, t) => s + t.amount, 0);
      const expense = tx.filter((t) => t.kind === "EXPENSE").reduce((s, t) => s + t.amount, 0);
      const byCat: Record<string, number> = {};
      tx.filter((t) => t.kind === "EXPENSE").forEach((t) => (byCat[t.category] = (byCat[t.category] ?? 0) + t.amount));
      const unpaid = await db.query.invoices.findMany({ where: and(eq(schema.invoices.ownerId, userId)) });
      const open = unpaid.filter((i) => i.status === "SENT" || i.status === "OVERDUE");
      return `This month: income ${egp(income)}, expenses ${egp(expense)}, net ${egp(income - expense)}.
Top expenses: ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, v]) => `${c} ${egp(v)}`).join(", ") || "none"}.
Unpaid invoices: ${open.length} totalling ${egp(open.reduce((s, i) => s + i.total, 0))}${open.length ? ` - ${open.map((i) => `${i.number} ${i.clientName} ${egp(i.total)} due ${fmtDate(i.dueAt)}`).join("; ")}` : ""}.`;
    }
    case "staff_on_shift": {
      const d = input.date ? startOfDay(new Date(String(input.date))) : today;
      const rows = await db.query.shifts.findMany({
        where: and(eq(schema.shifts.ownerId, userId), gte(schema.shifts.start, d), lt(schema.shifts.start, addDays(d, 1))),
        with: { staff: true },
      });
      const staffIds = (await db.query.staff.findMany({ where: eq(schema.staff.ownerId, userId) })).map((s) => s.id);
      const open = staffIds.length
        ? await db.query.timeEntries.findMany({ with: { staff: true } }).then((all) => all.filter((e) => !e.clockOut && staffIds.includes(e.staffId)))
        : [];
      return `Rostered: ${rows.map((s) => `${s.staff.name} ${s.start.toTimeString().slice(0, 5)}-${s.end.toTimeString().slice(0, 5)}`).join(", ") || "nobody"}.
Clocked in now: ${open.map((e) => e.staff.name).join(", ") || "nobody"}.`;
    }
    default:
      return `Unknown tool ${name}`;
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function runAssistant(userId: string, yardName: string, history: ChatTurn[]): Promise<string> {
  if (!aiEnabled()) return demoAssistant(userId, history.at(-1)?.content ?? "");

  const system = `${BASE_SYSTEM}

You are the Yard Assistant for "${yardName}". Today is ${new Date().toDateString()}.
Use the tools to look up and change yard data - never guess numbers. When the user reports something about a horse (ate poorly, lame, cut leg, vet came), log it with log_health_record and, if useful, create a follow-up task.
Keep answers short, use bullet points for lists, and confirm what you changed.`;

  try {
    if (aiProvider() === "gemini") return await runGemini(userId, system, history);
    return await runClaude(userId, system, history);
  } catch (e) {
    throw friendlyAiError(e);
  }
}

async function callTool(userId: string, name: string, input: Record<string, unknown>) {
  try {
    return await runTool(userId, name, input ?? {});
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  }
}

async function runClaude(userId: string, system: string, history: ChatTurn[]): Promise<string> {
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  for (let i = 0; i < 6; i++) {
    const res = await anthropic().messages.create({ model: ANTHROPIC_MODEL, max_tokens: 1200, system, tools, messages });
    if (res.stop_reason !== "tool_use") {
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
    }
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      results.push({ type: "tool_result", tool_use_id: block.id, content: await callTool(userId, block.name, block.input as Record<string, unknown>) });
    }
    messages.push({ role: "user", content: results });
  }
  return "I had to stop after several steps. Please ask again more specifically.";
}

/** Demo mode: a keyword router over the same tools so the assistant still works without an API key. */
async function demoAssistant(userId: string, text: string): Promise<string> {
  const q = text.toLowerCase();
  const note = "\n\n_Demo mode: add an AI key in .env to talk naturally with the assistant._";
  // Turn tool output into bullet points and hide internal task ids
  const bullets = (out: string) => out.split("\n").map((l) => `- ${l.replace(/^\[[^\]]+\]\s*/, "")}`).join("\n");
  const reply = async (title: string, tool: string, input: Record<string, unknown>) => `**${title}**\n\n${bullets(await runTool(userId, tool, input))}${note}`;
  if (q.includes("staff") || q.includes("shift") || q.includes("who is") || q.includes("working")) return reply("Staff today", "staff_on_shift", {});
  if (q.includes("overdue")) return reply("Overdue tasks", "list_tasks", { scope: "overdue" });
  if (q.includes("vacc") || q.includes("due") || q.includes("health") || q.includes("farrier") || q.includes("worm")) return reply("Health care due in the next 30 days", "health_due", { days: 30 });
  if (q.includes("money") || q.includes("finance") || q.includes("income") || q.includes("expense") || q.includes("invoice") || q.includes("spend") || q.includes("owe"))
    return reply("Finances", "finance_summary", {});
  if (q.includes("task") || q.includes("today") || q.includes("plan") || q.includes("first")) return reply("Today's tasks", "list_tasks", { scope: "today" });
  if (q.includes("horse")) return reply("Your horses", "list_horses", {});
  return `I can help with tasks, health care due, horses, staff shifts and finances. Try: "What is overdue?", "Which vaccinations are due?", "Who is on shift today?" or "How much did we spend this month?"${note}`;
}

/** Same tools, described for Gemini function calling. */
const geminiTools: FunctionDeclaration[] = tools.map((t) => {
  const schema = t.input_schema as { properties?: Record<string, unknown> };
  const hasParams = schema.properties && Object.keys(schema.properties).length > 0;
  return { name: t.name, description: t.description, ...(hasParams ? { parametersJsonSchema: t.input_schema } : {}) };
});

async function runGemini(userId: string, system: string, history: ChatTurn[]): Promise<string> {
  const contents: Content[] = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  for (let i = 0; i < 6; i++) {
    const res = await geminiGenerate({
      contents,
      config: { systemInstruction: system, tools: [{ functionDeclarations: geminiTools }], maxOutputTokens: 4096 },
    });
    const calls = res.functionCalls ?? [];
    if (!calls.length) return res.text?.trim() || "Done.";
    // Keep the model's turn exactly as returned (it may carry thought signatures)
    const modelTurn = res.candidates?.[0]?.content;
    if (modelTurn) contents.push(modelTurn);
    const parts = [];
    for (const c of calls) {
      const output = await callTool(userId, c.name ?? "", (c.args ?? {}) as Record<string, unknown>);
      parts.push({ functionResponse: { id: c.id, name: c.name, response: { result: output } } });
    }
    contents.push({ role: "user", parts });
  }
  return "I had to stop after several steps. Please ask again more specifically.";
}
