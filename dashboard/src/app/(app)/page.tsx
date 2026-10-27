import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertOctagon, ArrowRight, CalendarClock, CircleAlert, Flag, Gavel, PackageX, Target, TrendingDown, TrendingUp, Users, Clock } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  GOAL, DEADLINE, START, totals, pace, onTimeRate, weekly, groupHealth, weekStart,
  type Sale, type Expense, type Health,
} from "@/lib/metrics";
import { eur, pct, longDate, timeAgo, todayISO } from "@/lib/format";
import { WeeklyChart, CumulativeChart, Legend } from "@/components/overview/charts";
import { ActivityFeed, type ActivityEntry } from "@/components/activity-feed";
import { LiveRefresh } from "@/components/live-refresh";
import { StatusPill } from "@/components/status";
import { GroupBadge } from "@/components/group-icon";
import { cardHref } from "@/lib/projects";

const DAY = 864e5;
type CardRow = { id: string; title: string; board_id: string; due_at: string | null; completed_at: string | null };
type SaleRow = Sale & { channel: string | null; description: string; reverses_id: string | null; item_id: string | null };

/** Overview: the whole company on one page — the goal, the money, every team's health, and what needs us now. */
export default async function OverviewPage() {
  const t = await getTranslations("overviewDash");
  const to = await getTranslations("overview");
  const tg = await getTranslations("group.names");
  const locale = await getLocale();
  const { groups } = await getSession();
  const supabase = await createClient();
  const today = todayISO();
  const now = Date.now();
  const thisWeek = weekStart(now);
  const lastWeek = new Date(Date.parse(thisWeek + "T00:00:00Z") - 7 * DAY).toISOString().slice(0, 10);
  const since30 = new Date(now - 30 * DAY).toISOString().slice(0, 10);

  const [sales, expenses, cards, boards, blockers, activity, people, complaints, morale, decisions, stock, acts] = await Promise.all([
    supabase.from("sales").select("date, amount, cost, channel, description, reverses_id, item_id").returns<SaleRow[]>(),
    supabase.from("expenses").select("date, amount").returns<Expense[]>(),
    supabase.from("cards").select("id, title, board_id, due_at, completed_at").returns<CardRow[]>(),
    supabase.from("boards").select("id, slug, group_id, project_id").is("owner_id", null).returns<{ id: string; slug: string; group_id: string | null; project_id: string | null }[]>(),
    supabase.from("blockers").select("id, group_id, description, owner_id, created_at").eq("status", "open").order("created_at", { ascending: false })
      .returns<{ id: string; group_id: string; description: string; owner_id: string | null; created_at: string }[]>(),
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(10).returns<ActivityEntry[]>(),
    supabase.from("profiles").select("id, full_name, group_id, active, user_id").returns<{ id: string; full_name: string; group_id: string | null; active: boolean; user_id: string | null }[]>(),
    supabase.from("complaints").select("id, customer, issue, opened_at").neq("status", "resolved").order("opened_at")
      .returns<{ id: string; customer: string; issue: string; opened_at: string }[]>(),
    supabase.rpc("morale_weekly"),
    supabase.from("decisions").select("id, date, decision, group_id").order("date", { ascending: false }).limit(5)
      .returns<{ id: string; date: string; decision: string; group_id: string | null }[]>(),
    supabase.from("inventory").select("id, product, stock, low_stock").returns<{ id: string; product: string; stock: number; low_stock: number | null }[]>(),
    supabase.rpc("team_activity", { since: new Date(now - 7 * DAY).toISOString() }),
  ]);

  // ── Money and the goal ────────────────────────────────────
  const allSales = sales.data ?? [];
  const tot = totals(allSales, expenses.data ?? []);
  const p = pace(tot.revenue, tot.profit);
  const sumBetween = (from: string, to?: string) => allSales.filter((s) => s.date >= from && (!to || s.date < to)).reduce((a, s) => a + Number(s.amount), 0);
  const weekRevenue = sumBetween(thisWeek), lastWeekRevenue = sumBetween(lastWeek, thisWeek);
  const series = weekly(allSales, expenses.data ?? [], 12);
  // Day-by-day climb (weekly points are too few this early in the year)
  const firstDay = [START, ...allSales.map((x) => x.date)].sort()[0];
  const nDays = Math.max(2, Math.floor((Date.parse(today) - Date.parse(firstDay)) / DAY) + 1);
  const totalDays = (Date.parse(DEADLINE) - Date.parse(START)) / DAY;
  const daily = Array.from({ length: nDays }, (_, i) => new Date(Date.parse(firstDay) + i * DAY).toISOString().slice(0, 10)).map((d) => {
    const upTo = totals(allSales.filter((x) => x.date <= d), (expenses.data ?? []).filter((x) => x.date <= d));
    return { week: d, revenue: 0, profit: 0, cumRevenue: upTo.revenue, cumProfit: upTo.profit, evenPace: Math.max(0, GOAL.revenue * ((Date.parse(d) - Date.parse(START)) / DAY) / totalDays) };
  });
  const recent4 = sumBetween(new Date(now - 28 * DAY).toISOString().slice(0, 10)) / 4;
  const forecast = tot.revenue + recent4 * (p.daysLeft / 7);
  const revPct = Math.min(1, tot.revenue / GOAL.revenue);
  const timePct = Math.min(1, Math.max(0, (now - Date.parse(START)) / (Date.parse(DEADLINE) - Date.parse(START))));
  const onTrack = revPct >= timePct;

  // Sales mix (last 30 days): by channel and best sellers
  const real30 = allSales.filter((s) => s.date >= since30 && Number(s.amount) > 0 && !s.reverses_id);
  const byChannel = [...real30.reduce((m, s) => m.set(s.channel ?? "other", (m.get(s.channel ?? "other") ?? 0) + Number(s.amount)), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const products = Object.fromEntries((stock.data ?? []).map((x) => [x.id, x.product]));
  const bySeller = [...real30.reduce((m, s) => { const k = (s.item_id && products[s.item_id]) || s.description; return m.set(k, (m.get(k) ?? 0) + Number(s.amount)); }, new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const channelMax = Math.max(1, ...byChannel.map((x) => x[1]));
  const lowStock = (stock.data ?? []).filter((x) => x.stock <= (x.low_stock ?? 0) || x.stock === 0);

  // ── Work ──────────────────────────────────────────────────
  const boardOf = new Map((boards.data ?? []).map((b) => [b.id, b]));
  // Team numbers leave out people's own private boards
  const allCards = (cards.data ?? []).filter((c) => boardOf.has(c.board_id));
  const groupOfCard = (c: CardRow) => boardOf.get(c.board_id)?.group_id ?? null;
  const href = (c: CardRow) => cardHref({ id: c.id, boards: boardOf.get(c.board_id) }, (gid) => groups.find((x) => x.id === gid)?.slug);
  const teamLabel = (gid: string | null) => { const g = groups.find((x) => x.id === gid); return g ? tg(g.slug) : t("company"); };
  const overdue = allCards.filter((c) => !c.completed_at && c.due_at && Date.parse(c.due_at) < now).sort((a, b) => a.due_at!.localeCompare(b.due_at!));
  const upcoming = allCards.filter((c) => !c.completed_at && c.due_at && Date.parse(c.due_at) >= now && Date.parse(c.due_at) < now + 7 * DAY).sort((a, b) => a.due_at!.localeCompare(b.due_at!));
  const doneThisWeek = allCards.filter((c) => c.completed_at && c.completed_at >= thisWeek).length;
  const doneLastWeek = allCards.filter((c) => c.completed_at && c.completed_at >= lastWeek && c.completed_at < thisWeek).length;
  const onTime = onTimeRate(allCards);
  const openBlockers = blockers.data ?? [];

  // ── People ────────────────────────────────────────────────
  const active = (people.data ?? []).filter((x) => x.active);
  const names = Object.fromEntries((people.data ?? []).map((x) => [x.id, x.full_name]));
  const actRows = (acts.data ?? []) as { user_id: string; group_id: string | null }[];
  const activeIds = new Set(actRows.map((a) => a.user_id));
  const lastMorale = (morale.data as { week_start: string; avg_score: number }[] | null)?.at(-1);
  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]));

  const teams = groups.map((g) => {
    const gc = allCards.filter((c) => groupOfCard(c) === g.id);
    const rate = onTimeRate(gc);
    const members = active.filter((m) => m.group_id === g.id);
    const blockersN = openBlockers.filter((b) => b.group_id === g.id).length;
    return {
      g, open: gc.filter((c) => !c.completed_at).length, overdue: rate.overdueOpen, rate: rate.rate, blockers: blockersN,
      done: gc.filter((c) => c.completed_at && c.completed_at >= thisWeek).length,
      members: members.length, activeMembers: members.filter((m) => activeIds.has(m.id)).length,
      health: groupHealth(rate.overdueOpen, blockersN, rate.rate) as Health,
    };
  });

  const attention = [
    ...openBlockers.slice(0, 4).map((b) => ({ key: "b" + b.id, icon: <AlertOctagon size={15} className="text-bad-text" />, text: b.description, meta: `${teamLabel(b.group_id)}${b.owner_id ? ` · ${names[b.owner_id] ?? ""}` : ""} · ${timeAgo(b.created_at, locale)}`, href: groupMap[b.group_id] && groupMap[b.group_id].slug !== "team-leader" ? `/g/${groupMap[b.group_id].slug}?tab=blockers` : "/g/team-leader" })),
    ...overdue.slice(0, 5).map((c) => ({ key: "c" + c.id, icon: <Clock size={15} className="text-warn-text" />, text: c.title, meta: `${teamLabel(groupOfCard(c))} · ${t("daysLate", { count: Math.max(1, Math.floor((now - Date.parse(c.due_at!)) / DAY)) })}`, href: href(c) })),
    ...(complaints.data ?? []).slice(0, 3).map((c) => ({ key: "q" + c.id, icon: <CircleAlert size={15} className="text-bad-text" />, text: `${c.customer}: ${c.issue}`, meta: `${t("complaint")} · ${timeAgo(c.opened_at, locale)}`, href: "/g/customer?tab=complaints" })),
    ...lowStock.slice(0, 3).map((x) => ({ key: "s" + x.id, icon: <PackageX size={15} className="text-warn-text" />, text: x.product, meta: t("stockLeft", { count: x.stock }), href: "/g/finance?tab=stock" })),
  ];

  const delta = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);
  const weekDelta = delta(weekRevenue, lastWeekRevenue);

  return (
    <div className="fade-in space-y-4">
      <LiveRefresh tables={["sales", "expenses", "cards", "blockers", "activity_log", "complaints", "decisions", "inventory", "morale_checks"]} />

      <header className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <p className="text-sm text-muted">{t("eyebrow", { date: longDate(today, locale) })}</p>
          <h1 className="text-[clamp(1.7rem,3.5vw,2.4rem)] font-medium tracking-tight">{t("title")}</h1>
        </div>
        <span className={`glass-pill px-4 py-2 text-sm font-medium ${onTrack ? "text-ok-text" : "text-warn-text"}`}>
          {onTrack ? <TrendingUp size={15} /> : <TrendingDown size={15} />} {onTrack ? t("onTrack") : t("behind")}
        </span>
      </header>

      {/* Goal tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={t("revenue")} value={eur(tot.revenue, locale)} sub={t("ofGoal", { goal: eur(GOAL.revenue, locale) })} bar={revPct} marker={timePct} />
        <Tile label={t("profit")} value={eur(tot.profit, locale)} sub={tot.margin === null ? t("noSales") : t("margin", { margin: pct(tot.margin, locale) })} bar={Math.max(0, Math.min(1, tot.profit / GOAL.profit))} marker={timePct} />
        <Tile label={t("thisWeek")} value={eur(weekRevenue, locale)} sub={t("needPerWeek", { amount: eur(p.revenuePerWeekNeeded, locale) })} bar={p.revenuePerWeekNeeded ? Math.min(1, weekRevenue / p.revenuePerWeekNeeded) : 1}
              badge={weekDelta === null ? null : { text: t("vsLastWeek", { n: `${weekDelta > 0 ? "+" : ""}${weekDelta}%` }), good: weekDelta >= 0 }} />
        <Tile label={t("timeLeft")} value={t("days", { count: p.daysLeft })} sub={t("until", { date: longDate(DEADLINE, locale) })} bar={timePct} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Climb to the goal */}
        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">{t("climb")}</h2>
            <Legend items={[{ label: to("revenue"), color: "var(--series-1)" }, { label: to("profit"), color: "var(--series-2)" }, { label: to("evenPace"), color: "var(--muted)", dashed: true }]} />
          </div>
          <div className="mt-3"><CumulativeChart data={daily.length > 70 ? series : daily} /></div>
        </section>

        {/* Forecast */}
        <section className="panel flex flex-col p-5">
          <h2 className="flex items-center gap-2 font-medium"><Target size={16} className="text-brand" /> {t("forecast")}</h2>
          <p className="mt-1 text-sm text-muted">{t("forecastSub")}</p>
          <p className="readout mt-4 text-4xl">{eur(forecast, locale)}</p>
          <p className="text-sm text-muted">{t("forecastPct", { pct: Math.round((forecast / GOAL.revenue) * 100) })}</p>
          <dl className="mt-auto space-y-2 border-t border-line pt-4 text-sm tabular-nums">
            <Row k={t("avgLast4")} v={t("perWeek", { amount: eur(recent4, locale) })} />
            <Row k={t("needed")} v={t("perWeek", { amount: eur(p.revenuePerWeekNeeded, locale) })} tone={recent4 >= p.revenuePerWeekNeeded ? "ok" : "warn"} />
            <Row k={t("goalReached")} v={`${Math.round(revPct * 100)}%`} />
            <Row k={t("timeUsed")} v={`${Math.round(timePct * 100)}%`} />
          </dl>
        </section>
      </div>

      {/* Teams */}
      <section className="panel p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-medium"><Users size={16} className="text-brand" /> {t("teams")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="pb-2.5 font-medium">{t("team")}</th><th className="pb-2.5 font-medium">{t("health")}</th>
                <th className="pb-2.5 text-right font-medium">{t("open")}</th><th className="pb-2.5 text-right font-medium">{t("overdue")}</th>
                <th className="pb-2.5 text-right font-medium">{t("doneWeek")}</th><th className="pb-2.5 text-right font-medium">{t("onTime")}</th>
                <th className="pb-2.5 text-right font-medium">{t("blockers")}</th><th className="pb-2.5 text-right font-medium">{t("activePeople")}</th><th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {teams.map((x) => (
                <tr key={x.g.id} className="group border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                  <td className="py-3"><Link href={`/g/${x.g.slug}`} className="flex items-center gap-2.5 font-medium group-hover:text-link"><GroupBadge slug={x.g.slug} color={x.g.color} size={28} /> {tg(x.g.slug)}</Link></td>
                  <td><StatusPill status={x.health} /></td>
                  <td className="text-right tabular-nums">{x.open}</td>
                  <td className={`text-right tabular-nums ${x.overdue ? "text-warn-text" : "text-muted"}`}>{x.overdue}</td>
                  <td className="text-right tabular-nums">{x.done}</td>
                  <td className="text-right tabular-nums">{x.rate === null ? "—" : pct(x.rate, locale)}</td>
                  <td className={`text-right tabular-nums ${x.blockers ? "text-bad-text" : "text-muted"}`}>{x.blockers}</td>
                  <td className="text-right tabular-nums">{x.activeMembers}/{x.members}</td>
                  <td className="text-right"><Link href={`/g/${x.g.slug}`} aria-label={tg(x.g.slug)} className="text-muted"><ArrowRight size={15} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label={t("peopleActive")} value={`${activeIds.size}/${active.length}`} />
          <Mini label={t("tasksDone")} value={String(doneThisWeek)} sub={t("lastWeekN", { n: doneLastWeek })} />
          <Mini label={t("onTimeAll")} value={onTime.rate === null ? "—" : pct(onTime.rate, locale)} sub={t("target", { pct: Math.round(GOAL.onTimeTarget * 100) })} />
          <Mini label={t("morale")} value={lastMorale ? `${Number(lastMorale.avg_score).toFixed(1)}/5` : "—"} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Needs attention */}
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-medium"><Flag size={16} className="text-brand" /> {t("attention")} <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{openBlockers.length + overdue.length + (complaints.data?.length ?? 0) + lowStock.length}</span></h2>
          <ul className="mt-3 space-y-1">
            {attention.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="flex items-start gap-3 rounded-2xl p-2.5 hover:bg-surface-2">
                  <span className="mt-0.5">{a.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm">{a.text}</span><span className="block truncate text-xs text-muted">{a.meta}</span></span>
                </Link>
              </li>
            ))}
            {!attention.length && <li className="py-8 text-center text-sm text-muted">{t("allClear")}</li>}
          </ul>
        </section>

        {/* Coming up */}
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-medium"><CalendarClock size={16} className="text-brand" /> {t("comingUp")}</h2>
          <ul className="mt-3 space-y-1">
            {upcoming.slice(0, 8).map((c) => (
              <li key={c.id}>
                <Link href={href(c)} className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-surface-2">
                  <span className="w-16 shrink-0 text-xs text-muted">{new Date(c.due_at!).toLocaleDateString(locale, { weekday: "short", day: "numeric" })}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                  <span className="shrink-0 text-xs text-link">{teamLabel(groupOfCard(c))}</span>
                </Link>
              </li>
            ))}
            {!upcoming.length && <li className="py-8 text-center text-sm text-muted">{t("nothingDue")}</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Weekly money */}
        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">{t("weekly")}</h2>
            <Legend items={[{ label: to("revenue"), color: "var(--series-1)", square: true }, { label: to("profit"), color: "var(--series-2)", square: true }]} />
          </div>
          <div className="mt-3">
            {tot.revenue === 0 && tot.expenses === 0
              ? <div className="grid h-56 place-items-center rounded-xl border border-dashed border-line px-6 text-center text-sm text-muted">{to("chartEmpty")}</div>
              : <WeeklyChart data={series} />}
          </div>
        </section>

        {/* Sales mix */}
        <section className="panel p-5">
          <h2 className="font-medium">{t("salesMix")}</h2>
          <p className="text-xs text-muted">{t("last30")}</p>
          <p className="mt-4 text-xs font-medium text-muted">{t("byChannel")}</p>
          <ul className="mt-2 space-y-2">
            {byChannel.map(([k, v]) => (
              <li key={k} className="text-sm">
                <div className="flex justify-between gap-2"><span className="capitalize">{k}</span><span className="tabular-nums text-muted">{eur(v, locale)}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${(v / channelMax) * 100}%` }} /></div>
              </li>
            ))}
            {!byChannel.length && <li className="text-sm text-muted">{t("noSales30")}</li>}
          </ul>
          <p className="mt-5 text-xs font-medium text-muted">{t("bestSellers")}</p>
          <ol className="mt-2 space-y-1.5 text-sm">
            {bySeller.map(([k, v], i) => <li key={k} className="flex gap-2"><span className="w-4 text-muted tabular-nums">{i + 1}</span><span className="flex-1 truncate">{k}</span><span className="tabular-nums text-muted">{eur(v, locale)}</span></li>)}
          </ol>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-medium"><Gavel size={16} className="text-brand" /> {t("decisions")}</h2>
          <ul className="mt-3 divide-y divide-line">
            {(decisions.data ?? []).map((d) => (
              <li key={d.id} className="py-2.5 text-sm"><p>{d.decision}</p><p className="text-xs text-muted">{longDate(d.date, locale)} · {teamLabel(d.group_id)}</p></li>
            ))}
            {!decisions.data?.length && <li className="py-8 text-center text-sm text-muted">{t("noDecisions")}</li>}
          </ul>
        </section>
        <section className="panel p-5">
          <h2 className="mb-3 flex items-center gap-2 font-medium">{to("activity")} <span className="size-1.5 rounded-full bg-ok" aria-hidden /></h2>
          <ActivityFeed entries={activity.data ?? []} names={names} groups={groupMap} />
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, bar, marker, badge }: { label: string; value: string; sub: string; bar: number; marker?: number; badge?: { text: string; good: boolean } | null }) {
  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {badge && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.good ? "bg-ok/15 text-ok-text" : "bg-bad/15 text-bad-text"}`}>{badge.text}</span>}
      </div>
      <p className="readout mt-2 text-3xl">{value}</p>
      <div className="relative mt-3 h-2 overflow-visible rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#ff6a1a,#ffb07a)]" style={{ width: `${Math.max(1, bar * 100)}%` }} />
        {marker !== undefined && <span title="time" className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink/70" style={{ left: `${marker * 100}%` }} />}
      </div>
      <p className="mt-2 text-xs text-muted">{sub}</p>
    </section>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "ok" | "warn" }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className={tone === "ok" ? "text-ok-text" : tone === "warn" ? "text-warn-text" : ""}>{v}</dd></div>;
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="readout text-xl">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}
