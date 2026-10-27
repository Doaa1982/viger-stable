"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg text-center">
      <h2 className="font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-stone-500">{error.message}</p>
      <button onClick={reset} className="btn-primary mt-4">Try again</button>
    </div>
  );
}
