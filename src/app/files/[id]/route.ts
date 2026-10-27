import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** Serves uploaded photos and documents stored in the database. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await db.query.files.findFirst({ where: eq(schema.files.id, id) });
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(file.data, "base64"), {
    headers: { "Content-Type": file.mimeType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
