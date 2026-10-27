import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-5xl">🐎</div>
      <h1 className="text-xl font-bold">Page not found</h1>
      <Link href="/dashboard" className="btn-primary">Back to dashboard</Link>
    </main>
  );
}
