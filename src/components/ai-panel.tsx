"use client";

import { useActionState, type ReactNode } from "react";
import { Markdown } from "./markdown";

export type AiState = { text?: string; error?: string } | undefined;

/** A form that runs an AI server action and shows its markdown answer. */
export function AiPanel({
  action,
  button,
  children,
  hidden,
  pendingText = "AI is thinking...",
}: {
  action: (prev: AiState, fd: FormData) => Promise<AiState>;
  button: string;
  children?: ReactNode;
  hidden?: Record<string, string>;
  pendingText?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {children}
        <button className="btn-ai" disabled={pending}>
          {pending ? pendingText : `✦ ${button}`}
        </button>
      </form>
      {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state?.text && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
          <Markdown text={state.text} />
        </div>
      )}
    </div>
  );
}
