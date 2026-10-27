"use client";

export function PrintButton() {
  return <button className="btn-secondary btn-sm" onClick={() => window.print()}>Print / PDF</button>;
}
