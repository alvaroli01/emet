import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, ArrowUpRight, Plus, Mic, Lightbulb, FileText, Receipt, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { weekStart, GOAL, pace, totals, type Sale, type Expense } from "@/lib/metrics";
import { todayISO, eur, shortDate } from "@/lib/format";
import { LiveRefresh } from "@/components/live-refresh";
import { Altimeter } from "@/components/summit/altimeter";
import { AskButton } from "@/components/workspace/ask-button";
import { ReportCard } from "@/components/workspace/report-card";
import type { WeeklyReport } from "@/lib/weekly-report";

type Due = { id: string; title: string; day: string; href: string; parent?: string };

/** Today: everything one person needs to start the day, on one screen. */
export default async function TodayPage() {
  const t = await getTranslations("today");
  const locale = await getLocale();
  const { me, myGroup, groups, isAdmin } = await getSession();
  const supabase = await createClient();
  const today = todayISO();
  const week = weekStart(Date.now());

  const [plan, cards, subtasks, agenda, sales, expenses, report] = await Promise.all([
    supabase.from("week_plans").select("priorities").eq("owner_id", me.id).eq("week_start", week).maybeSingle(),
    supabase.from("cards").select("id, title, due_at, boards(group_id), card_assignees!inner(user_id)")
      .eq("card_assignees.user_id", me.id).is("completed_at", null).not("due_at", "is", null).lte("due_at", `${today}T23:59:59Z`),
    supabase.from("card_checklist_items").select("id, text, due_on, cards(id, title, boards(group_id))")
      .eq("assignee_id", me.id).eq("done", false).not("due_on", "is", null).lte("due_on", today),
    supabase.from("agenda_items").select("id, title, start_time, done").eq("owner_id", me.id).eq("day", today).order("start_time"),
    supabase.from("sales").select("date, amount, cost").returns<Sale[]>(),
    supabase.from("expenses").select("date, amount").returns<Expense[]>(),
    supabase.from("weekly_reports").select("week_start, data").order("week_start", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const slug = (gid: string | null | undefined) => (gid ? groups.find((g) => g.id === gid)?.slug : undefined);
  const href = (gid: string | null | undefined, id: string) => (slug(gid) ? `/g/${slug(gid)}?card=${id}` : `/board?card=${id}`);
  const due: Due[] = [
    ...((cards.data ?? []) as unknown as { id: string; title: string; due_at: string; boards: { group_id: string | null } | null }[])
      .map((c) => ({ id: c.id, title: c.title, day: c.due_at.slice(0, 10), href: href(c.boards?.group_id, c.id) })),
    ...((subtasks.data ?? []) as unknown as { id: string; text: string; due_on: string; cards: { id: string; title: string; boards: { group_id: string | null } | null } | null }[])
      .filter((s) => s.cards).map((s) => ({ id: s.id, title: s.text, day: s.due_on, href: href(s.cards!.boards?.group_id, s.cards!.id), parent: s.cards!.title })),
  ].sort((a, b) => a.day.localeCompare(b.day));
  const overdue = due.filter((d) => d.day < today);
  const dueToday = due.filter((d) => d.day === today);
  const priorities = (plan.data?.priorities ?? []).filter((p: string) => p.trim());
  const all = totals(sales.data ?? [], expenses.data ?? []);
  const p = pace(all.revenue, all.profit);
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Madrid" }));
  const greet = hour < 12 ? "morning" : hour < 19 ? "afternoon" : "evening";
  const canLogSales = isAdmin || myGroup?.slug === "finance";
  const reportIsFresh = report.data && report.data.week_start === week;

  const actions = [
    { href: "/board", icon: Plus, label: t("actions.task") },
    { href: "/meetings", icon: Mic, label: t("actions.record") },
    { href: "/lab", icon: Lightbulb, label: t("actions.idea") },
    { href: "/camp?tab=docs", icon: FileText, label: t("actions.doc") },
    ...(canLogSales ? [{ href: "/g/finance?tab=money", icon: Receipt, label: t("actions.sale") }] : []),
  ];

  return (
    <div className="space-y-5">
      <LiveRefresh tables={["cards", "card_assignees", "card_checklist_items", "agenda_items", "week_plans", "sales", "weekly_reports"]} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted first-letter:uppercase">{new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" })}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t(`greeting.${greet}`, { name: me.full_name.split(" ")[0] })}</h1>
        </div>
        <AskButton />
      </header>

      <nav aria-label={t("quick")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="panel panel-lift flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium">
            <a.icon size={16} className="text-trail" /> {a.label}
          </Link>
        ))}
      </nav>

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

      {reportIsFresh && <ReportCard report={report.data!.data as WeeklyReport} />}

      <Link href="/" className="panel panel-lift block p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t("goal")}</h2>
          <span className="text-sm text-muted tabular-nums">{t("daysLeft", { count: p.daysLeft })}</span>
        </div>
        <p className="readout text-2xl">{eur(all.revenue, locale)} <span className="text-base font-normal text-muted">/ {eur(GOAL.revenue, locale)}</span></p>
        <Altimeter value={all.revenue / GOAL.revenue} steps={6} color="var(--climbed)" className="mt-2" label={t("goal")} />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Sparkles size={12} /> {t("needed", { amount: eur(p.revenuePerWeekNeeded, locale) })}</p>
      </Link>
    </div>
  );
}
