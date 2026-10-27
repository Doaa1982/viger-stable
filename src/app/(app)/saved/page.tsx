import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { HorseCard } from "@/components/horse-card";
import { Empty, PageHeader } from "@/components/ui";
import { updateSavedNote } from "../marketplace/actions";

export default async function SavedPage() {
  const user = await requireUser();
  const saved = await db.query.savedHorses.findMany({
    where: eq(schema.savedHorses.userId, user.id),
    with: { horse: { with: { owner: true } } },
    orderBy: desc(schema.savedHorses.createdAt),
  });
  const folders = [...new Set(saved.map((s) => s.folder))];
  return (
    <div className="space-y-6">
      <PageHeader title="Saved horses" subtitle="Your shortlists" />
      {saved.length === 0 && <Empty>Save horses from the marketplace to compare them here.</Empty>}
      {folders.map((folder) => (
        <section key={folder}>
          <h2 className="mb-3 font-semibold">{folder}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {saved.filter((s) => s.folder === folder).map((s) => (
              <div key={s.horseId} className="space-y-2">
                <HorseCard h={s.horse} />
                <form action={updateSavedNote.bind(null, s.horseId)} className="flex gap-2">
                  <input name="note" defaultValue={s.note ?? ""} placeholder="Private note" className="input" />
                  <input name="folder" defaultValue={s.folder} className="input w-28" />
                  <button className="btn-secondary btn-sm">Save</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
