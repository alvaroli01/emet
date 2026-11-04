"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const ERRORS: Record<string, string> = { expired: "invalid", "not-allowed": "notAllowed", "rate-limit": "rateLimit" };
const INPUT = "mt-1 w-full rounded-xl bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-brand";

export function JoinForm({ token }: { token: string }) {
  const t = useTranslations("join");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("error");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const name = String(new FormData(e.currentTarget).get("name") ?? "");
    const res = await fetch("/api/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name, email }) }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (res?.ok) return setState("sent");
    setError(ERRORS[body?.error ?? ""] ?? "error");
    setState("error");
  }

  if (state === "sent") return <p role="status" className="text-sm">{t("sent", { email })}</p>;
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">{t("intro")}</p>
      <label className="block text-sm font-medium">{t("name")}
        <input name="name" required maxLength={80} autoComplete="name" className={INPUT} />
      </label>
      <label className="block text-sm font-medium">{t("email")}
        <input type="email" required maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
      </label>
      {state === "error" && <p role="alert" className="text-sm text-bad-text">{t(error)}</p>}
      <button disabled={state === "sending"} className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast disabled:opacity-50">
        {t(state === "sending" ? "sending" : "send")}
      </button>
    </form>
  );
}
