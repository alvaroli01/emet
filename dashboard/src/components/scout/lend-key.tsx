"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HeartHandshake, Sparkles, KeyRound, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast";

/** "Lend my AI key to Scout": opt-in team key pool. Scout uses at most 60% of a lent key's daily allowance. */
export function LendKey({ hasKey, lend: initial, usedToday, lenders }: { hasKey: boolean; lend: boolean; usedToday: number; lenders: string[] }) {
  const t = useTranslations("scout");
  const router = useRouter();
  const toast = useToast();
  const [lend, setLend] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !lend;
    setLend(next); setBusy(true);
    const res = await fetch("/api/ai-key", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lend: next }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setLend(!next); toast("error", t("stepError")); return; }
    router.refresh();
  }

  return (
    <section className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <HeartHandshake size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium">{t("lendTitle")}</p>
          <p className="mt-0.5 text-xs text-muted">{hasKey ? t("lendHelp") : t("lendNeedKey")}</p>
          {lend && <p className="mt-1 text-xs text-muted">{t("lendUsed", { n: Math.round(usedToday / 1000) })}</p>}
          <p className="mt-1 text-xs text-muted">{lenders.length ? t("lenders", { count: lenders.length, names: lenders.join(", ") }) : t("lendersNone")}</p>
        </div>
      </div>
      <button type="button" role="switch" aria-checked={lend} aria-label={t("lendTitle")} disabled={!hasKey || busy} onClick={toggle}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${lend ? "bg-brand" : "bg-surface-2 ring-1 ring-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${lend ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </section>
  );
}

/** Backup AI: connect your own free Mistral key (like the Groq key). Scout uses it only when every Groq key is out. */
export function MistralKey({ last4: initial }: { last4: string | null }) {
  const t = useTranslations("scout");
  const toast = useToast();
  const [last4, setLast4] = useState(initial);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState("");

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/ai-key/mistral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) }).catch(() => null);
    setBusy(false);
    const j = await res?.json().catch(() => ({}));
    if (res?.ok) { setLast4(j.last4); setKey(""); toast("ok", t("mistralDone")); } else setError(t("mistralError"));
  }
  async function disconnect() {
    setBusy(true);
    const res = await fetch("/api/ai-key/mistral", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) setLast4(null);
  }

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles size={18} className="shrink-0 text-brand" aria-hidden />
        <p className="text-sm font-medium">{t("mistralTitle")}</p>
        {last4 && <span className="rounded-full bg-ok/15 px-2 py-0.5 text-xs text-ok-text">{t("mistralConnected", { last4 })}</span>}
        <button type="button" onClick={() => setHelp(!help)} aria-expanded={help} className="ml-auto text-xs text-climbed underline-offset-2 hover:underline">{t("mistralHow")}</button>
      </div>
      <p className="mt-1 text-xs text-muted">{t("mistralHelp")}</p>
      {help && (
        <ol className="mt-3 list-decimal space-y-1 rounded-xl bg-surface-2/70 p-3 pl-7 text-xs">
          <li>{t("mistralStep1")} <a href="https://console.mistral.ai" target="_blank" rel="noopener noreferrer" className="text-climbed underline">console.mistral.ai</a></li>
          <li>{t("mistralStep2")}</li>
          <li>{t("mistralStep3")}</li>
          <li>{t("mistralStep4")}</li>
        </ol>
      )}
      {last4 ? (
        <button type="button" onClick={disconnect} disabled={busy} className="mt-3 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-60">{t("mistralDisconnect")}</button>
      ) : (
        <form onSubmit={connect} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <KeyRound size={15} className="shrink-0 text-muted" aria-hidden />
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={t("mistralPlaceholder")} aria-label={t("mistralTitle")} className="input w-56 py-1.5" autoComplete="off" />
          <button disabled={busy || !key} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-medium text-brand-contrast disabled:opacity-60">
            {busy && <Loader2 size={13} className="animate-spin" />}{t("mistralConnect")}
          </button>
          {error && <span role="alert" className="w-full text-xs text-bad-text">{error}</span>}
        </form>
      )}
    </section>
  );
}
