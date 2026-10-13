import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, Percent, Timer, AlertOctagon, ArrowRight } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  GOAL, DEADLINE, totals, pace, onTimeRate, weekly, groupHealth, weekStart,
  type Sale, type Expense, type CardLite, type Health,
} from "@/lib/metrics";
import { eur, pct, longDate, timeAgo } from "@/lib/format";
import { Card } from "@/components/ui";
import { GoalRing } from "@/components/overview/goal-ring";
import { WeeklyChart, CumulativeChart, Legend } from "@/components/overview/charts";
import { ActivityFeed, type ActivityEntry } from "@/components/activity-feed";
import { LiveRefresh } from "@/components/live-refresh";
import { StatusPill, statusFor } from "@/components/status";

const RANGES = ["4", "12", "all"] as const;

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => r === rangeParam) ?? "12";
  const t = await getTranslations("overview");
  const tg = await getTranslations("group.names");
  const locale = await getLocale();
  const { me, groups } = await getSession();
  const supabase = await createClient();
  const thisWeek = weekStart(Date.now());

  const [sales, expenses, cards, boards, blockers, activity, people, complaints, posts, morale] = await Promise.all([
    supabase.from("sales").select("date, amount, cost").returns<Sale[]>(),
    supabase.from("expenses").select("date, amount").returns<Expense[]>(),
    supabase.from("cards").select("board_id, due_at, completed_at").returns<CardLite[]>(),
    supabase.from("boards").select("id, group_id").returns<{ id: string; group_id: string | null }[]>(),
    supabase.from("blockers").select("id, group_id, description, owner_id, created_at").eq("status", "open")
      .order("created_at", { ascending: false })
      .returns<{ id: string; group_id: string; description: string; owner_id: string | null; created_at: string }[]>(),
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(12).returns<ActivityEntry[]>(),
    supabase.from("profiles").select("id, full_name").returns<{ id: string; full_name: string }[]>(),
    supabase.from("complaints").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    supabase.from("content_posts").select("id", { count: "exact", head: true }).gte("planned_for", thisWeek),
    supabase.rpc("morale_weekly"),
  ]);

  const tot = totals(sales.data ?? [], expenses.data ?? []);
  const p = pace(tot.revenue, tot.profit);
  const allCards = cards.data ?? [];
  const onTime = onTimeRate(allCards);
  const series = weekly(sales.data ?? [], expenses.data ?? [], range === "all" ? "all" : Number(range));
  const names = Object.fromEntries((people.data ?? []).map((x) => [x.id, x.full_name]));
  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]));
  const openBlockers = blockers.data ?? [];
  const lastMorale = (morale.data as { week_start: string; avg_score: number }[] | null)?.at(-1);
  const boardGroup = new Map((boards.data ?? []).map((b) => [b.id, b.group_id]));
  const groupCards = (gid: string) => allCards.filter((c) => boardGroup.get(c.board_id) === gid);

  const keyKpi: Record<string, string> = {
    "team-leader": t("kpi.blockers", { count: openBlockers.length }),
    finance: t("kpi.margin", { margin: pct(tot.margin, locale) }),
    customer: t("kpi.complaints", { count: complaints.count ?? 0 }),
    marketing: t("kpi.posts", { count: posts.count ?? 0 }),
    communications: lastMorale ? t("kpi.morale", { score: Number(lastMorale.avg_score).toFixed(1) }) : t("kpi.noMorale"),
  };

  const marginStatus = statusFor(tot.margin, GOAL.minMargin);
  const onTimeStatus = statusFor(onTime.rate, GOAL.onTimeTarget);

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["sales", "expenses", "cards", "blockers", "activity_log", "complaints", "content_posts", "morale_checks"]} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("hi", { name: me.full_name })} 👋</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        <nav aria-label={t("range.label")} className="flex rounded-xl bg-surface-2 p-1 text-sm">
          {RANGES.map((r) => (
            <Link key={r} href={r === "12" ? "/" : `/?range=${r}`} scroll={false} aria-current={range === r ? "true" : undefined}
                  className={`rounded-lg px-3 py-1.5 transition ${range === r ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-ink"}`}>
              {r === "all" ? t("range.all") : t("range.weeks", { count: Number(r) })}
            </Link>
          ))}
        </nav>
      </div>

      <Card className="grid gap-6 sm:grid-cols-2">
        <GoalRing label={t("revenue")} value={tot.revenue} goal={GOAL.revenue} color="var(--series-1)" />
        <GoalRing label={t("profit")} value={Math.max(0, tot.profit)} goal={GOAL.profit} color="var(--series-2)" />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="flex items-center gap-1.5 text-sm text-muted"><CalendarClock size={15} /> {t("until", { date: longDate(DEADLINE, locale) })}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{t("days", { count: p.daysLeft })}</p>
          <p className="text-sm text-muted">{t("weeksLeft", { count: p.weeksLeft })}</p>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm tabular-nums">
            <div className="flex justify-between gap-2"><dt className="text-muted">{t("paceSoFar")}</dt><dd>{t("perWeek", { amount: eur(p.revenuePerWeekSoFar, locale) })}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">{t("paceNeeded")}</dt><dd>{t("perWeek", { amount: eur(p.revenuePerWeekNeeded, locale) })}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted">{t("paceNote")}</p>
        </Card>
        <Card>
          <p className="flex items-center gap-1.5 text-sm text-muted"><Percent size={15} /> {t("marginSoFar")}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{pct(tot.margin, locale)}</p>
          <p className="text-sm text-muted">{t("marginMin")}</p>
          <div className="mt-3 border-t border-line pt-3">
            {marginStatus ? <StatusPill status={marginStatus} label={marginStatus === "good" ? t("aboveMin") : t("belowMin")} />
              : <p className="text-sm text-muted">{t("noSales")}</p>}
          </div>
        </Card>
        <Card>
          <p className="flex items-center gap-1.5 text-sm text-muted"><Timer size={15} /> {t("onTime")}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{pct(onTime.rate, locale)}</p>
          <p className="text-sm text-muted">{t("onTimeTarget")}</p>
          <div className="mt-3 border-t border-line pt-3">
            {onTimeStatus ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusPill status={onTimeStatus} />
                <span className="text-xs text-muted tabular-nums">{t("onTimeCounts", { onTime: onTime.onTime, late: onTime.late })}</span>
              </div>
            ) : <p className="text-sm text-muted">{t("noTasks")}</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t("weeklyChart")}</h2>
            <Legend items={[{ label: t("revenue"), color: "var(--series-1)", square: true }, { label: t("profit"), color: "var(--series-2)", square: true }]} />
          </div>
          {tot.revenue === 0 && tot.expenses === 0
            ? <div className="grid h-56 place-items-center rounded-xl border border-dashed border-line px-6 text-center text-sm text-muted">{t("chartEmpty")}</div>
            : <WeeklyChart data={series} />}
        </Card>
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{t("cumulativeChart")}</h2>
            <Legend items={[
              { label: t("revenue"), color: "var(--series-1)" },
              { label: t("profit"), color: "var(--series-2)" },
              { label: t("evenPace"), color: "var(--muted)", dashed: true },
            ]} />
          </div>
          <CumulativeChart data={series} />
        </Card>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">{t("groups")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const gc = onTimeRate(groupCards(g.id));
            const gb = openBlockers.filter((b) => b.group_id === g.id).length;
            const health: Health = groupHealth(gc.overdueOpen, gb, gc.rate);
            return (
              <Link key={g.id} href={`/g/${g.slug}`} style={{ borderLeft: `4px solid ${g.color}` }}
                    className="group rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold"><span className="mr-1.5">{g.emoji}</span>{tg(g.slug)}</p>
                  <StatusPill status={health} />
                </div>
                <p className="mt-2 text-sm">{keyKpi[g.slug] ?? ""}</p>
                <p className="mt-1 text-xs text-muted tabular-nums">
                  {t("groupLine", { overdue: gc.overdueOpen, blockers: gb, rate: pct(gc.rate, locale) })}
                </p>
                <p className="mt-3 flex items-center gap-1 text-xs font-medium text-muted group-hover:text-ink">{t("openTab")} <ArrowRight size={13} /></p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-1.5 font-semibold"><AlertOctagon size={16} /> {t("blockers")}</h2>
          {openBlockers.length ? (
            <ul className="divide-y divide-line">
              {openBlockers.map((b) => {
                const g = groupMap[b.group_id];
                return (
                  <li key={b.id} className="py-2.5 text-sm">
                    <p>{b.description}</p>
                    <p className="text-xs text-muted">
                      {g ? `${g.emoji} ${tg(g.slug)}` : ""}{b.owner_id ? ` · ${names[b.owner_id] ?? ""}` : ""} · {timeAgo(b.created_at, locale)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : <p className="py-6 text-center text-sm text-muted">{t("noBlockers")} 🙌</p>}
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">{t("activity")} <span className="size-1.5 rounded-full bg-ok" aria-hidden /></h2>
          <ActivityFeed entries={activity.data ?? []} names={names} groups={groupMap} />
        </Card>
      </div>
    </div>
  );
}
