"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Lightbulb, Sparkles, ThumbsUp, MessageSquare, ArrowLeft, Trash2, RotateCcw, Loader2, Check, X, Globe, ListChecks,
  TrendingUp, TrendingDown, AlertTriangle, CircleHelp, GitBranch, Package, Wrench, PartyPopper, MonitorSmartphone, Shapes, KeyRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { IdeaExtras } from "./extras";
import { useToast } from "@/components/toast";
import { timeAgo } from "@/lib/format";
import { CRITERIA, type Analysis, type Verdict } from "@/lib/lab/score";

export type LabIdea = {
  id: string; created_by: string | null; parent_id: string | null; title: string; pitch: string;
  kind: Kind; status: "new" | "researching" | "analyzed" | "failed";
  research: { notes: string; sources: { title: string; url: string }[] } | null;
  analysis: Analysis | null; score: number | null; created_at: string;
};
export type LabComment = { id: string; idea_id: string; author_id: string; body: string; created_at: string };
type Kind = "product" | "service" | "event" | "online" | "other";
const KINDS: Kind[] = ["product", "service", "event", "online", "other"];
const KIND_ICON = { product: Package, service: Wrench, event: PartyPopper, online: MonitorSmartphone, other: Shapes } as const;
const VERDICT: Record<Verdict, { color: string; Icon: typeof Check }> = {
  strong: { color: "var(--ok-text)", Icon: TrendingUp },
  promising: { color: "var(--climbed)", Icon: Sparkles },
  weak: { color: "var(--warn-text)", Icon: AlertTriangle },
  not_recommended: { color: "var(--bad-text)", Icon: TrendingDown },
};
type Sort = "score" | "votes" | "new";
type Progress = { id: string; step: "research" | "analyze"; waitUntil?: number } | null;

export function IdeaLab({ ideas, votes, comments, names, meId, isAdmin, hasKey: initialKey, initialOpen }: {
  ideas: LabIdea[]; votes: { idea_id: string; user_id: string }[]; comments: LabComment[];
  names: Record<string, string>; meId: string; isAdmin: boolean; hasKey: boolean; initialOpen?: string;
}) {
  const tlh = useTranslations("hero");
  const t = useTranslations("lab");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null);
  const [sort, setSort] = useState<Sort>("score");
  const [title, setTitle] = useState("");
  const [pitch, setPitch] = useState("");
  const [kind, setKind] = useState<Kind>("product");
  const [progress, setProgress] = useState<Progress>(null);
  const [hasKey, setHasKey] = useState(initialKey);

  const voteCount = (id: string) => votes.filter((v) => v.idea_id === id).length;
  const sorted = [...ideas].sort((a, b) =>
    sort === "votes" ? voteCount(b.id) - voteCount(a.id) || (b.score ?? -1) - (a.score ?? -1)
      : sort === "score" ? (b.score ?? -1) - (a.score ?? -1) || b.created_at.localeCompare(a.created_at)
      : b.created_at.localeCompare(a.created_at));
  const open = ideas.find((i) => i.id === openId) ?? null;

  // Research → verdict, each step retried after Groq's free per-minute limit; research is optional
  async function run(id: string) {
    const step = async (s: "research" | "analyze") => {
      for (let attempt = 0; attempt < 4; attempt++) {
        setProgress({ id, step: s });
        const res = await fetch("/api/lab/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, step: s }) }).catch(() => null);
        const data = res ? await res.json().catch(() => ({})) : {};
        if (res?.ok) return "ok";
        if (data.error === "no-key") { setHasKey(false); return "no-key"; }
        if (data.error !== "limit") return "failed";
        const wait = (data.retryAfter ?? 30) + 2;
        setProgress({ id, step: s, waitUntil: Date.now() + wait * 1000 });
        await new Promise((r) => setTimeout(r, wait * 1000));
      }
      return "failed";
    };
    const r = await step("research");
    if (r === "no-key") { setProgress(null); return; }
    if (r === "failed") toast("error", t("researchFailed"));
    const a = await step("analyze");
    setProgress(null);
    if (a === "ok") toast("ok", t("analyzed")); else if (a !== "no-key") toast("error", t("analysisFailed"));
    router.refresh();
  }

  async function create(e: React.FormEvent | null, parent?: { id: string; title: string; pitch: string; kind: Kind }) {
    e?.preventDefault();
    const body: { title: string; pitch: string; kind: Kind; parent_id: string | null } = parent
      ? { title: parent.title.slice(0, 140), pitch: parent.pitch, kind: parent.kind, parent_id: parent.id }
      : { title: title.trim(), pitch: pitch.trim(), kind, parent_id: null };
    if (body.title.length < 2) return;
    const { data, error } = await supabase.from("lab_ideas").insert(body).select("id").single();
    if (error || !data) return toast("error", t("saveError"));
    if (!parent) { setTitle(""); setPitch(""); }
    setOpenId(data.id);
    router.refresh();
    if (hasKey) run(data.id);
  }

  return (
    <>
      <section id="pitch" className="panel p-5 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight"><Lightbulb size={18} className="text-warn-text" /> {tlh("lab.pitch")}</h2>
        <form onSubmit={(e) => create(e)} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-start">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} aria-label={t("titleLabel")} maxLength={140} className="input text-base font-medium" />
          <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder={t("pitchPlaceholder")} aria-label={t("pitchLabel")} rows={2} maxLength={4000} className="input resize-y" />
          <button disabled={title.trim().length < 2 || !!progress}
                  className="flex h-[46px] items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast transition active:scale-[0.98] disabled:opacity-50">
            <Sparkles size={16} /> {hasKey ? t("analyze") : t("addOnly")}
          </button>
          <div className="flex flex-wrap gap-1.5 lg:col-span-3">
            {KINDS.map((k) => {
              const Icon = KIND_ICON[k];
              return (
                <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${kind === k ? "bg-brand text-brand-contrast" : "bg-surface-2 text-muted hover:text-ink"}`}>
                  <Icon size={14} /> {t(`kinds.${k}`)}
                </button>
              );
            })}
          </div>
        </form>
        {!hasKey && <KeyNotice onConnected={() => setHasKey(true)} />}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className={`min-w-0 space-y-3 ${open ? "hidden lg:block" : ""}`}>
          <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1 text-sm" role="tablist" aria-label={t("sort")}>
            {(["score", "votes", "new"] as const).map((s) => (
              <button key={s} role="tab" aria-selected={sort === s} onClick={() => setSort(s)}
                      className={`flex-1 rounded-lg py-1.5 transition ${sort === s ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-ink"}`}>{t(`sorts.${s}`)}</button>
            ))}
          </div>
          {sorted.length ? (
            <ul className="space-y-2">
              {sorted.map((i) => (
                <IdeaRow key={i.id} idea={i} votes={voteCount(i.id)} comments={comments.filter((c) => c.idea_id === i.id).length}
                         author={i.created_by ? names[i.created_by] : undefined} running={progress?.id === i.id}
                         parent={i.parent_id ? ideas.find((x) => x.id === i.parent_id)?.title : undefined}
                         active={i.id === openId} onOpen={() => setOpenId(i.id)} />
              ))}
            </ul>
          ) : (
            <div className="panel p-8 text-center">
              <Lightbulb size={26} className="mx-auto mb-2 text-muted" />
              <p className="font-medium">{t("empty")}</p>
              <p className="mt-1 text-sm text-muted">{t("emptyHint")}</p>
            </div>
          )}
        </div>

        {open ? (
          <Detail key={open.id} idea={open} names={names} meId={meId} isAdmin={isAdmin} hasKey={hasKey}
                  votes={votes.filter((v) => v.idea_id === open.id)} comments={comments.filter((c) => c.idea_id === open.id)}
                  parent={open.parent_id ? ideas.find((x) => x.id === open.parent_id) : undefined}
                  variants={ideas.filter((x) => x.parent_id === open.id)}
                  progress={progress?.id === open.id ? progress : null}
                  onBack={() => setOpenId(null)} onOpen={setOpenId} onRun={() => run(open.id)}
                  onExplore={(v) => create(null, { id: open.id, title: v.title, pitch: v.pitch, kind: open.kind })} />
        ) : (
          <div className="panel hidden place-items-center p-10 text-center lg:grid">
            <div className="max-w-sm">
              <Sparkles size={28} className="mx-auto mb-3 text-muted" />
              <p className="font-medium">{t("pick")}</p>
              <p className="mt-1 text-sm text-muted">{t("pickHint")}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ScoreBadge({ score, verdict, size = "sm" }: { score: number; verdict: Verdict; size?: "sm" | "lg" }) {
  const t = useTranslations("lab");
  const v = VERDICT[verdict];
  return (
    <span className={`flex shrink-0 flex-col items-center justify-center rounded-xl ${size === "lg" ? "size-20" : "size-12"}`}
          style={{ background: `color-mix(in srgb, ${v.color} 13%, transparent)`, color: v.color }}
          aria-label={`${score}/100 · ${t(`verdicts.${verdict}`)}`}>
      <span className={`readout leading-none ${size === "lg" ? "text-3xl" : "text-lg"}`}>{score}</span>
      {size === "lg" && <span className="mt-1 text-[10px] font-medium opacity-80">/100</span>}
    </span>
  );
}

function IdeaRow({ idea, votes, comments, author, running, parent, active, onOpen }: {
  idea: LabIdea; votes: number; comments: number; author?: string; running: boolean; parent?: string; active: boolean; onOpen: () => void;
}) {
  const t = useTranslations("lab");
  const Icon = KIND_ICON[idea.kind];
  const a = idea.analysis;
  return (
    <li>
      <button onClick={onOpen} aria-current={active ? "true" : undefined}
              className={`flex w-full items-center gap-3 rounded-[12px] p-3 text-left transition-[background,box-shadow] duration-200 ${
                active ? "bg-surface shadow-[var(--shadow-lift)]" : "hover:bg-surface hover:shadow-[var(--shadow)]"}`}>
        {a && idea.score !== null ? <ScoreBadge score={idea.score} verdict={a.verdict} />
          : <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">{running || idea.status === "researching" ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{idea.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><Icon size={12} /> {t(`kinds.${idea.kind}`)}</span>
            {a && <span style={{ color: VERDICT[a.verdict].color }}>{t(`verdicts.${a.verdict}`)}</span>}
            {parent && <span className="inline-flex items-center gap-1"><GitBranch size={11} /> {parent}</span>}
            {author && <span>{author}</span>}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted tabular-nums">
          <span className="inline-flex items-center gap-1"><ThumbsUp size={12} /> {votes}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare size={12} /> {comments}</span>
        </span>
      </button>
    </li>
  );
}

function Detail({ idea, names, meId, isAdmin, hasKey, votes, comments, parent, variants, progress, onBack, onOpen, onRun, onExplore }: {
  idea: LabIdea; names: Record<string, string>; meId: string; isAdmin: boolean; hasKey: boolean;
  votes: { user_id: string }[]; comments: LabComment[]; parent?: LabIdea; variants: LabIdea[]; progress: Progress;
  onBack: () => void; onOpen: (id: string) => void; onRun: () => void; onExplore: (v: { title: string; pitch: string }) => void;
}) {
  const t = useTranslations("lab");
  const tc = useTranslations("lab.criteria");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const a = idea.analysis;
  const mine = votes.some((v) => v.user_id === meId);
  const canManage = idea.created_by === meId || isAdmin;
  const Icon = KIND_ICON[idea.kind];

  async function vote() {
    const q = mine ? supabase.from("lab_votes").delete().match({ idea_id: idea.id, user_id: meId }) : supabase.from("lab_votes").insert({ idea_id: idea.id });
    const { error } = await q;
    if (error) toast("error", t("saveError")); else router.refresh();
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    const { error } = await supabase.from("lab_comments").insert({ idea_id: idea.id, body: comment.trim() });
    if (error) return toast("error", t("saveError"));
    setComment(""); router.refresh();
  }
  async function remove() {
    if (!confirm(t("confirmDelete", { title: idea.title }))) return;
    const { error } = await supabase.from("lab_ideas").delete().eq("id", idea.id);
    if (error) return toast("error", t("saveError"));
    onBack(); router.refresh();
  }
  // The 7-day test becomes real tasks on the General board, assigned to whoever presses the button
  async function toTasks() {
    if (!a?.test_in_7_days.length) return;
    setBusy(true);
    const { data: board } = await supabase.from("boards").select("id, board_lists(id, position)").eq("slug", "general").single();
    const list = (board?.board_lists as { id: string; position: number }[] | undefined)?.sort((x, y) => x.position - y.position)[0];
    if (!board || !list) { setBusy(false); return toast("error", t("saveError")); }
    const due = new Date(Date.now() + 7 * 864e5).toISOString();
    const rows = a.test_in_7_days.map((s, i) => ({ id: crypto.randomUUID(), board_id: board.id, list_id: list.id, title: `${idea.title}: ${s}`.slice(0, 300), position: Date.now() / 1000 + i, created_by: meId, due_at: due }));
    const { error } = await supabase.from("cards").insert(rows);
    if (!error) await supabase.from("card_assignees").insert(rows.map((r) => ({ card_id: r.id, user_id: meId })));
    setBusy(false);
    if (error) toast("error", t("saveError")); else toast("ok", t("tasksCreated", { count: rows.length }));
  }

  return (
    <article className="panel min-w-0 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 lg:hidden" aria-label={t("back")}><ArrowLeft size={17} /></button>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium"><Icon size={13} /> {t(`kinds.${idea.kind}`)}</span>
        <span className="text-xs text-muted">{idea.created_by ? names[idea.created_by] : "—"} · {timeAgo(idea.created_at, locale)}</span>
        <span className="ml-auto flex items-center gap-1">
          <button onClick={vote} aria-pressed={mine}
                  className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm transition ${mine ? "bg-brand text-brand-contrast" : "text-muted hover:bg-surface-2 hover:text-ink"}`}>
            <ThumbsUp size={15} /> <span className="tabular-nums">{votes.length}</span>
          </button>
          {canManage && hasKey && !progress && (
            <button onClick={onRun} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("rerun")} title={t("rerun")}><RotateCcw size={15} /></button>
          )}
          {canManage && <button onClick={remove} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-bad-text" aria-label={t("delete")} title={t("delete")}><Trash2 size={15} /></button>}
        </span>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight text-balance">{idea.title}</h2>
      {parent && (
        <button onClick={() => onOpen(parent.id)} className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><GitBranch size={12} /> {t("variationOf", { title: parent.title })}</button>
      )}
      {idea.pitch && <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-muted">{idea.pitch}</p>}

      {progress ? (
        <Running progress={progress} />
      ) : !a ? (
        <div className="mt-6 rounded-xl bg-surface-2/60 p-5 text-sm">
          {idea.status === "failed" ? <p className="mb-3">{t("analysisFailed")}</p> : <p className="mb-3 text-muted">{hasKey ? t("notAnalyzed") : t("needKey")}</p>}
          {canManage && hasKey && <button onClick={onRun} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 font-medium text-brand-contrast"><Sparkles size={15} /> {t("analyze")}</button>}
        </div>
      ) : (
        <div className="mt-6 space-y-7">
          <section className="flex items-start gap-4">
            <ScoreBadge score={a.score} verdict={a.verdict} size="lg" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-lg font-semibold" style={{ color: VERDICT[a.verdict].color }}>
                {(() => { const V = VERDICT[a.verdict].Icon; return <V size={18} />; })()} {t(`verdicts.${a.verdict}`)}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed">{a.summary}</p>
              {!idea.research?.sources?.length && <p className="mt-2 text-xs text-muted">{t("noResearchNote")}</p>}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">{t("howScored")}</h3>
            <ul className="space-y-3">
              {a.criteria.map((c) => {
                const w = CRITERIA.find((x) => x.key === c.key)?.weight ?? 0;
                const tone = c.score >= 7 ? "var(--ok)" : c.score >= 5 ? "var(--climbed)" : c.score >= 4 ? "var(--warn)" : "var(--bad)";
                return (
                  <li key={c.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{tc(c.key)} <span className="text-xs font-normal text-muted">· {t("weight", { w })}</span></span>
                      <span className="readout text-base">{c.score}<span className="text-xs text-muted">/10</span></span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${c.score * 10}%`, background: tone }} />
                    </div>
                    {c.why && <p className="mt-1 text-xs leading-relaxed text-muted">{c.why}</p>}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <ListBlock icon={<TrendingUp size={15} className="text-ok-text" />} title={t("strengths")} items={a.strengths} />
            <ListBlock icon={<TrendingDown size={15} className="text-bad-text" />} title={t("weaknesses")} items={a.weaknesses} />
            {a.risks.length > 0 && <ListBlock icon={<AlertTriangle size={15} className="text-warn-text" />} title={t("risks")} items={a.risks} />}
            {a.questions.length > 0 && <ListBlock icon={<CircleHelp size={15} className="text-climbed" />} title={t("questions")} items={a.questions} />}
          </section>

          {(a.numbers.price || a.numbers.units_for_goal) && (
            <section className="rounded-xl bg-surface-2/60 p-4">
              <h3 className="mb-3 text-sm font-semibold">{t("numbers")}</h3>
              <dl className="grid grid-cols-3 gap-3">
                <div><dt className="text-xs text-muted">{t("price")}</dt><dd className={a.numbers.price.length > 14 ? "text-sm font-medium" : "readout text-lg"}>{a.numbers.price || "—"}</dd></div>
                <div><dt className="text-xs text-muted">{t("unitCost")}</dt><dd className={a.numbers.unit_cost.length > 14 ? "text-sm font-medium" : "readout text-lg"}>{a.numbers.unit_cost || "—"}</dd></div>
                <div><dt className="text-xs text-muted">{t("margin")}</dt><dd className={a.numbers.margin.length > 14 ? "text-sm font-medium" : "readout text-lg"}>{a.numbers.margin || "—"}</dd></div>
              </dl>
              {a.numbers.units_for_goal && <p className="mt-3 text-sm"><span className="font-medium">{t("toGoal")}</span> {a.numbers.units_for_goal}</p>}
              {a.numbers.assumptions && <p className="mt-1 text-xs text-muted">{a.numbers.assumptions}</p>}
            </section>
          )}

          {a.test_in_7_days.length > 0 && (
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t("test")}</h3>
                <button onClick={toTasks} disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-medium hover:bg-line disabled:opacity-60">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />} {t("toTasks")}
                </button>
              </div>
              <ol className="space-y-1.5 text-sm">
                {a.test_in_7_days.map((s, i) => (
                  <li key={i} className="flex gap-2.5"><span className="readout grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs">{i + 1}</span><span className="pt-0.5">{s}</span></li>
                ))}
              </ol>
            </section>
          )}

          {a.variations.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("variations")}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {a.variations.map((v, i) => {
                  const done = variants.find((c) => c.title === v.title.slice(0, 140));
                  return (
                    <li key={i} className="flex flex-col rounded-xl p-3.5 shadow-[var(--shadow)] ring-1 ring-[var(--panel-edge)]">
                      <p className="font-medium">{v.title}</p>
                      <p className="mt-1 flex-1 text-sm text-muted">{v.pitch}</p>
                      {v.why_better && <p className="mt-2 text-xs"><span className="font-medium">{t("whyBetter")}</span> {v.why_better}</p>}
                      {done ? (
                        <button onClick={() => onOpen(done.id)} className="mt-3 self-start text-xs font-medium underline underline-offset-2">{t("openVariation")}{done.score !== null ? ` · ${done.score}/100` : ""}</button>
                      ) : (
                        <button onClick={() => onExplore(v)} className="mt-3 flex items-center gap-1.5 self-start rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-brand-contrast">
                          <GitBranch size={12} /> {t("explore")}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!!idea.research?.sources?.length && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Globe size={14} /> {t("sources", { count: idea.research.sources.length })}</h3>
              <ul className="space-y-1 text-sm">
                {idea.research.sources.map((s) => (
                  <li key={s.url} className="truncate"><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-climbed hover:underline">{s.title}</a> <span className="text-xs text-muted">{new URL(s.url).hostname.replace(/^www\./, "")}</span></li>
                ))}
              </ul>
              {idea.research.notes && (
                <>
                  <button onClick={() => setNotesOpen((v) => !v)} className="mt-2 text-xs text-muted underline underline-offset-2 hover:text-ink">{notesOpen ? t("hideNotes") : t("showNotes")}</button>
                  {notesOpen && <p className="mt-2 max-h-80 overflow-y-auto rounded-lg bg-surface-2/60 p-3 text-xs leading-relaxed whitespace-pre-wrap">{idea.research.notes}</p>}
                </>
              )}
            </section>
          )}

          <IdeaExtras idea={idea} hasKey={hasKey} />
        </div>
      )}

      <section className="mt-8 border-t border-line pt-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><MessageSquare size={14} /> {t("discussion")}</h3>
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <p className="text-xs text-muted"><span className="font-medium text-ink">{names[c.author_id] ?? "—"}</span> · {timeAgo(c.created_at, locale)}</p>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("commentPlaceholder")} className="input py-2" maxLength={2000} />
          <button className="rounded-xl bg-brand px-3 text-sm font-medium text-brand-contrast">{t("send")}</button>
        </form>
      </section>
    </article>
  );
}

function ListBlock({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">{icon} {title}</h3>
      <ul className="space-y-1.5 text-sm leading-relaxed">{items.map((s, i) => <li key={i} className="flex gap-2"><span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted" />{s}</li>)}</ul>
    </div>
  );
}

function Running({ progress }: { progress: NonNullable<Progress> }) {
  const t = useTranslations("lab");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const steps = ["research", "analyze"] as const;
  const at = steps.indexOf(progress.step);
  return (
    <div className="mt-6 rounded-xl bg-surface-2/60 p-5" aria-live="polite">
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-3 text-sm ${i > at ? "text-muted" : ""}`}>
            <span className={`grid size-7 place-items-center rounded-full ${i < at ? "bg-ok text-white" : i === at ? "bg-brand text-brand-contrast" : "bg-surface text-muted"}`}>
              {i < at ? <Check size={14} /> : i === at ? <Loader2 size={14} className="animate-spin" /> : i + 1}
            </span>
            <span><span className="font-medium">{t(`steps.${s}`)}</span>{i === at && <span className="block text-xs text-muted">{t(`steps.${s}Hint`)}</span>}</span>
          </li>
        ))}
      </ol>
      {progress.waitUntil && progress.waitUntil > now && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><AlertTriangle size={13} className="text-warn-text" /> {t("limitWait", { seconds: Math.ceil((progress.waitUntil - now) / 1000) })}</p>
      )}
    </div>
  );
}

export function KeyNotice({ onConnected }: { onConnected: () => void }) {
  const t = useTranslations("lab");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/ai-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    setBusy(false);
    if (res.ok) onConnected(); else setError(t("keyError"));
  }
  return (
    <form onSubmit={connect} className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/70 p-3 text-sm">
      <KeyRound size={15} className="shrink-0 text-muted" />
      <span className="min-w-48 flex-1 text-muted">{t("keyNotice")} <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-climbed underline">console.groq.com/keys</a></span>
      <input ref={input} type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="gsk_…" aria-label="Groq API key" className="input w-48 py-1.5" autoComplete="off" />
      <button disabled={busy || !key} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-medium text-brand-contrast disabled:opacity-60">
        {busy && <Loader2 size={13} className="animate-spin" />}{t("connect")}
      </button>
      {error && <span role="alert" className="w-full text-xs text-bad-text"><X size={12} className="inline" /> {error}</span>}
    </form>
  );
}
