"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUp, Sparkles, Loader2, Check, ArrowRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { KeyNotice } from "@/components/lab/idea-lab";
import { eur, shortDate } from "@/lib/format";
import { KINDS, type Action, type FieldSpec } from "@/lib/assist/kinds";

type Msg = { role: "user" | "assistant"; content: string; actions?: Action[]; done?: number[] };
export type Starter = { label: string; prompt?: string; tab?: string };

/**
 * The chat at the top of a team section: knows the section's data, answers, suggests next steps, prepares records
 * the person confirms with one tap, and opens the right tool. Nothing is saved without that tap.
 */
export function SectionAssistant({ section, greeting, helper, groupId, boardId, listId, meId, tools, starters, hasKey: initialKey }: {
  section: string; greeting: string; helper: string; groupId: string; boardId: string | null; listId: string | null; meId: string;
  tools: { id: string; label: string }[]; starters: Starter[]; hasKey: boolean;
}) {
  const t = useTranslations("assist");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const storeKey = `emet-assist-${section}`;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState(initialKey);
  const [chips, setChips] = useState<Starter[]>(starters);
  const list = useRef<HTMLDivElement>(null);

  // Keep the conversation while moving around the dashboard (this browser tab only)
  useEffect(() => { try { const v = sessionStorage.getItem(storeKey); if (v) setMsgs(JSON.parse(v)); } catch { /* ignore */ } }, [storeKey]);
  useEffect(() => { try { sessionStorage.setItem(storeKey, JSON.stringify(msgs.slice(-20))); } catch { /* ignore */ } list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, storeKey]);

  function openTool(tab: string) {
    router.push(`/g/${section}?tab=${tab}#tools`, { scroll: false });
    document.getElementById("tools")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const res = await fetch("/api/assist", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, tools, messages: next.map(({ role, content }) => ({ role, content })) }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (j.error === "no-key") setHasKey(false);
        setMsgs([...next, { role: "assistant", content: t(res.status === 429 ? "limit" : j.error === "no-key" ? "needKey" : "error", { s: j.retryAfter ?? 60 }) }]);
        return;
      }
      setMsgs([...next, { role: "assistant", content: j.reply, actions: j.actions ?? [] }]);
      if (j.suggestions?.length) setChips(j.suggestions.map((s: string) => ({ label: s, prompt: s })));
    } finally { setBusy(false); }
  }

  async function confirm(mi: number, ai: number, a: Extract<Action, { type: "create" }>) {
    const v = a.values;
    let error: { message: string } | null = null;
    if (a.kind === "task") {
      if (!boardId || !listId) return toast("error", t("saveError"));
      const { data, error: e } = await supabase.from("cards").insert({ board_id: boardId, list_id: listId, title: v.title, due_at: v.due ? `${v.due}T12:00:00Z` : null, created_by: meId }).select("id").single();
      error = e;
      if (data) await supabase.from("card_assignees").insert({ card_id: data.id, user_id: meId });
    } else {
      const extra: Record<string, Record<string, unknown>> = {
        sale: { logged_by: meId }, expense: { logged_by: meId },
        content: { owner_id: meId, status: v.planned_for ? "scheduled" : "idea" },
        prospect: { owner_id: meId }, complaint: { owner_id: meId },
        decision: { decided_by: meId, group_id: groupId }, blocker: { group_id: groupId, owner_id: meId },
      };
      ({ error } = await supabase.from(KINDS[a.kind].table).insert({ ...v, ...(extra[a.kind] ?? {}) }));
    }
    if (error) return toast("error", error.message.includes("row-level") || error.message.includes("permission") ? t("noPermission") : t("saveError"));
    toast("ok", t("added"));
    setMsgs((m) => m.map((x, i) => (i === mi ? { ...x, done: [...(x.done ?? []), ai] } : x)));
    router.refresh();
  }

  const fmt = (f: FieldSpec, val: string | number) => f.type === "money" ? eur(Number(val), locale, 2) : f.type === "date" ? shortDate(String(val), locale) : String(val);

  return (
    <section aria-labelledby={`assist-title-${section}`} className="panel overflow-hidden">
      <div className="flex items-start gap-3 px-5 pt-5 sm:px-6">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: "var(--io-gradient)" }}><Sparkles size={18} /></span>
        <div className="min-w-0">
          <h2 id={`assist-title-${section}`} className="text-lg leading-snug font-semibold sm:text-xl">{greeting}</h2>
          <p className="mt-0.5 text-sm text-muted">{helper}</p>
        </div>
      </div>

      {msgs.length > 0 && (
        <div ref={list} className="mt-4 max-h-[min(420px,55dvh)] space-y-4 overflow-y-auto border-t border-line px-5 pt-4 sm:px-6" aria-live="polite">
          {msgs.map((m, mi) => m.role === "user" ? (
            <p key={mi} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] text-brand-contrast">{m.content}</p>
          ) : (
            <div key={mi} className="flex gap-3">
              <span aria-hidden className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-white" style={{ background: "var(--io-gradient)" }}><Sparkles size={13} /></span>
              <div className="min-w-0 flex-1 space-y-2.5">
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                {m.actions?.map((a, ai) => a.type === "open_tool" ? (
                  <button key={ai} onClick={() => openTool(a.tab)} className="flex min-h-11 items-center gap-2 rounded-full bg-brand-soft px-4 text-sm font-semibold text-link hover:brightness-95">
                    {t("open", { tool: tools.find((x) => x.id === a.tab)?.label ?? a.tab })} <ArrowRight size={15} />
                  </button>
                ) : (
                  <div key={ai} className="rounded-2xl border border-line bg-surface-2/60 p-4">
                    <p className="text-xs font-semibold tracking-wide text-muted">{t(`kinds.${a.kind}`)}</p>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                      {(KINDS[a.kind].fields as readonly FieldSpec[]).filter((f) => a.values[f.name] !== undefined).map((f) => (
                        <div key={f.name} className="contents"><dt className="text-muted">{t(`fields.${f.name}`)}</dt><dd className="min-w-0 font-medium break-words">{fmt(f, a.values[f.name])}</dd></div>
                      ))}
                    </dl>
                    {m.done?.includes(ai) ? (
                      <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ok-text"><Check size={16} /> {t("added")}</p>
                    ) : (
                      <div className="mt-3.5 flex gap-2">
                        <button onClick={() => confirm(mi, ai, a)} className="flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-brand-contrast hover:brightness-110 active:scale-[0.97]"><Check size={16} /> {t("add")}</button>
                        <button onClick={() => setMsgs((ms) => ms.map((x, i) => (i === mi ? { ...x, actions: x.actions?.filter((_, j) => j !== ai) } : x)))}
                                className="flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm text-muted hover:text-ink"><X size={15} /> {t("dismiss")}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {busy && <p className="flex items-center gap-2 pb-1 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> {t("thinking")}</p>}
        </div>
      )}

      <div className="space-y-3 p-4 sm:px-6 sm:pb-5">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2/70 p-1.5 pl-4 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
          <label htmlFor={`assist-${section}`} className="sr-only">{t("label")}</label>
          <textarea id={`assist-${section}`} value={input} onChange={(e) => setInput(e.target.value)} rows={1} disabled={!hasKey}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    placeholder={hasKey ? t("placeholder") : t("placeholderNoKey")}
                    className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base outline-none placeholder:text-muted focus-visible:outline-none [field-sizing:content]" />
          <button disabled={!hasKey || busy || !input.trim()} aria-label={t("send")}
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-contrast transition hover:brightness-110 active:scale-95 disabled:opacity-35">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={19} />}
          </button>
        </form>
        {!hasKey && <KeyNotice onConnected={() => setHasKey(true)} />}
        {chips.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {chips.map((c) => (
              <button key={c.label} onClick={() => (c.tab ? openTool(c.tab) : hasKey ? send(c.prompt ?? c.label) : setInput(c.prompt ?? c.label))}
                      className="min-h-10 shrink-0 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink transition hover:border-brand hover:text-link active:scale-[0.97]">
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
