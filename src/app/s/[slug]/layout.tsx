import Link from "next/link";
import type { Metadata } from "next";
import { getBookingPage } from "./data";
import { whatsappLink } from "@/lib/booking";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { settings } = await getBookingPage(slug);
  return { title: `${settings.displayName} - Book online`, description: settings.tagline ?? settings.about ?? undefined };
}

export default async function PublicStableLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { settings } = await getBookingPage(slug);
  const wa = whatsappLink(settings.whatsapp, `Hello ${settings.displayName}, I have a question about booking.`);
  return (
    <div className="min-h-screen bg-brand-50">
      <header className="border-b border-brand-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href={`/s/${slug}`} className="text-lg font-bold text-forest-700">🐎 {settings.displayName}</Link>
          <div className="flex items-center gap-2">
          <Link href={`/s/${slug}/join`} className="btn-secondary">Sign in / Join</Link>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="btn bg-emerald-600 text-white hover:bg-emerald-700">
              WhatsApp us
            </a>
          )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="border-t border-brand-200 py-6 text-center text-xs text-stone-500">
        {settings.address && <div>{settings.address}</div>}
        <div className="mt-1">Online booking by <Link href="/" className="link">Viger Stable</Link></div>
      </footer>
    </div>
  );
}
