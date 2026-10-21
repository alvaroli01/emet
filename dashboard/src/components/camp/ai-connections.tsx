"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Cpu, KeyRound, Loader2, HeartHandshake, Sparkles, Plug } from "lucide-react";
import { GoogleConnect } from "./google-calendar";
import { useToast } from "@/components/toast";

type Status = { connected: boolean; last4: string | null; lend: boolean; usedToday: number; mistral: string | null; lenders: string[] };

/**
 * "AI connections": one small button (Base camp, Scout) that opens a compact panel to connect the free Groq key,
 * lend it to Scout, and connect the free Mistral backup key. Loads its own status when opened.
 */
export function AiConnections() {
  const t = useTranslations("ai");
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Status | null>(null);
  const box = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/ai-key").catch(() => null);
    if (res?.ok) setS(await res.json());
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const dot = !s ? "bg-muted" : s.connected ? "bg-ok" : "bg-bad";
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium ring-1 ring-line hover:text-link">
        <Cpu size={13} /> {t("button")} <span className={`size-1.5 rounded-full ${dot}`} />
      </button>
      {open && (
        <div role="dialog" aria-label={t("button")}
             className="absolute top-full right-0 z-40 mt-2 w-[min(23rem,calc(100vw-2rem))] space-y-3 rounded-2xl border border-line bg-solid p-4 text-left text-ink shadow-[var(--shadow-lift)]">
          {!s ? <Loader2 size={16} className="animate-spin text-muted" /> : <>
            <KeyRow kind="groq" last4={s.last4} onChange={load} />
            <Lend s={s} onChange={load} />
            <KeyRow kind="mistral" last4={s.mistral} onChange={load} />
          </>}
        </div>
      )}
    </div>
  );
}

/** One key: status + disconnect, or paste + connect (with short "how to get it" steps). */
function KeyRow({ kind, last4, onChange, steps = false }: { kind: "groq" | "mistral"; last4: string | null; onChange: () => void; steps?: boolean }) {
  const t = useTranslations("ai");
  const router = useRouter();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [how, setHow] = useState(steps); // on the profile, the steps show straight away when not connected
  const [error, setError] = useState("");
  const url = kind === "groq" ? "/api/ai-key" : "/api/ai-key/mistral";

  async function send(method: "POST" | "DELETE") {
    setBusy(true); setError("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify({ key }) : undefined }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(t("error"));
    setKey(""); onChange(); router.refresh();
  }

  return (
    <div className="rounded-xl bg-surface-2/60 p-3">
      <div className="flex items-center gap-2">
        {kind === "groq" ? <KeyRound size={14} className="text-brand" aria-hidden /> : <Sparkles size={14} className="text-brand" aria-hidden />}
        <p className="text-sm font-medium">{t(`${kind}.title`)}</p>
        {last4
          ? <span className="ml-auto rounded-full bg-ok/15 px-2 py-0.5 text-[11px] text-ok-text">••••{last4}</span>
          : <button type="button" onClick={() => setHow(!how)} aria-expanded={how} className="ml-auto text-[11px] text-climbed hover:underline">{t("how")}</button>}
      </div>
      <p className="mt-0.5 text-[11px] text-muted">{t(`${kind}.help`)}</p>
      {how && !last4 && (
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[11px]">
          <li>{t("open")} <a href={kind === "groq" ? "https://console.groq.com/keys" : "https://console.mistral.ai"} target="_blank" rel="noopener noreferrer" className="text-climbed underline">{kind === "groq" ? "console.groq.com/keys" : "console.mistral.ai"}</a></li>
          <li>{t(`${kind}.step2`)}</li>
          <li>{t(`${kind}.step3`)}</li>
        </ol>
      )}
      {last4 ? (
        <button type="button" onClick={() => send("DELETE")} disabled={busy} className="mt-2 text-[11px] text-muted hover:text-bad-text disabled:opacity-60">{t("disconnect")}</button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); send("POST"); }} className="mt-2 flex gap-2">
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={kind === "groq" ? "gsk_…" : t("mistral.placeholder")}
                 aria-label={t(`${kind}.title`)} className="input min-w-0 flex-1 py-1 text-xs" autoComplete="off" />
          <button disabled={busy || !key} className="flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-brand-contrast disabled:opacity-60">
            {busy && <Loader2 size={12} className="animate-spin" />}{t("connect")}
          </button>
        </form>
      )}
      {error && <p role="alert" className="mt-1 text-[11px] text-bad-text">{error}</p>}
    </div>
  );
}

/** Lend my Groq key to Scout (opt-in; Scout stops at 60% of the daily allowance). */
function Lend({ s, onChange }: { s: Status; onChange: () => void }) {
  const t = useTranslations("ai");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const res = await fetch("/api/ai-key", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lend: !s.lend }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) toast("error", t("error")); else onChange();
  }
  return (
    <div className="rounded-xl bg-surface-2/60 p-3">
      <div className="flex items-center gap-2">
        <HeartHandshake size={14} className="text-brand" aria-hidden />
        <p className="text-sm font-medium">{t("lend.title")}</p>
        <button type="button" role="switch" aria-checked={s.lend} aria-label={t("lend.title")} disabled={!s.connected || busy} onClick={toggle}
                className={`relative ml-auto h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${s.lend ? "bg-brand" : "bg-surface-2 ring-1 ring-line"}`}>
          <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${s.lend ? "left-[18px]" : "left-0.5"}`} />
        </button>
      </div>
      <p className="mt-0.5 text-[11px] text-muted">{s.connected ? t("lend.help") : t("lend.needKey")}</p>
      {s.connected && <p className="mt-1 text-[11px] text-muted">{t("lend.used", { n: Math.round(s.usedToday / 1000) })}</p>}
      <p className="mt-1 text-[11px] text-muted">{s.lenders.length ? t("lend.lenders", { count: s.lenders.length, names: s.lenders.join(", ") }) : t("lend.none")}</p>
    </div>
  );
}

/** Your profile → "My connections": every connection in one place; what isn't connected shows how to connect it. */
export function MyConnections() {
  const t = useTranslations("ai");
  const [s, setS] = useState<Status | null>(null);
  async function load() {
    const res = await fetch("/api/ai-key").catch(() => null);
    if (res?.ok) setS(await res.json());
  }
  useEffect(() => { load(); }, []);
  // Avatar menu → "My connections" links to #connections: scroll here (also when already on the profile)
  useEffect(() => {
    const go = () => { if (location.hash === "#connections") document.getElementById("connections")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [s]);
  return (
    <section id="connections" className="panel scroll-mt-24 p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Plug size={18} className="text-brand" /> {t("sectionTitle")}</h2>
      <p className="mt-1 text-sm text-muted">{t("sectionHelp")}</p>
      {!s ? <Loader2 size={16} className="mt-4 animate-spin text-muted" /> : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <KeyRow kind="groq" last4={s.last4} onChange={load} steps />
          <KeyRow kind="mistral" last4={s.mistral} onChange={load} steps />
          <Lend s={s} onChange={load} />
          <div className="rounded-xl bg-surface-2/60 p-3 text-sm"><GoogleConnect /></div>
        </div>
      )}
    </section>
  );
}
