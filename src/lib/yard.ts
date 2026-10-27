/** How a stall is shown everywhere: "Stable 1 · Box 2" (paddocks keep their own name). */
export function stallLabel(s: { name: string; building: string; kind?: string } | null | undefined) {
  if (!s) return null;
  return s.kind === "PADDOCK" ? s.name : `${s.building} · ${s.name}`;
}

/** Parse box numbers like "1,2,3", "1-6" or "1-3, 7". Max 50 at a time. */
export function parseBoxNumbers(input: string) {
  const out: number[] = [];
  for (const part of input.split(/[,\s،]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y);
      for (let n = a; n <= b && out.length < 50; n++) out.push(n);
    } else if (/^\d+$/.test(part)) out.push(Number(part));
  }
  return [...new Set(out)].slice(0, 50);
}
