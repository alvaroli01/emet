import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, Percent, Timer, AlertOctagon, ArrowRight, Move3d, LayoutDashboard } from "lucide-react";
import { PageHero } from "@/components/shell/page-hero";
import { SectionTabs } from "@/components/section-tabs";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  GOAL, DEADLINE, totals, pace, onTimeRate, weekly, groupHealth, weekStart,
  type Sale, type Expense, type CardLite, type Health,
} from "@/lib/metrics";
import { eur, pct, longDate, timeAgo } from "@/lib/format";
import { Card } from "@/components/ui";
import { MountainLazy } from "@/components/summit/mountain-lazy";
import { Altimeter } from "@/components/summit/altimeter";
import { WeeklyChart, CumulativeChart, Legend } from "@/components/overview/charts";
import { ActivityFeed, type ActivityEntry } from "@/components/activity-feed";
import { LiveRefresh } from "@/components/live-refresh";
import { StatusPill, statusFor } from "@/components/status";
import { GroupBadge } from "@/components/group-icon";

const RANGES = ["4", "12", "all"] as const;
/** Base camps every €5K on the way to the €30K summit */
const CAMPS = 6;

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string; tab?: string }> }) {
  const { range: rangeParam, tab } = await searchParams;
  const range = RANGES.find((r) => r === rangeParam) ?? "12";
  const t = await getTranslations("overview");
  const th = await getTranslations("hero");
  const tn = await getTranslations("nav");
  const tg = await getTranslations("group.names");
  const locale = await getLocale();
  const { groups } = await getSession();
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

  const revPct = Math.min(1, Math.max(0, tot.revenue / GOAL.revenue));
  const profitPct = Math.min(1, Math.max(0, tot.profit / GOAL.profit));
  const campSize = GOAL.revenue / CAMPS;
  const nextCampN = Math.floor(tot.revenue / campSize) + 1;
  const nextCamp = nextCampN <= CAMPS ? { n: nextCampN, amount: nextCampN * campSize } : null;

  const marginStatus = statusFor(tot.margin, GOAL.minMargin);
  const onTimeStatus = statusFor(onTime.rate, GOAL.onTimeTarget);

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["sales", "expenses", "cards", "blockers", "activity_log", "complaints", "content_posts", "morale_checks"]} />

      <PageHero
        section={{ label: tn("overview"), icon: <LayoutDashboard size={16} /> }}
        title={th("overview.title")}
        subtitle={th("overview.subtitle")}
        visualTitle={th("climbTitle")}
        lines={[
          ...(openBlockers.length ? [{ text: th("overview.blockers", { count: openBlockers.length }), tone: "warn" as const }] : []),
          ...((complaints.count ?? 0) > 0 ? [{ text: th("overview.complaints", { count: complaints.count ?? 0 }), tone: "bad" as const, href: "/g/customer?tab=complaints" }] : []),
          { text: nextCamp ? t("toCamp", { amount: eur(nextCamp.amount - tot.revenue, locale), n: nextCamp.n }) : t("reached"), tone: "info" as const },
          { text: th("overview.pace", { amount: eur(p.revenuePerWeekNeeded, locale) }), tone: p.revenuePerWeekSoFar >= p.revenuePerWeekNeeded ? "ok" as const : "warn" as const },
        ]}
        stats={[
          { label: t("revenue"), value: tot.revenue, kind: "eur", hint: t("of", { goal: eur(GOAL.revenue, locale) }) },
          { label: t("profit"), value: Math.max(0, tot.profit), kind: "eur", hint: t("of", { goal: eur(GOAL.profit, locale) }) },
          { label: t("until", { date: longDate(DEADLINE, locale) }), value: p.daysLeft, kind: "num", hint: t("weeksLeft", { count: p.weeksLeft }) },
        ]}
        aside={
          <div className="max-w-md space-y-3">
            <Altimeter value={revPct} steps={CAMPS} color="var(--climbed)" label={t("ringLabel", { label: t("revenue"), value: eur(tot.revenue, locale), goal: eur(GOAL.revenue, locale), pct: Math.round(revPct * 100) })} />
            <Altimeter value={profitPct} color="var(--series-2)" label={t("ringLabel", { label: t("profit"), value: eur(Math.max(0, tot.profit), locale), goal: eur(GOAL.profit, locale), pct: Math.round(profitPct * 100) })} />
          </div>
        }
        visual={
          <>
            <MountainLazy
              className="size-full"
              progress={revPct}
              nextCampAt={nextCamp ? nextCamp.amount / GOAL.revenue : null}
              ariaLabel={t("mountainLabel", { pct: pct(revPct, locale), goal: eur(GOAL.revenue, locale) })}
              labels={{
                summit: t("summit", { amount: eur(GOAL.revenue, locale) }),
                here: tot.revenue > 0 ? eur(tot.revenue, locale) : null,
                nextCamp: nextCamp ? t("camp", { n: nextCamp.n, amount: eur(nextCamp.amount, locale) }) : null,
              }}
            />
            <p className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 text-xs text-muted"><Move3d size={13} aria-hidden /> {t("dragHint")}</p>
          </>
        }
      />

      <SectionTabs label={t("sections")} initial={tab} tabs={[
        { id: "teams", label: t("groups"), node: (
          <div className="space-y-4">
      <section>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const gc = onTimeRate(groupCards(g.id));
            const gb = openBlockers.filter((b) => b.group_id === g.id).length;
            const health: Health = groupHealth(gc.overdueOpen, gb, gc.rate);
            return (
              <Link key={g.id} href={`/g/${g.slug}`} className="panel panel-lift group relative overflow-hidden p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2.5 font-semibold">
                    <GroupBadge slug={g.slug} color={g.color} size={32} />
                    {tg(g.slug)}
                  </p>
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
                      {g ? tg(g.slug) : ""}{b.owner_id ? ` · ${names[b.owner_id] ?? ""}` : ""} · {timeAgo(b.created_at, locale)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : <p className="py-6 text-center text-sm text-muted">{t("noBlockers")}</p>}
        </Card>
          </div>
        ) },
        { id: "money", label: t("trend"), node: (
          <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="flex items-center gap-1.5 text-sm text-muted"><CalendarClock size={15} /> {t("paceTitle")}</p>
          <p className="readout mt-1 text-2xl">{t("perWeek", { amount: eur(p.revenuePerWeekNeeded, locale) })}</p>
          <p className="text-sm text-muted">{t("paceNeeded")}</p>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm tabular-nums">
            <div className="flex justify-between gap-2"><dt className="text-muted">{t("paceSoFar")}</dt><dd>{t("perWeek", { amount: eur(p.revenuePerWeekSoFar, locale) })}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">{t("paceNeeded")}</dt><dd>{t("perWeek", { amount: eur(p.revenuePerWeekNeeded, locale) })}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted">{t("paceNote")}</p>
        </Card>
        <Card>
          <p className="flex items-center gap-1.5 text-sm text-muted"><Percent size={15} /> {t("marginSoFar")}</p>
          <p className="readout mt-1 text-2xl">{pct(tot.margin, locale)}</p>
          <p className="text-sm text-muted">{t("marginMin")}</p>
          <div className="mt-3 border-t border-line pt-3">
            {marginStatus ? <StatusPill status={marginStatus} label={marginStatus === "good" ? t("aboveMin") : t("belowMin")} />
              : <p className="text-sm text-muted">{t("noSales")}</p>}
          </div>
        </Card>
        <Card>
          <p className="flex items-center gap-1.5 text-sm text-muted"><Timer size={15} /> {t("onTime")}</p>
          <p className="readout mt-1 text-2xl">{pct(onTime.rate, locale)}</p>
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

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 className="text-lg font-semibold tracking-tight">{t("trend")}</h2>
        <nav aria-label={t("range.label")} className="flex rounded-xl bg-surface-2 p-1 text-sm">
          {RANGES.map((r) => (
            <Link key={r} href={r === "12" ? "/?tab=money" : `/?range=${r}&tab=money`} scroll={false} aria-current={range === r ? "true" : undefined}
                  className={`rounded-lg px-3 py-1.5 transition ${range === r ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-ink"}`}>
              {r === "all" ? t("range.all") : t("range.weeks", { count: Number(r) })}
            </Link>
          ))}
        </nav>
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

          </div>
        ) },
        { id: "activity", label: t("activity"), node: (
          <div className="max-w-3xl">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">{t("activity")} <span className="size-1.5 rounded-full bg-ok" aria-hidden /></h2>
          <ActivityFeed entries={activity.data ?? []} names={names} groups={groupMap} />
        </Card>
          </div>
        ) },
      ]} />
    </div>
  );
}
