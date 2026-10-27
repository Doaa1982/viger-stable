import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getBookingPage } from "../data";
import { JoinForm } from "./join-form";

export default async function JoinPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ type?: string }> }) {
  const { slug } = await params;
  const { type = "CUSTOMER" } = await searchParams;
  const { settings } = await getBookingPage(slug);
  const current = await getCurrentUser();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Create your account at {settings.displayName}</h1>
      <p className="text-sm text-stone-600">Free. Use it to follow your bookings, lessons or your horse.</p>
      <div className="card"><JoinForm slug={slug} signedInAs={current?.role === "MEMBER" ? `${current.name} (${current.email})` : null} initialType={type} /></div>
      <p className="text-center text-sm text-stone-500">Already have an account? <Link href="/login" className="link">Sign in</Link></p>
    </div>
  );
}
