import "server-only";
import { headers } from "next/headers";

/**
 * Email through Resend (https://resend.com - free for 3,000 emails a month).
 * Set RESEND_API_KEY in Vercel. Until then, nothing is sent and the app keeps working.
 * EMAIL_FROM: the sender, e.g. "Viger Stable <bookings@vigerstable.com>" once your domain is verified in Resend.
 * Without a verified domain Resend only delivers to your own Resend account email (good for testing).
 */
export function emailEnabled() {
  return !!process.env.RESEND_API_KEY;
}

type Mail = { to: string; subject: string; heading: string; lines: string[]; button?: { text: string; url: string }; replyTo?: string | null; footer?: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function render(m: Mail) {
  const body = m.lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5">${esc(l).replace(/\n/g, "<br>")}</p>`).join("");
  const button = m.button
    ? `<p style="margin:20px 0"><a href="${esc(m.button.url)}" style="background:#24543f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${esc(m.button.text)}</a></p><p style="font-size:12px;color:#78716c;word-break:break-all">${esc(m.button.url)}</p>`
    : "";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f4;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;color:#1c1917">
<div style="font-size:18px;font-weight:700;color:#24543f;margin-bottom:16px">🐎 ${esc(m.heading)}</div>${body}${button}
<p style="margin-top:24px;font-size:12px;color:#a8a29e">${esc(m.footer ?? "Sent by Viger Stable")}</p></div></div>`;
  const text = [m.heading, "", ...m.lines, ...(m.button ? ["", `${m.button.text}: ${m.button.url}`] : [])].join("\n");
  return { html, text };
}

/** Send an email. Never throws - returns whether it was sent so the page can say so. */
export async function sendEmail(m: Mail): Promise<{ sent: boolean; reason?: string }> {
  if (!emailEnabled()) return { sent: false, reason: "Email is not set up yet (RESEND_API_KEY)." };
  if (!/^\S+@\S+\.\S+$/.test(m.to)) return { sent: false, reason: "No valid email address." };
  const { html, text } = render(m);
  try {
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Viger Stable <onboarding@resend.dev>",
        to: [m.to],
        subject: m.subject,
        html,
        text,
        ...(m.replyTo ? { reply_to: m.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Email failed", res.status, detail);
      return { sent: false, reason: res.status === 403 ? "The email service refused it - verify your domain in Resend to send to anyone." : `The email service answered ${res.status}.` };
    }
    return { sent: true };
  } catch (e) {
    console.error("Email error", e);
    return { sent: false, reason: "Could not reach the email service." };
  }
}

/** The site address, e.g. https://viger-stable.vercel.app - for links in emails. */
export async function siteUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "viger-stable.vercel.app";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}
