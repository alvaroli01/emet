import Link from "next/link";
import { CalendarClock, Percent, Timer, AlertOctagon, ArrowRight } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  GOAL, DEADLINE, totals, pace, onTimeRate, weekly, groupHealth, weekStart,
  type Sale, type Expense, type CardLite, type Health,
} from "@/lib/metrics";
import { Card } from "@/components/ui";
import { GoalRing } from "@/components/overview/goal-ring";
import { WeeklyChart, CumulativeChart, Legend } from "@/components/overview/charts";
import { ActivityFeed, timeAgo, type ActivityEntry } from "@/components/activity-feed";
import { LiveRefresh } from "@/components/live-refresh";
import { StatusPill, statusFor } from "@/components/status";

const RANGES = [
  { key: "4", label: "4 weeks" },
  { key: "12", label: "12 weeks" },
  { key: "all", label: "All time" },
] as const;

const eur = (v: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeParam)?.key ?? "12";
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

  const t = totals(sales.data ?? [], expenses.data ?? []);
  const p = pace(t.revenue, t.profit);
  const allCards = cards.data ?? [];
  const onTime = onTimeRate(allCards);
  const series = weekly(sales.data ?? [], expenses.data ?? [], range === "all" ? "all" : Number(range));
  const names = Object.fromEntries((people.data ?? []).map((x) => [x.id, x.full_name]));
  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]));
  const openBlockers = blockers.data ?? [];
  const lastMorale = (morale.data as { week_start: string; avg_score: number; responses: number }[] | null)?.at(-1);

  const boardGroup = new Map((boards.data ?? []).map((b) => [b.id, b.group_id]));
  const groupCards = (gid: string) => allCards.filter((c) => boardGroup.get(c.board_id) === gid);

  const keyKpi: Record<string, string> = {
    "team-leader": `${openBlockers.length} open blocker${openBlockers.length === 1 ? "" : "s"} team-wide`,
    finance: `Margin ${pct(t.margin)} (min 50%)`,
    customer: `${complaints.count ?? 0} open complaint${complaints.count === 1 ? "" : "s"}`,
    marketing: `${posts.count ?? 0} post${posts.count === 1 ? "" : "s"} planned this week`,
    communications: lastMorale ? `Morale ${Number(lastMorale.avg_score).toFixed(1)}/5` : "No morale check yet",
  };

  const marginStatus = statusFor(t.margin, GOAL.minMargin);
  const onTimeStatus = statusFor(onTime.rate, GOAL.onTimeTarget);
  const deadline = new Date(DEADLINE + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["sales", "expenses", "cards", "blockers", "activity_log", "complaints", "content_posts", "morale_checks"]} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hi {me.full_name} 👋</h1>
          <p className="text-sm text-muted">Where emet stands right now — updates live.</p>
        </div>
        <nav aria-label="Date range" className="flex rounded-xl bg-surface-2 p-1 text-sm">
          {RANGES.map((r) => (
            <Link key={r.key} href={r.key === "12" ? "/" : `/?range=${r.key}`} scroll={false}
                  aria-current={range === r.key ? "true" : undefined}
                  className={`rounded-lg px-3 py-1.5 transition ${range === r.key ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-ink"}`}>
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Goal */}
      <Card className="grid gap-6 sm:grid-cols-2">
        <GoalRing label="Revenue" value={t.revenue} goal={GOAL.revenue} color="var(--series-1)" />
        <GoalRing label="Profit" value={Math.max(0, t.profit)} goal={GOAL.profit} color="var(--series-2)" />
      </Card>

      {/* Countdown, margin, on-time */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="flex items-center gap-1.5 text-sm text-muted"><CalendarClock size={15} /> Until {deadline}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{p.daysLeft} days</p>
          <p className="text-sm text-muted">{p.weeksLeft} weeks left</p>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm tabular-nums">
            <div className="flex justify-between gap-2"><dt className="text-muted">Avg pace so far</dt><dd>{eur(p.revenuePerWeekSoFar)}/wk</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Pace needed now</dt><dd>{eur(p.revenuePerWeekNeeded)}/wk</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted">Revenue, for information — no fixed weekly target.</p>
        </Card>
        <Card>
          <p className="flex items-center gap-1.5 text-sm text-muted"><Percent size={15} /> Margin so far</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{pct(t.margin)}</p>
          <p className="text-sm text-muted">Minimum 50%</p>
          <div className="mt-3 border-t border-line pt-3">
            {marginStatus ? <StatusPill status={marginStatus} label={marginStatus === "good" ? "Above minimum" : "Below minimum"} />
              : <p className="text-sm text-muted">No sales logged yet</p>}
          </div>
        </Card>
        <Card>
          <p className="flex items-center gap-1.5 text-sm text-muted"><Timer size={15} /> On-time tasks</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{pct(onTime.rate)}</p>
          <p className="text-sm text-muted">Target 85%</p>
          <div className="mt-3 border-t border-line pt-3">
            {onTimeStatus ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusPill status={onTimeStatus} />
                <span className="text-xs text-muted tabular-nums">{onTime.onTime} on time · {onTime.late} late</span>
              </div>
            ) : <p className="text-sm text-muted">No tasks with due dates finished yet</p>}
          </div>
        </Card>
      </div>

      {/* Charts — two charts, one axis each (no dual axis) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Revenue & profit per week</h2>
            <Legend items={[{ label: "Revenue", color: "var(--series-1)", square: true }, { label: "Profit", color: "var(--series-2)", square: true }]} />
          </div>
          {t.revenue === 0 && t.expenses === 0
            ? <EmptyChart text="No sales logged yet — Finance adds the first one in its tab." />
            : <WeeklyChart data={series} />}
        </Card>
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Running total since 13 Oct</h2>
            <Legend items={[
              { label: "Revenue", color: "var(--series-1)" },
              { label: "Profit", color: "var(--series-2)" },
              { label: "Even pace to €30K", color: "var(--muted)", dashed: true },
            ]} />
          </div>
          <CumulativeChart data={series} />
        </Card>
      </div>

      {/* Groups */}
      <section>
        <h2 className="mb-3 font-semibold">Groups</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const gc = onTimeRate(groupCards(g.id));
            const gb = openBlockers.filter((b) => b.group_id === g.id).length;
            const health: Health = groupHealth(gc.overdueOpen, gb, gc.rate);
            return (
              <Link key={g.id} href={`/g/${g.slug}`}
                    className="group rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    style={{ borderLeft: `4px solid ${g.color}` }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold"><span className="mr-1.5">{g.emoji}</span>{g.name}</p>
                  <StatusPill status={health} />
                </div>
                <p className="mt-2 text-sm">{keyKpi[g.slug] ?? ""}</p>
                <p className="mt-1 text-xs text-muted tabular-nums">
                  {gc.overdueOpen} overdue · {gb} blocker{gb === 1 ? "" : "s"} · on-time {pct(gc.rate)}
                </p>
                <p className="mt-3 flex items-center gap-1 text-xs font-medium text-muted group-hover:text-ink">
                  Open tab <ArrowRight size={13} />
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Blockers + activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-1.5 font-semibold"><AlertOctagon size={16} /> Blockers</h2>
          {openBlockers.length ? (
            <ul className="divide-y divide-line">
              {openBlockers.map((b) => {
                const g = groupMap[b.group_id];
                return (
                  <li key={b.id} className="py-2.5 text-sm">
                    <p>{b.description}</p>
                    <p className="text-xs text-muted">
                      {g ? `${g.emoji} ${g.name}` : ""}{b.owner_id ? ` · ${names[b.owner_id] ?? ""}` : ""} · {timeAgo(b.created_at)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : <p className="py-6 text-center text-sm text-muted">No open blockers 🙌</p>}
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            Recent activity <span className="size-1.5 rounded-full bg-ok" aria-hidden />
          </h2>
          <ActivityFeed entries={activity.data ?? []} names={names} groups={groupMap} />
        </Card>
      </div>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="grid h-56 place-items-center rounded-xl border border-dashed border-line px-6 text-center text-sm text-muted">
      {text}
    </div>
  );
}
