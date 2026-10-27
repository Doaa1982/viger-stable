"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Markdown } from "@/components/markdown";
import { sendToAssistant, type ChatMessage } from "./actions";

const SUGGESTIONS = [
  "What should we do first today?",
  "Which vaccinations or farrier visits are due this month?",
  "Layla's left fore is swollen again - log it and remind Saeed to cold hose her tomorrow at 10",
  "Who is on shift today?",
  "How much have we spent this month, and who still owes us?",
];

export function Chat({ initial }: { initial: ChatMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function send(value: string) {
    const v = value.trim();
    if (!v || pending) return;
    setError(null);
    setText("");
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: v }]);
    start(async () => {
      const res = await sendToAssistant(v);
      if (res.error) setError(res.error);
      if (res.reply) setMessages((m) => [...m, res.reply!]);
    });
  }

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[420px] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-stone-200 bg-white p-4">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <div className="text-4xl">✦</div>
            <p className="mt-2 font-medium">Your AI yard assistant</p>
            <p className="text-sm text-stone-500">Ask a question or report something - it reads and updates your yard.</p>
            <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-left text-xs text-violet-800 hover:bg-violet-100">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user" ? "max-w-[80%] rounded-2xl rounded-br-sm bg-forest-600 px-4 py-2 text-sm text-white" : "max-w-[85%] rounded-2xl rounded-bl-sm bg-violet-50 px-4 py-3"}>
              {m.role === "user" ? m.content : <Markdown text={m.content} />}
            </div>
          </div>
        ))}
        {pending && <div className="text-sm text-violet-600">✦ Thinking…</div>}
        <div ref={end} />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} className="input" placeholder="Ask or tell the assistant something…" />
        <button className="btn-ai" disabled={pending || !text.trim()}>Send</button>
      </form>
    </div>
  );
}
