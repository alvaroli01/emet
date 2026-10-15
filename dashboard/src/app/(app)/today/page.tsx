import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, ArrowUpRight, Clock, CheckCircle2 } from "lucide-react";
import { HomeDashboard, type HomeData } from "@/components/home/home-dashboard";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { weekStart, GOAL, pace, totals, onTimeRate, weekly, type Sale, type Expense, type CardLite } from "@/lib/metrics";
import { todayISO, shortDate } from "@/lib/format";
import { LiveRefresh } from "@/components/live-refresh";
import { ReportCard } from "@/components/workspace/report-card";
import type { WeeklyReport } from "@/lib/weekly-report";

type Due = { id: string; title: string; day: string; href: string; parent?: string };

/** Today: everything one person needs to start the day, on one screen. */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const t = await getTranslations("today");
  const locale = await getLocale();
  const { me, myGroup, groups, isAdmin } = await getSession();
  const supabase = await createClient();
  const today = todayISO();
  const week = weekStart(Date.now());
  const DAY = 864e5;
  const lastMonday = new Date(Date.parse(week + "T00:00:00Z") - 7 * DAY).toISOString().slice(0, 10);
  const tHome = await getTranslations("home");
  const tg = await getTranslations("group.names");

  const [plan, cards, subtasks, agenda, sales, expenses, report, leads] = await Promise.all([
    supabase.from("week_plans").select("priorities").eq("owner_id", me.id).eq("week_start", week).maybeSingle(),
    supabase.from("cards").select("id, title, due_at, boards(group_id), card_assignees!inner(user_id)")
      .eq("card_assignees.user_id", me.id).is("completed_at", null).not("due_at", "is", null).lte("due_at", `${today}T23:59:59Z`),
    supabase.from("card_checklist_items").select("id, text, due_on, cards(id, title, boards(group_id))")
      .eq("assignee_id", me.id).eq("done", false).not("due_on", "is", null).lte("due_on", today),
    supabase.from("agenda_items").select("id, title, start_time, done").eq("owner_id", me.id).eq("day", today).order("start_time"),
    supabase.from("sales").select("date, amount, cost").returns<Sale[]>(),
    supabase.from("expenses").select("date, amount").returns<Expense[]>(),
    supabase.from("weekly_reports").select("week_start, data").order("week_start", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("scout_leads").select("id, project_id, next_step_at, place:scout_places(name)").eq("owner_id", me.id)
      .not("next_step_at", "is", null).lte("next_step_at", today).not("status", "in", "(won,lost,ignored)"),
  ]);
  const since30 = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
  const [weekSales, doneCards, dueCards, blockers, morale, myDone] = await Promise.all([
    supabase.from("sales").select("date, amount, heard_about, channel").gte("date", lastMonday),
    supabase.from("cards").select("completed_at").not("completed_at", "is", null).gte("completed_at", lastMonday),
    supabase.from("cards").select("board_id, due_at, completed_at").not("due_at", "is", null),
    supabase.from("blockers").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("morale_checks").select("score").eq("week_start", week),
    supabase.from("cards").select("completed_at, card_assignees!inner(user_id)").eq("card_assignees.user_id", me.id).not("completed_at", "is", null).gte("completed_at", since30),
  ]);

  const slug = (gid: string | null | undefined) => (gid ? groups.find((g) => g.id === gid)?.slug : undefined);
  const href = (gid: string | null | undefined, id: string) => (slug(gid) ? `/g/${slug(gid)}?card=${id}` : `/board?card=${id}`);
  const due: Due[] = [
    ...((cards.data ?? []) as unknown as { id: string; title: string; due_at: string; boards: { group_id: string | null } | null }[])
      .map((c) => ({ id: c.id, title: c.title, day: c.due_at.slice(0, 10), href: href(c.boards?.group_id, c.id) })),
    ...((subtasks.data ?? []) as unknown as { id: string; text: string; due_on: string; cards: { id: string; title: string; boards: { group_id: string | null } | null } | null }[])
      .filter((s) => s.cards).map((s) => ({ id: s.id, title: s.text, day: s.due_on, href: href(s.cards!.boards?.group_id, s.cards!.id), parent: s.cards!.title })),
    // Scout leads whose next step is due: who to visit or call today
    ...((leads.data ?? []) as unknown as { id: string; project_id: string; next_step_at: string; place: { name: string } | null }[])
      .map((l) => ({ id: l.id, title: l.place?.name ?? "—", day: l.next_step_at, href: `/scout?p=${l.project_id}`, parent: "Scout" })),
  ].sort((a, b) => a.day.localeCompare(b.day));
  const overdue = due.filter((d) => d.day < today);
  const dueToday = due.filter((d) => d.day === today);
  const priorities = (plan.data?.priorities ?? []).filter((p: string) => p.trim());
  const all = totals(sales.data ?? [], expenses.data ?? []);
  const p = pace(all.revenue, all.profit);
  const canLogSales = isAdmin || myGroup?.slug === "finance";
  const revPct = Math.min(1, Math.max(0, all.revenue / GOAL.revenue));
  const campN = Math.floor(all.revenue / (GOAL.revenue / 6)) + 1;
  const nextCamp = campN <= 6 ? { n: campN, amount: campN * (GOAL.revenue / 6) } : null;
  // ── Home cards ──
  const dayIdx = (d: string) => Math.floor((Date.parse(d.slice(0, 10) + "T00:00:00Z") - Date.parse(week + "T00:00:00Z")) / DAY);
  const ws = (weekSales.data ?? []).filter((x) => x.date >= week && Number(x.amount) > 0);
  const chan = (x: { heard_about: string | null; channel: string | null }) => x.heard_about === "stall" ? "stall" : ["instagram", "tiktok", "whatsapp"].includes(x.heard_about ?? "") || /insta|tiktok|online|web/i.test(x.channel ?? "") ? "online" : "other";
  const rows = (["stall", "online", "other"] as const).map((k) => ({ label: tHome(`channels.${k}`), days: Array.from({ length: 7 }, (_, i) => ws.filter((x) => chan(x) === k && dayIdx(x.date) === i).length) }));
  const doneDays = (from: string) => { const c = Array(7).fill(0); for (const x of doneCards.data ?? []) { const i = Math.floor((Date.parse(x.completed_at!) - Date.parse(from + "T00:00:00Z")) / DAY); if (i >= 0 && i < 7) c[i]++; } return c.map((_, i) => c.slice(0, i + 1).reduce((a: number, b: number) => a + b, 0)); };
  const todayIdx = Math.min(6, dayIdx(today));
  const thisW = doneDays(week).map((v, i) => (i <= todayIdx ? v : v)), lastW = doneDays(lastMonday);
  const moneyDays = Array.from({ length: 7 }, (_, i) => ws.filter((x) => dayIdx(x.date) === i).reduce((a, x) => a + Number(x.amount), 0));
  const ot = onTimeRate((dueCards.data ?? []) as CardLite[]);
  const moods = (morale.data ?? []).map((m) => Number(m.score)).filter((n) => n > 0);
  const wk = weekly(sales.data ?? [], expenses.data ?? [], 10);
  const healthScore = ot.rate === null && !moods.length ? null : Math.round(((ot.rate ?? 0.7) * 0.6 + (moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length) / 5 : 0.7) * 0.3 + (blockers.count ? 0 : 0.1)) * 100);
  const myDoneDays = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.now() - (29 - i) * DAY).toISOString().slice(0, 10); return (myDone.data ?? []).filter((x) => x.completed_at!.slice(0, 10) === d).length; });
  const prioDone = priorities.filter((x: string) => x.startsWith("✓ ")).length;
  const doneWeekMine = (myDone.data ?? []).filter((x) => x.completed_at!.slice(0, 10) >= week).length;
  const focusScore = priorities.length || doneWeekMine ? Math.min(100, Math.round((priorities.length ? (prioDone / priorities.length) * 60 : 30) + Math.min(40, doneWeekMine * 8) - overdue.length * 5)) : null;
  const fmtDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const home: HomeData = {
    name: me.full_name.split(" ")[0],
    weekLabel: `${fmtDay(week)} – ${fmtDay(new Date(Date.parse(week) + 6 * DAY).toISOString().slice(0, 10))}`,
    canLogSale: canLogSales,
    sales: { week: moneyDays.reduce((a, b) => a + b, 0), count: ws.length, rows },
    tasks: { thisWeek: thisW, lastWeek: lastW, done: thisW[todayIdx] ?? 0, delta: (thisW[todayIdx] ?? 0) - (lastW[todayIdx] ?? 0) },
    money: { days: moneyDays, week: moneyDays.reduce((a, b) => a + b, 0) },
    goal: { revenue: all.revenue, goal: GOAL.revenue, pct: revPct, daysLeft: p.daysLeft, nextCampAt: nextCamp ? nextCamp.amount / GOAL.revenue : null,
            teams: groups.map((g) => ({ slug: g.slug, color: g.color, label: tg(g.slug), mine: g.id === me.group_id })) },
    health: { score: healthScore, series: [wk.map((x) => x.revenue), wk.map((x) => Math.max(0, x.profit)), wk.map((_, i) => i + 1)], onTime: ot.rate, blockers: blockers.count ?? 0, mood: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null },
    focus: { score: focusScore, bars: myDoneDays, dueToday: dueToday.length, late: overdue.length, doneWeek: doneWeekMine },
  };
  // Demo numbers for presenting the dashboard (leaders/admins only, ?demo=1). Shown with a DEMO badge, never saved.
  const demo = isAdmin && (await searchParams).demo === "1";
  if (demo) {
    const days = [180, 260, 410, 320, 380, 290, 300];
    Object.assign(home, {
      sales: { week: 2140, count: 26, rows: [{ label: home.sales.rows[0]?.label ?? "Stall", days: [3, 4, 6, 5, 6, 4, 4] }, ...home.sales.rows.slice(1, 3).map((r, i) => ({ ...r, days: i ? [1, 0, 2, 1, 1, 2, 1] : [1, 2, 3, 2, 2, 1, 2] }))] },
      tasks: { thisWeek: [3, 7, 12, 15, 19, 22, 24], lastWeek: [2, 5, 8, 11, 13, 16, 18], done: 24, delta: 6 },
      money: { days, week: 2140 },
      goal: { ...home.goal, revenue: 6850, pct: 6850 / GOAL.revenue, nextCampAt: 10000 / GOAL.revenue },
      health: { score: 78, series: [[620, 940, 1280, 1650, 2140], [300, 470, 650, 840, 1090], [1, 2, 3, 4, 5]], onTime: 0.86, blockers: 1, mood: 4.1 },
      focus: { score: 72, bars: [2, 3, 5, 4, 6, 3, 1], dueToday: 2, late: 0, doneWeek: 9 },
    } satisfies Partial<HomeData>);
  }
  const reportIsFresh = report.data && report.data.week_start === week;


  return (
    <div className="space-y-5">
      <LiveRefresh tables={["cards", "card_assignees", "card_checklist_items", "agenda_items", "week_plans", "sales", "weekly_reports", "scout_leads"]} />
      <HomeDashboard d={home} demo={demo} canDemo={isAdmin} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="panel p-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{t("due")}</h2>
            <Link href="/my-tasks" className="text-xs text-muted hover:text-ink">{t("allTasks")}</Link>
          </div>
          {overdue.length + dueToday.length ? (
            <ul className="divide-y divide-line">
              {[...overdue, ...dueToday].map((d) => (
                <li key={d.id}>
                  <Link href={d.href} className="group flex items-center gap-3 py-2.5">
                    <span className={`flex w-20 shrink-0 items-center gap-1 text-xs tabular-nums ${d.day < today ? "font-medium text-bad-text" : "text-muted"}`}>
                      <Clock size={12} /> {d.day < today ? t("late", { date: shortDate(d.day, locale) }) : t("todayLabel")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{d.title}</span>
                      {d.parent && <span className="block truncate text-xs text-muted">{d.parent}</span>}
                    </span>
                    <ArrowUpRight size={14} className="shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 py-6 text-sm text-muted"><CheckCircle2 size={16} className="text-ok-text" /> {t("nothingDue")}</p>
          )}
        </section>

        <div className="space-y-4">
          <section className="panel p-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{t("priorities")}</h2>
              <Link href="/camp" className="text-xs text-muted hover:text-ink">{priorities.length ? t("edit") : t("set")}</Link>
            </div>
            {priorities.length ? (
              <ol className="space-y-2">
                {priorities.map((pr: string, i: number) => {
                  const done = pr.startsWith("✓ ");
                  return (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className={`readout grid size-7 shrink-0 place-items-center rounded-full text-xs ${done ? "bg-ok text-white" : "bg-surface-2"}`}>{done ? "✓" : i + 1}</span>
                      <span className={done ? "text-muted line-through" : ""}>{done ? pr.slice(2) : pr}</span>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="text-sm text-muted">{t("noPriorities")}</p>}
          </section>

          <section className="panel p-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-lg font-semibold tracking-tight"><CalendarClock size={17} /> {t("agenda")}</h2>
              <Link href="/camp?tab=agenda" className="text-xs text-muted hover:text-ink">{t("open")}</Link>
            </div>
            {agenda.data?.length ? (
              <ul className="space-y-1.5 text-sm">
                {agenda.data.map((a) => (
                  <li key={a.id} className={`flex gap-3 ${a.done ? "text-muted line-through" : ""}`}>
                    <span className="w-11 shrink-0 text-right text-xs text-muted tabular-nums">{a.start_time?.slice(0, 5) ?? "—"}</span>{a.title}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">{t("noAgenda")}</p>}
          </section>
        </div>
      </div>

      {reportIsFresh && <div id="report" className="scroll-mt-20"><ReportCard report={report.data!.data as WeeklyReport} /></div>}

    </div>
  );
}
