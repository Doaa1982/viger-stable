import "server-only";
import { db, schema } from "@/db";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 4 * 1024 * 1024; // photos are resized in the browser first (see components/image-input.tsx)

export type SavedUpload = { url: string; base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

/**
 * Saves an uploaded image in the database and returns its URL (/files/<id>) plus base64
 * (the base64 is also sent to the AI vision model).
 * Storing in the database keeps hosting simple and free for the pilot. For large-scale use,
 * move files to object storage (Cloudflare R2, S3, Vercel Blob) and keep only the URL here.
 */
export async function saveImage(file: File | null): Promise<SavedUpload | null> {
  if (!file || file.size === 0) return null;
  if (!ALLOWED.includes(file.type)) throw new Error("Please upload a JPG, PNG, WEBP or GIF image.");
  if (file.size > MAX_BYTES) throw new Error("Image is larger than 4 MB. Please use a smaller photo.");
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const [row] = await db.insert(schema.files).values({ mimeType: file.type, data: base64, size: file.size }).returning({ id: schema.files.id });
  return { url: `/files/${row.id}`, base64, mediaType: file.type as SavedUpload["mediaType"] };
}
