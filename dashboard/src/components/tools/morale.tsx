"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { shortDate } from "@/lib/format";
import type { Member } from "@/lib/boards";

const FACES = ["😣", "😕", "😐", "🙂", "😄"];

/** Weekly morale check: everyone rates their week 1–5. Only the average is public. */
export function MoraleCheck({ week, meId, mine, weekly, comments, canSeeComments, members }: {
  week: string; meId: string;
  mine: { score: number; comment: string | null } | null;
  weekly: { week_start: string; avg_score: number; responses: number }[];
  comments: { id: string; week_start: string; user_id: string; score: number; comment: string }[];
  canSeeComments: boolean; members: Member[];
}) {
  const t = useTranslations("tools.morale");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [score, setScore] = useState<number | null>(mine?.score ?? null);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!score) return;
    setBusy(true);
    const { error } = await createClient().from("morale_checks")
      .upsert({ week_start: week, user_id: meId, score, comment: comment.trim() || null }, { onConflict: "week_start,user_id" });
    setBusy(false);
    if (error) return toast("error", t("error"));
    toast("ok", t("thanks"));
    router.refresh();
  }

  const data = weekly.map((w) => ({ week: w.week_start, avg: Number(w.avg_score), n: Number(w.responses) }));
  const name = (id: string) => members.find((m) => m.id === id)?.full_name ?? "—";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h3 className="font-semibold">{t("title")}</h3>
        <p className="mb-4 text-xs text-muted">{t("subtitle")}</p>
        <div className="flex justify-between gap-1" role="radiogroup" aria-label={t("question")}>
          {FACES.map((f, i) => (
            <button key={i} type="button" role="radio" aria-checked={score === i + 1} aria-label={t("scoreLabel", { n: i + 1 })}
                    onClick={() => setScore(i + 1)}
                    className={`flex flex-1 flex-col items-center rounded-xl border py-2 text-2xl transition ${
                      score === i + 1 ? "border-ink/40 bg-surface-2" : "border-line opacity-70 hover:opacity-100"}`}>
              {f}<span className="text-xs text-muted">{i + 1}</span>
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
                  placeholder={t("commentPlaceholder")} className="input mt-3" />
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted"><Lock size={11} /> {t("privacy")}</p>
        <button disabled={!score || busy} className="mt-3 w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-brand-contrast disabled:opacity-50">
          {mine ? t("update") : t("submit")}
        </button>
      </form>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h3 className="font-semibold">{t("average")}</h3>
        <p className="mb-3 text-xs text-muted">{t("averageHint")}</p>
        {data.length ? (
          <div className="h-44">
            <ResponsiveContainer initialDimension={{ width: 480, height: 200 }}>
              <LineChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="week" tickFormatter={(w) => shortDate(w, locale)} stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} width={24} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                    <p className="font-medium">{shortDate(String(label), locale)}</p>
                    <p className="tabular-nums">{t("avgTooltip", { avg: Number(payload[0].value).toFixed(1), n: payload[0].payload.n })}</p>
                  </div>
                ) : null} />
                <Line dataKey="avg" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="py-8 text-center text-sm text-muted">{t("noData")}</p>}

        {canSeeComments && comments.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted"><Lock size={11} /> {t("comments")}</p>
            <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
              {comments.map((c) => (
                <li key={c.id}>
                  <span className="mr-1">{FACES[c.score - 1]}</span>
                  <span className="font-medium">{name(c.user_id)}</span>
                  <span className="text-xs text-muted"> · {shortDate(c.week_start, locale)}</span>
                  <p className="text-muted">{c.comment}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
