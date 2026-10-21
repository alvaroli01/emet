"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Users, Loader2, Crown, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

type Take = { key: string; headline: string; analysis: string; recommendation: "go" | "test" | "drop" };
type Council = { id: string; status: string; advisors: Take[]; reviews: { strongest: string; weakest: string; missed: string; notes: { letter: string; comment: string }[] } | null;
  chairman: { verdict: "go" | "test" | "drop"; summary: string; agree: string[]; clash: string[]; blind_spots: string[]; recommendation?: string; first_step: string } | null; created_at: string };
const ORDER = ["contrarian", "first_principles", "expansionist", "outsider", "executor"];
const recTone = { go: "text-ok-text", test: "text-warn-text", drop: "text-bad-text" } as const;

export function CouncilPanel({ ideaId, hasKey, ready = false }: { ideaId: string; hasKey: boolean; ready?: boolean }) {
  const t = useTranslations("lab.council");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [c, setC] = useState<Council | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [wait, setWait] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []); // React may mount twice in development

  async function load() {
    const { data } = await supabase.from("lab_councils").select("*").eq("idea_id", ideaId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (alive.current) { setC(data as Council | null); setLoaded(true); }
    return data as Council | null;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [ideaId]);
  // Every analysed idea gets the council automatically (once): the chairman can make the verdict harsher
  const started = useRef(false);
  useEffect(() => {
    if (hasKey && ready && loaded && !c && !started.current) { started.current = true; run(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKey, ready, loaded, c]);

  async function run(resume?: string) {
    let id = resume;
    setStep(0);
    for (let i = 0; i < 20 && alive.current; i++) {
      const res = await fetch("/api/lab/council", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea_id: ideaId, council_id: id }) }).catch(() => null);
      const j = await res?.json().catch(() => ({}));
      if (res?.status === 429) { for (let s = Math.min(90, j.retryAfter ?? 60); s > 0 && alive.current; s--) { setWait(s); await new Promise((r) => setTimeout(r, 1000)); } setWait(0); continue; }
      if (!res?.ok) { toast("error", t(j?.error === "no-key" ? "needKey" : "error")); break; }
      id = j.council_id; setStep(j.step ?? 0);
      await load();
      if (j.status !== "running") { router.refresh(); break; }
    }
    setStep(null);
  }

  const running = step !== null;
  const ch = c?.chairman;
  const takes = [...(c?.advisors ?? [])].sort((x, y) => ORDER.indexOf(x.key) - ORDER.indexOf(y.key));
  return (
    <section className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Users size={14} /> {t("title")}</h3>
        {hasKey && !running && loaded && (
          <button onClick={() => (c?.status === "running" ? run(c.id) : run())} className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium hover:bg-border">
            {c?.status === "running" ? t("resume") : c ? t("again") : t("run")}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">{t("explain")}</p>

      {running && (
        <>
          <ol className="mt-3 grid grid-cols-7 gap-1" aria-label={t("progress")}>
            {[...ORDER, "review", "chair"].map((k, i) => (
              <li key={k} title={t(`who.${k}`)} className="min-w-0">
                <span className={`block h-1 rounded-full ${i < (step ?? 0) ? "bg-climbed" : i === step ? "animate-pulse bg-[var(--trail)]" : "bg-surface-2"}`} />
              </li>
            ))}
          </ol>
          {/* One label for the step running now (seven labels never fit in a narrow panel) */}
          <p className="mt-1.5 text-xs text-muted">{t(`who.${[...ORDER, "review", "chair"][Math.min(step ?? 0, 6)]}`)} · {Math.min((step ?? 0) + 1, 7)}/7</p>
        </>
      )}
      {wait > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs text-warn-text"><Loader2 size={12} className="animate-spin" /> {t("waiting", { s: wait })}</p>}

      {ch && (
        <div className="mt-4 rounded-lg bg-surface-2/60 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Crown size={14} /> {t("chairman")} <span className={`ml-1 ${recTone[ch.verdict]}`}>{t(`rec.${ch.verdict}`)}</span></p>
          <p className="mt-1 text-sm">{ch.summary}</p>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            {([["agree", ch.agree], ["clash", ch.clash], ["blind", ch.blind_spots]] as const).map(([k, items]) => items.length > 0 && (
              <div key={k}><p className="text-xs font-medium text-muted">{t(k)}</p><ul className="mt-1 list-disc space-y-0.5 pl-4">{items.map((x) => <li key={x}>{x}</li>)}</ul></div>
            ))}
          </div>
          {ch.recommendation && <p className="mt-3 text-sm"><span className="font-medium">{t("recommendation")}</span> {ch.recommendation}</p>}
          {ch.first_step && <p className="mt-3 text-sm"><span className="font-medium">{t("firstStep")}</span> {ch.first_step}</p>}
        </div>
      )}

      {takes.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {takes.map((x) => (
            <li key={x.key}>
              <button onClick={() => setOpen(open === x.key ? null : x.key)} aria-expanded={open === x.key} className="flex w-full items-start gap-2 py-2.5 text-left text-sm whitespace-normal">
                <span className="w-24 shrink-0 font-medium sm:w-32">{t(`who.${x.key}`)}
                  {c?.reviews?.strongest === x.key && <span className="block text-[10px] font-normal text-ok-text">{t("strongest")}</span>}
                  {c?.reviews?.weakest === x.key && <span className="block text-[10px] font-normal text-muted">{t("weakest")}</span>}</span>
                <span className="min-w-0 flex-1 break-words">{x.headline}</span>
                <span className={`shrink-0 text-xs font-medium ${recTone[x.recommendation]}`}>{t(`rec.${x.recommendation}`)}</span>
                <ChevronDown size={14} className={`mt-0.5 shrink-0 text-muted transition-transform ${open === x.key ? "rotate-180" : ""}`} />
              </button>
              {open === x.key && (
                <div className="pb-3 pl-0 text-sm text-muted sm:pl-34">
                  <p className="whitespace-pre-wrap">{x.analysis}</p>
                  {c?.reviews?.notes.find((n) => n.letter === x.key)?.comment && <p className="mt-2 text-xs"><span className="font-medium text-ink">{t("peers")}</span> {c.reviews.notes.find((n) => n.letter === x.key)!.comment}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {c?.reviews?.missed && <p className="mt-2 text-xs text-muted"><span className="font-medium text-ink">{t("missed")}</span> {c.reviews.missed}</p>}
      {loaded && !c && !running && <p className="mt-3 text-sm text-muted">{hasKey ? t("empty") : t("needKey")}</p>}
      {c?.status === "failed" && !running && <p className="mt-2 text-xs text-bad-text">{t("failed")}</p>}
    </section>
  );
}
