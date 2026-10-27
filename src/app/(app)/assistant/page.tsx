import { requirePerm } from "@/lib/access";
import { aiEnabled } from "@/lib/ai/client";
import { AiTag, PageHeader } from "@/components/ui";
import { Chat } from "./chat";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { clearAssistant, type ChatMessage } from "./actions";

export default async function AssistantPage() {
  const { user } = await requirePerm("assistant");
  const rows = await db.query.assistantMessages.findMany({ where: eq(schema.assistantMessages.userId, user.id), orderBy: asc(schema.assistantMessages.createdAt), limit: 100 });
  const history: ChatMessage[] = rows.map((r) => ({ id: r.id, role: r.role as "user" | "assistant", content: r.content }));
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="AI Yard Assistant"
        subtitle={aiEnabled() ? "Connected - ask anything about your yard" : "Demo mode - add a GEMINI_API_KEY or ANTHROPIC_API_KEY in .env for full conversations"}
        actions={
          <div className="flex items-center gap-2">
            <AiTag kind="added" />
            <form action={clearAssistant}><button className="btn-secondary btn-sm">Clear chat</button></form>
          </div>
        }
      />
      <Chat key={history.at(-1)?.id ?? "empty"} initial={history} />
    </div>
  );
}
