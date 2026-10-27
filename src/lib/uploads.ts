import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 8 * 1024 * 1024;

export type SavedUpload = { url: string; base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

/**
 * Saves an uploaded image to /public/uploads and returns its public URL plus base64
 * (the base64 is used to send the image to the AI vision model).
 * For production, replace this with cloud storage (S3, Cloudflare R2, etc.).
 */
export async function saveImage(file: File | null): Promise<SavedUpload | null> {
  if (!file || file.size === 0) return null;
  if (!ALLOWED.includes(file.type)) throw new Error("Please upload a JPG, PNG, WEBP or GIF image.");
  if (file.size > MAX_BYTES) throw new Error("Image is larger than 8 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const name = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return { url: `/uploads/${name}`, base64: bytes.toString("base64"), mediaType: file.type as SavedUpload["mediaType"] };
}
