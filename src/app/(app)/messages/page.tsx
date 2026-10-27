import Link from "next/link";
import { and, asc, desc, eq, isNull, ne, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/client";
import { Card, Empty, HorseAvatar, PageHeader, Stars } from "@/components/ui";
import { cn, egp, fmtDateTime } from "@/lib/utils";
import { sendMessage } from "./actions";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const user = await requireUser();
  const { with: other } = await searchParams;

  if (other) {
    await db.update(schema.messages).set({ readAt: new Date() }).where(and(eq(schema.messages.senderId, other), eq(schema.messages.receiverId, user.id), isNull(schema.messages.readAt)));
  }
  const all = await db.query.messages.findMany({
    where: or(eq(schema.messages.senderId, user.id), eq(schema.messages.receiverId, user.id)),
    with: { sender: true, receiver: true },
    orderBy: desc(schema.messages.createdAt),
  });
  const convos = new Map<string, { name: string; last: string; at: Date; unread: number }>();
  for (const m of all) {
    const o = m.senderId === user.id ? m.receiver : m.sender;
    const c = convos.get(o.id) ?? { name: o.name, last: m.content, at: m.createdAt, unread: 0 };
    if (m.receiverId === user.id && !m.readAt) c.unread++;
    convos.set(o.id, c);
  }

  let thread: Awaited<ReturnType<typeof loadThread>> = [];
  let otherUser: typeof schema.users.$inferSelect | undefined;
  if (other) {
    otherUser = await db.query.users.findFirst({ where: eq(schema.users.id, other) });
    thread = await loadThread(user.id, other);
  }
  const people = await db.query.users.findMany({ where: ne(schema.users.id, user.id), orderBy: asc(schema.users.name) });

  return (
    <div>
      <PageHeader title="Messages" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Conversations">
          <form action="/messages" className="mb-3 flex gap-2">
            <select name="with" className="input" defaultValue="">
              <option value="" disabled>New message to…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn-secondary btn-sm">Open</button>
          </form>
          {convos.size === 0 ? <Empty>No messages yet.</Empty> : (
            <ul className="divide-y divide-stone-100">
              {[...convos.entries()].map(([id, c]) => (
                <li key={id}>
                  <Link href={`/messages?with=${id}`} className={cn("block rounded px-2 py-2 text-sm hover:bg-stone-50", other === id && "bg-emerald-50")}>
                    <div className="flex justify-between"><strong>{c.name}</strong>{c.unread > 0 && <span className="badge bg-forest-600 text-white">{c.unread}</span>}</div>
                    <p className="truncate text-stone-500">{c.last}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={otherUser ? otherUser.name : "Select a conversation"} className="lg:col-span-2">
          {otherUser ? (
            <>
              <div className="mb-4 max-h-[55vh] space-y-3 overflow-y-auto">
                {thread.map((m) => (
                  <div key={m.id} className={cn("max-w-[80%] rounded-xl p-3 text-sm", m.senderId === user.id ? "ml-auto bg-forest-600 text-white" : "bg-stone-100")}>
                    {m.horse && (
                      <Link href={`/marketplace/${m.horse.id}`} className="mb-2 flex items-center gap-2 rounded-lg bg-white p-2 text-stone-800">
                        <HorseAvatar name={m.horse.name} url={m.horse.photoUrl} size={36} />
                        <span><strong>{m.horse.name}</strong><br /><span className="text-xs">{m.horse.breed} · {m.horse.showPrice ? egp(m.horse.price) : <Stars n={m.horse.budgetStars} />}</span></span>
                      </Link>
                    )}
                    <p className="whitespace-pre-line">{m.content}</p>
                    <div className={cn("mt-1 text-[10px]", m.senderId === user.id ? "text-emerald-100" : "text-stone-400")}>
                      {fmtDateTime(m.createdAt)}{m.senderId === user.id && (m.readAt ? " · Seen" : " · Sent")}
                    </div>
                  </div>
                ))}
                {thread.length === 0 && <Empty>Say hello 👋</Empty>}
              </div>
              <form action={sendMessage} className="flex gap-2">
                <input type="hidden" name="to" value={otherUser.id} />
                <input name="content" className="input" placeholder="Write a message…" required autoComplete="off" />
                <SubmitButton>Send</SubmitButton>
              </form>
            </>
          ) : (
            <Empty>Choose someone on the left.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

function loadThread(me: string, other: string) {
  return db.query.messages.findMany({
    where: or(and(eq(schema.messages.senderId, me), eq(schema.messages.receiverId, other)), and(eq(schema.messages.senderId, other), eq(schema.messages.receiverId, me))),
    with: { horse: true },
    orderBy: asc(schema.messages.createdAt),
  });
}
