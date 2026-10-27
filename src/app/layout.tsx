import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viger Stable - the AI equestrian platform",
  description: "Run your yard, manage horses, buy and sell, and connect with the equestrian community - with AI built in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
