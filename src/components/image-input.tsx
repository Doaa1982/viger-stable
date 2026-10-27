"use client";

import { useRef, useState } from "react";

const MAX_SIDE = 1600; // px - enough for AI reading and photos, keeps uploads small
const QUALITY = 0.82;

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // e.g. HEIC on browsers that cannot decode it
  }
}

/**
 * File input for photos. Resizes images in the browser before upload so phone photos
 * stay well under the hosting upload limit (about 4.5 MB per request on Vercel).
 */
export function ImageInput({ name, multiple = false, capture, className = "text-sm" }: { name: string; multiple?: boolean; capture?: "environment" | "user"; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <input
        ref={ref}
        type="file"
        name={name}
        accept="image/*"
        multiple={multiple}
        capture={capture}
        className={className}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []).slice(0, multiple ? 4 : 1);
          if (!files.length) return;
          setBusy(true);
          const small = await Promise.all(files.map(shrink));
          const dt = new DataTransfer();
          small.forEach((f) => dt.items.add(f));
          if (ref.current) ref.current.files = dt.files;
          setBusy(false);
        }}
      />
      {busy && <span className="text-xs text-stone-500">Preparing photo…</span>}
    </span>
  );
}
