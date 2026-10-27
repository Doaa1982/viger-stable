import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import type { SavedUpload } from "@/lib/uploads";

/**
 * Central AI client. Every AI feature in Viger Stable goes through here.
 *
 * Providers (chosen automatically from .env):
 *   - GEMINI_API_KEY    → Google Gemini (has a free tier in Google AI Studio)
 *   - ANTHROPIC_API_KEY → Anthropic Claude
 *   - neither           → DEMO MODE: each feature returns a rule-based sample answer
 * Set AI_PROVIDER="gemini" or "anthropic" to force one when both keys exist.
 */

export type AiProvider = "gemini" | "anthropic" | "demo";

export function aiProvider(): AiProvider {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (forced === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "demo";
}

export function aiEnabled() {
  return aiProvider() !== "demo";
}

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
/** @deprecated kept for older imports */
export const AI_MODEL = ANTHROPIC_MODEL;

export function aiModelName() {
  const p = aiProvider();
  return p === "gemini" ? GEMINI_MODEL : p === "anthropic" ? ANTHROPIC_MODEL : "demo";
}

let _anthropic: Anthropic | null = null;
export function anthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

let _gemini: GoogleGenAI | null = null;
export function gemini() {
  // Short timeout and no hidden SDK retries: geminiGenerate() retries and falls back to other models itself
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 30_000, retryOptions: { attempts: 1 } } });
  return _gemini;
}

/** Models tried in order when Gemini is overloaded (503) or a model is unavailable. */
function geminiModels() {
  const extra = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.6-flash,gemini-3.5-flash-lite").split(",").map((m) => m.trim()).filter(Boolean);
  return [...new Set([GEMINI_MODEL, ...extra])];
}

function isRetryable(e: unknown) {
  const msg = (e as Error)?.message ?? String(e);
  return /503|504|UNAVAILABLE|DEADLINE_EXCEEDED|high demand|overloaded|500|INTERNAL|429|RESOURCE_EXHAUSTED|not found|404|timed? ?out|timeout|aborted/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type GenParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

/** generateContent with a quick retry and automatic fallback to other Gemini models. */
export async function geminiGenerate(params: Omit<GenParams, "model">) {
  let lastError: unknown;
  // One try per model: when the main model is overloaded, move straight to the next one
  for (const model of geminiModels()) {
    try {
      return await gemini().models.generateContent({ ...params, model } as GenParams);
    } catch (e) {
      lastError = e;
      if (!isRetryable(e)) throw e;
      await sleep(300);
    }
  }
  throw lastError;
}

export const BASE_SYSTEM = `You are the AI inside Viger Stable, an equestrian platform for stables, riders, breeders and equine professionals in Egypt.
Currency is Egyptian pounds (EGP). Be practical, concise and specific to horses.
Health guidance is advisory only: when anything could be serious (colic signs, severe lameness, wounds, fever, not eating), clearly tell the user to call their vet now.`;

type AskOptions = {
  system?: string;
  prompt: string;
  images?: SavedUpload[];
  maxTokens?: number;
  json?: boolean;
};

/** Turn provider errors into a message the user can act on. */
export function friendlyAiError(e: unknown): Error {
  const msg = (e as Error)?.message ?? String(e);
  if (/API key not valid|API_KEY_INVALID|invalid x-api-key|authentication_error|401|403|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg))
    return new Error(`The AI key in .env was refused. Check it and restart the app. (Details: ${msg.slice(0, 160)})`);
  if (/quota|RESOURCE_EXHAUSTED|429|rate.?limit|503|504|UNAVAILABLE|DEADLINE_EXCEEDED|high demand|overloaded/i.test(msg))
    return new Error("The AI is busy or the free daily limit was reached. Wait a minute and try again.");
  if (/(model).*(not found|not supported|does not exist)|404/i.test(msg))
    return new Error(`The AI model "${aiModelName()}" is not available for this key. Change GEMINI_MODEL / ANTHROPIC_MODEL in .env. (Details: ${msg.slice(0, 160)})`);
  if (/fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(msg)) return new Error("Could not reach the AI service. Check your internet connection.");
  return new Error(`AI error: ${msg.slice(0, 200)}`);
}

export async function askText({ system, prompt, images = [], maxTokens = 1200, json = false }: AskOptions): Promise<string> {
  const sys = system ? `${BASE_SYSTEM}\n\n${system}` : BASE_SYSTEM;
  try {
    if (aiProvider() === "gemini") {
      const res = await geminiGenerate({
        contents: [
          {
            role: "user",
            parts: [...images.map((img) => ({ inlineData: { mimeType: img.mediaType, data: img.base64 } })), { text: prompt }],
          },
        ],
        config: {
          systemInstruction: sys,
          // Gemini "thinking" models spend part of the budget reasoning, so allow more room
          maxOutputTokens: Math.max(maxTokens * 4, 4096),
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      });
      const text = res.text?.trim();
      if (!text) throw new Error("The AI returned an empty answer. Please try again.");
      return text;
    }

    const content: Anthropic.ContentBlockParam[] = [
      ...images.map(
        (img): Anthropic.ImageBlockParam => ({
          type: "image",
          source: { type: "base64", media_type: img.mediaType, data: img.base64 },
        }),
      ),
      { type: "text", text: prompt },
    ];
    const res = await anthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: sys,
      messages: [{ role: "user", content }],
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (e) {
    throw friendlyAiError(e);
  }
}

/** Ask for a JSON answer and parse it. The prompt should describe the exact JSON shape. */
export async function askJson<T>(opts: AskOptions): Promise<T> {
  const text = await askText({
    ...opts,
    json: true,
    system: `${opts.system ?? ""}\nReply with ONE valid JSON value only. No markdown fences, no commentary.`,
  });
  return parseJson<T>(text);
}

export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error("The AI returned an unexpected answer. Please try again.");
  }
}
