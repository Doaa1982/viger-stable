import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { SubmitButton } from "@/components/client";
import { Badge, Card, Empty, PageHeader, Tabs } from "@/components/ui";
import { fmtDateTime, label } from "@/lib/utils";
import { addComment, createPost, deletePost, toggleFollow, toggleLike } from "./actions";

const TAGS = ["COMPETITION", "HOME", "SALE", "UPDATE"];
const TAG_TONE: Record<string, "violet" | "green" | "amber" | "gray"> = { COMPETITION: "violet", HOME: "green", SALE: "amber", UPDATE: "gray" };

export default async function ArenaPage({ searchParams }: { searchParams: Promise<{ tag?: string; feed?: string }> }) {
  const user = await requireUser();
  const { tag, feed } = await searchParams;
  const following = (await db.query.follows.findMany({ where: eq(schema.follows.followerId, user.id) })).map((f) => f.followingId);

  let posts = await db.query.posts.findMany({
    with: { author: true, horse: true, likes: true, comments: { with: { author: true } } },
    orderBy: desc(schema.posts.createdAt),
    limit: 100,
  });
  if (tag) posts = posts.filter((p) => p.tag === tag);
  if (feed === "following") posts = posts.filter((p) => following.includes(p.authorId) || p.authorId === user.id);
  const myHorses = await db.query.horses.findMany({ where: eq(schema.horses.ownerId, user.id) });
  const suggestions = await db.query.users.findMany({ limit: 50 });
  const toFollow = suggestions.filter((u) => u.id !== user.id && !following.includes(u.id)).slice(0, 5);
  const followed = following.length ? await db.query.users.findMany({ where: inArray(schema.users.id, following) }) : [];

  const base = feed ? `/arena?feed=${feed}` : "/arena";
  return (
    <div>
      <PageHeader title="The Arena" subtitle="What's happening in the Egyptian horse world" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <form action={createPost} className="space-y-3">
              <textarea name="content" rows={3} className="input" placeholder="Share a result, a training moment or news…" required />
              <div className="flex flex-wrap gap-2">
                <select name="tag" className="input w-auto" defaultValue="UPDATE">{TAGS.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
                {myHorses.length > 0 && (
                  <select name="horseId" className="input w-auto" defaultValue=""><option value="">Tag a horse</option>{myHorses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
                )}
                <SubmitButton>Post</SubmitButton>
              </div>
            </form>
          </Card>
          <Tabs
            active={tag ? `${base}${base.includes("?") ? "&" : "?"}tag=${tag}` : base}
            items={[{ href: base, label: "All" }, ...TAGS.map((t) => ({ href: `${base}${base.includes("?") ? "&" : "?"}tag=${t}`, label: label(t) }))]}
          />
          <div className="flex gap-2 text-sm">
            <Link href="/arena" className={!feed ? "font-semibold" : "link"}>Everyone</Link> · <Link href="/arena?feed=following" className={feed ? "font-semibold" : "link"}>Following</Link>
          </div>
          {posts.length === 0 && <Empty>No posts here yet.</Empty>}
          {posts.map((p) => {
            const liked = p.likes.some((l) => l.userId === user.id);
            return (
              <Card key={p.id}>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <strong>{p.author.name}</strong> <span className="text-xs text-stone-400">· {fmtDateTime(p.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={TAG_TONE[p.tag]}>{label(p.tag)}</Badge>
                    {p.authorId === user.id && <form action={deletePost.bind(null, p.id)}><button className="text-xs text-stone-400 hover:text-red-600">Delete</button></form>}
                  </div>
                </div>
                <p className="whitespace-pre-line text-sm">{p.content}</p>
                {p.horse && <Link href={`/marketplace/${p.horse.id}`} className="mt-2 inline-block text-sm link">🐎 {p.horse.name}</Link>}
                <div className="mt-3 flex items-center gap-4 border-t border-stone-100 pt-2 text-sm">
                  <form action={toggleLike.bind(null, p.id)}><button className={liked ? "text-red-600" : "text-stone-500"}>{liked ? "♥" : "♡"} {p.likes.length}</button></form>
                  <span className="text-stone-500">💬 {p.comments.length}</span>
                </div>
                {p.comments.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {p.comments.map((c) => <li key={c.id}><strong>{c.author.name}</strong> {c.content}</li>)}
                  </ul>
                )}
                <form action={addComment.bind(null, p.id)} className="mt-2 flex gap-2">
                  <input name="content" className="input" placeholder="Write a comment…" autoComplete="off" />
                  <button className="btn-secondary btn-sm">Reply</button>
                </form>
              </Card>
            );
          })}
        </div>
        <div className="space-y-4">
          <Card title="Who to follow">
            {toFollow.length === 0 ? <p className="text-sm text-stone-500">You follow everyone!</p> : (
              <ul className="space-y-2 text-sm">
                {toFollow.map((u) => (
                  <li key={u.id} className="flex items-center justify-between">
                    <span>{u.name}<br /><span className="text-xs text-stone-500">{label(u.trade ?? u.role)}{u.city && ` · ${u.city}`}</span></span>
                    <form action={toggleFollow.bind(null, u.id)}><button className="btn-secondary btn-sm">Follow</button></form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {followed.length > 0 && (
            <Card title="Following">
              <ul className="space-y-2 text-sm">
                {followed.map((u) => (
                  <li key={u.id} className="flex items-center justify-between">
                    {u.name}
                    <form action={toggleFollow.bind(null, u.id)}><button className="text-xs text-stone-500">Unfollow</button></form>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
