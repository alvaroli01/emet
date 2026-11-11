import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, ArrowUpRight, Clock, CheckCircle2 } from "lucide-react";
import { HomeDashboard, type HomeData } from "@/components/home/home-dashboard";
import { getSession, sendGuestToProject } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { weekStart, GOAL, pace, totals, type Sale, type Expense } from "@/lib/metrics";
import { todayISO, shortDate } from "@/lib/format";
import { LiveRefresh } from "@/components/live-refresh";
import { loadMyGoogleEvents } from "@/lib/gcal-server";
import { loadMyNotionDeadlinesFast } from "@/lib/notion/server";
import { ReportCard } from "@/components/workspace/report-card";
import type { WeeklyReport } from "@/lib/weekly-report";
import { cardHref } from "@/lib/projects";
import { loadMembers } from "@/lib/boards";
import { getsTasks } from "@/lib/tasks";
import { pointTotals } from "@/lib/points";
import { OfficeCard, type OfficeData } from "@/components/office/office-card";
import { visitMs, isInNow, isPaused, hm, madridTime, madridMidnight, dayClosesAt, LUNCH_MS, type Visit } from "@/lib/office";

type Due = { id: string; title: string; day: string; href: string; parent?: string };

/** Today: everything one person needs to start the day, on one screen. */
export default async function TodayPage() {
  const t = await getTranslations("today");
  const locale = await getLocale();
  const { me, myGroup, groups, isAdmin } = await getSession();
  await sendGuestToProject(me);
  const supabase = await createClient();
  const today = todayISO();
  const week = weekStart(Date.now());
  const DAY = 864e5;
  const lastMonday = new Date(Date.parse(week + "T00:00:00Z") - 7 * DAY).toISOString().slice(0, 10);
  const tHome = await getTranslations("home");
  const tg = await getTranslations("group.names");

  const [plan, cards, subtasks, agenda, sales, expenses, report, leads] = await Promise.all([
    supabase.from("week_plans").select("priorities").eq("owner_id", me.id).eq("week_start", week).maybeSingle(),
    supabase.from("cards").select("id, title, due_at, boards(group_id, project_id), card_assignees!inner(user_id)")
      .eq("card_assignees.user_id", me.id).is("completed_at", null).not("due_at", "is", null).lte("due_at", `${today}T23:59:59Z`),
    supabase.from("card_checklist_items").select("id, text, due_on, cards(id, title, boards(group_id, project_id))")
      .eq("assignee_id", me.id).eq("done", false).not("due_on", "is", null).lte("due_on", today),
    supabase.from("agenda_items").select("id, title, start_time, done").eq("owner_id", me.id).eq("day", today).order("start_time"),
    supabase.from("sales").select("date, amount, cost").returns<Sale[]>(),
    supabase.from("expenses").select("date, amount").returns<Expense[]>(),
    supabase.from("weekly_reports").select("week_start, data").order("week_start", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("scout_leads").select("id, project_id, next_step_at, place:scout_places(name)").eq("owner_id", me.id)
      .not("next_step_at", "is", null).lte("next_step_at", today).not("status", "in", "(won,lost,ignored)"),
  ]);
  const since30 = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
  const weekEnd = new Date(Date.parse(week + "T00:00:00Z") + 6 * DAY).toISOString().slice(0, 10);
  const googleP = loadMyGoogleEvents(supabase, week, weekEnd); // in parallel with the queries below
  const notionP = loadMyNotionDeadlinesFast(supabase, week, weekEnd); // my Notion deadlines database, if I picked one
  const [weekSales, myPoints, teamActs, seen, members, dueCards, blockers, myDone, weekAgenda, weekTasks, officePlace, visits] = await Promise.all([
    supabase.from("sales").select("date, amount, heard_about, channel").gte("date", lastMonday),
    supabase.from("member_points").select("kind, amount").eq("user_id", me.id),
    supabase.rpc("team_activity", { since: new Date(Date.parse(week + "T00:00:00Z") - DAY).toISOString() }), // a day early; trimmed to this week below
    supabase.from("presence").select("user_id").gte("last_seen_at", new Date(Date.parse(week + "T00:00:00Z") - 3600e3).toISOString()),
    loadMembers(),
    supabase.from("cards").select("board_id, due_at, completed_at").not("due_at", "is", null),
    supabase.from("blockers").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("cards").select("completed_at, card_assignees!inner(user_id)").eq("card_assignees.user_id", me.id).not("completed_at", "is", null).gte("completed_at", since30),
    // My week calendar: my own agenda plus tasks assigned to me that are due this week
    supabase.from("agenda_items").select("id, title, day, start_time, end_time, done").eq("owner_id", me.id).gte("day", week).lte("day", weekEnd).order("start_time"),
    supabase.from("cards").select("id, title, due_at, completed_at, boards(group_id, project_id), card_assignees!inner(user_id)")
      .eq("card_assignees.user_id", me.id).gte("due_at", `${week}T00:00:00Z`).lte("due_at", `${weekEnd}T23:59:59Z`),
    // Office check-ins this week (+ anyone still in from before Monday)
    supabase.from("office_place").select("lat, lng").maybeSingle<{ lat: number; lng: number }>(),
    supabase.from("office_visits").select("id, user_id, arrived_at, left_at, forgot, lunch_until, out_lat, out_lng").or(`arrived_at.gte.${madridMidnight(week)},left_at.is.null`)
      .returns<(Visit & { lunch_until: string | null; out_lat: number | null; out_lng: number | null })[]>(),
  ]);
  const [{ data: seenAll }, { data: absences }] = await Promise.all([
    supabase.from("presence").select("user_id, last_seen_at").returns<{ user_id: string; last_seen_at: string }[]>(),
    supabase.from("office_absences").select("id, user_id, from_day, to_day, reason").gte("to_day", week).lte("from_day", weekEnd)
      .returns<{ id: string; user_id: string; from_day: string; to_day: string; reason: string }[]>(),
  ]);
  // Working outside this week (Mon/Wed/Fri log everyone can see)
  const { data: outside } = await supabase.from("office_outside").select("id, user_id, note, started_at, ended_at, places")
    .gte("started_at", madridMidnight(week)).order("started_at")
    .returns<{ id: string; user_id: string; note: string; started_at: string; ended_at: string | null; places: { lat: number; lng: number }[] }[]>();

  const google = await googleP;
  const notionDl = await notionP;

  const slug = (gid: string | null | undefined) => (gid ? groups.find((g) => g.id === gid)?.slug : undefined);
  const href = (b: { group_id: string | null; project_id?: string | null } | null | undefined, id: string) => cardHref({ id, boards: b });
  const due: Due[] = [
    ...((cards.data ?? []) as unknown as { id: string; title: string; due_at: string; boards: { group_id: string | null } | null }[])
      .map((c) => ({ id: c.id, title: c.title, day: c.due_at.slice(0, 10), href: href(c.boards, c.id) })),
    ...((subtasks.data ?? []) as unknown as { id: string; text: string; due_on: string; cards: { id: string; title: string; boards: { group_id: string | null } | null } | null }[])
      .filter((s) => s.cards).map((s) => ({ id: s.id, title: s.text, day: s.due_on, href: href(s.cards!.boards, s.cards!.id), parent: s.cards!.title })),
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
  // Team activity this week: class members only (no coach, bot or Ollin guests)
  const classmates = members.filter(getsTasks);
  const inClass = new Map(classmates.map((m) => [m.id, m]));
  const acts = ((teamActs.data ?? []) as { user_id: string; day: string; n: number }[]).filter((a) => inClass.has(a.user_id) && a.day >= week);
  const perPerson = new Map<string, number>();
  for (const a of acts) perPerson.set(a.user_id, (perPerson.get(a.user_id) ?? 0) + Number(a.n));
  const activeIds = new Set([...perPerson.keys(), ...(seen.data ?? []).map((x) => x.user_id as string).filter((id) => inClass.has(id))]);
  const activity = {
    // Active = did something or opened emet this week; the rest are "not seen" (someone to check on)
    active: activeIds.size, total: classmates.length,
    quiet: classmates.filter((m) => !activeIds.has(m.id)).map((m) => ({ id: m.id, name: m.full_name, avatar: m.avatar_url })),
    days: Array.from({ length: 7 }, (_, i) => acts.filter((a) => dayIdx(a.day) === i).reduce((s, a) => s + Number(a.n), 0)),
    top: [...perPerson].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ id, n, name: inClass.get(id)!.full_name, avatar: inClass.get(id)!.avatar_url })),
  };
  const moneyDays = Array.from({ length: 7 }, (_, i) => ws.filter((x) => dayIdx(x.date) === i).reduce((a, x) => a + Number(x.amount), 0));
  const lateTeam = (dueCards.data ?? []).filter((c) => !c.completed_at && c.due_at!.slice(0, 10) < today).length;
  const prioDone = priorities.filter((x: string) => x.startsWith("✓ ")).length;
  const doneWeekMine = (myDone.data ?? []).filter((x) => x.completed_at!.slice(0, 10) >= week).length;
  const focusScore = priorities.length || doneWeekMine ? Math.min(100, Math.round((priorities.length ? (prioDone / priorities.length) * 60 : 30) + Math.min(40, doneWeekMine * 8) - overdue.length * 5)) : null;
  const fmtDay = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const home: HomeData = {
    name: me.full_name.split(" ")[0],
    weekLabel: `${fmtDay(week)} – ${fmtDay(new Date(Date.parse(week) + 6 * DAY).toISOString().slice(0, 10))}`,
    canLogSale: canLogSales,
    sales: { week: moneyDays.reduce((a, b) => a + b, 0), count: ws.length, rows },
    meId: me.id,
    points: pointTotals(myPoints.data ?? []),
    activity,
    money: { days: moneyDays, week: moneyDays.reduce((a, b) => a + b, 0) },
    goal: { revenue: all.revenue, goal: GOAL.revenue, pct: revPct, daysLeft: p.daysLeft, nextCampAt: nextCamp ? nextCamp.amount / GOAL.revenue : null,
            teams: groups.map((g) => ({ slug: g.slug, color: g.color, label: tg(g.slug), mine: g.id === me.group_id })) },
    team: { late: lateTeam, blockers: blockers.count ?? 0 },
    focus: { score: focusScore, dueToday: dueToday.length, late: overdue.length, doneWeek: doneWeekMine },
    calendar: {
      today,
      days: Array.from({ length: 7 }, (_, i) => new Date(Date.parse(week + "T00:00:00Z") + i * DAY).toISOString().slice(0, 10)),
      items: [
        ...(weekAgenda.data ?? []).map((a) => ({ id: a.id, title: a.title, day: a.day, start: a.start_time?.slice(0, 5) ?? null, end: a.end_time?.slice(0, 5) ?? null,
          status: a.done ? "done" as const : a.day < today ? "late" as const : "open" as const, href: "/camp?tab=agenda#camp-tabs" })),
        ...((weekTasks.data ?? []) as unknown as { id: string; title: string; due_at: string; completed_at: string | null; boards: { group_id: string | null } | null }[])
          .map((c) => ({ id: c.id, title: c.title, day: c.due_at.slice(0, 10), start: null, end: null, team: slug(c.boards?.group_id) ? tg(slug(c.boards?.group_id)!) : undefined,
            status: c.completed_at ? "done" as const : c.due_at.slice(0, 10) < today ? "late" as const : "open" as const, href: href(c.boards, c.id) })),
        ...google.events.map((g) => ({ id: `g:${g.id}`, title: g.title, day: g.day, start: g.start, end: g.end, kind: "google" as const,
          status: g.day < today ? "done" as const : "open" as const, href: `https://calendar.google.com/calendar/r/day/${g.day.replaceAll("-", "/")}` })),
        ...notionDl.items.map((n) => ({ id: `n:${n.id}`, title: n.title, day: n.day, start: n.start, end: n.end, kind: "notion" as const,
          status: n.done ? "done" as const : n.day < today ? "late" as const : "open" as const, href: n.url || "/camp?tab=notion#camp-tabs" })),
      ],
      google: google.status,
    },
  };
  const reportIsFresh = report.data && report.data.week_start === week;
  // ── At the office ──
  const now = Date.now();
  const vs = visits.data ?? [];
  const who = new Map(members.map((m) => [m.id, m]));
  const msOf = (uid: string, from: string) => vs.filter((v) => v.user_id === uid && Date.parse(v.arrived_at) >= Date.parse(from)).reduce((a, v) => a + visitMs(v, now), 0);
  const dayFrom = madridMidnight(today), weekFrom = madridMidnight(week);
  const latest = new Map<string, Visit>();
  for (const v of vs) if (!latest.has(v.user_id) || v.arrived_at > latest.get(v.user_id)!.arrived_at) latest.set(v.user_id, v);
  const pausedNow = (uid: string) => !!latest.get(uid) && isPaused(latest.get(uid)!, now);
  const office: OfficeData = {
    // Everyone at a glance (Alvaro, 2026-11-11): where they are now (Dock / eating / working outside / left / not in),
    // their time at Dock today, and when they last opened emet
    team: (() => {
      const seen = new Map((seenAll ?? []).map((x) => [x.user_id, x.last_seen_at]));
      const outsideOpen = new Map((outside ?? []).filter((o) => !o.ended_at).map((o) => [o.user_id, o]));
      const when = (iso: string) => (iso >= dayFrom ? madridTime(iso) : `${fmtDay(new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }))} ${madridTime(iso)}`);
      const rank = { in: 0, lunch: 1, outside: 2, left: 3, away: 4, none: 5 } as const; // lunchOver ranks with lunch
      const awayToday = new Map((absences ?? []).filter((x) => x.from_day <= today && x.to_day >= today).map((x) => [x.user_id, x]));
      return classmates.map((m) => {
        const l = latest.get(m.id) as (Visit & { lunch_until: string | null }) | undefined;
        const o = outsideOpen.get(m.id);
        const status: keyof typeof rank = l && isInNow(l, now) ? "in"
          : l?.lunch_until && l.left_at && l.left_at >= dayFrom && now < dayClosesAt(now) ? "lunch" // still eating (maybe longer than 1 h)
          : o ? "outside"
          : l?.left_at && l.left_at >= dayFrom ? "left" : awayToday.has(m.id) ? "away" : "none";
        const since = status === "in" ? madridTime(l!.arrived_at) : status === "lunch" ? (now > Date.parse(l!.lunch_until!) ? hm(now - Date.parse(l!.left_at!)) : madridTime(l!.left_at!)) : status === "outside" ? madridTime(o!.started_at)
          : status === "left" ? madridTime(l!.left_at!) : status === "away" ? fmtDay(awayToday.get(m.id)!.to_day) : null;
        const s = seen.get(m.id);
        const over = status === "lunch" && now > Date.parse(l!.lunch_until!);
        return { id: m.id, name: m.full_name, avatar: m.avatar_url, status: over ? ("lunchOver" as const) : status, since, note: o?.note ?? awayToday.get(m.id)?.reason ?? null, today: hm(msOf(m.id, dayFrom)), seen: s ? when(s) : null, rank: rank[status] };
      }).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).map(({ rank: _r, ...x }) => x); // eslint-disable-line @typescript-eslint/no-unused-vars
    })(),
    me: { in: vs.some((v) => v.user_id === me.id && isInNow(v, now)), paused: pausedNow(me.id), today: hm(msOf(me.id, dayFrom)), week: hm(msOf(me.id, weekFrom)) },
    week: [...new Set(vs.map((v) => v.user_id))].filter((id) => who.has(id)).map((id) => ({ id, name: who.get(id)!.full_name, avatar: who.get(id)!.avatar_url, ms: msOf(id, weekFrom) }))
      .filter((p) => p.ms > 0).sort((a, b) => b.ms - a.ms).map((p) => ({ ...p, hours: hm(p.ms) })),
    isAdmin, officeSet: !!officePlace.data,
    // Team calendar this week (everyone sees it): each day, who was at Dock (from–to, hours; 0 h if never checked out at
    // Dock) and who worked outside (note + the exact places: where they said they were out, and the last one)
    calendar: (() => {
      const map = (p?: { lat: number; lng: number }) => (p ? `https://www.google.com/maps?q=${p.lat},${p.lng}` : null);
      const day = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
      const rows = [
        ...vs.filter((v) => who.has(v.user_id) && v.arrived_at >= madridMidnight(week)).map((v) => ({
          id: v.id, at: v.arrived_at, day: day(v.arrived_at), kind: "office" as const, name: who.get(v.user_id)!.full_name,
          from: madridTime(v.arrived_at), to: v.left_at && !v.forgot ? madridTime(v.left_at) : null, hours: hm(visitMs(v, now)), zero: v.forgot, note: null, start: null,
          end: v.out_lat !== null && v.out_lng !== null ? map({ lat: v.out_lat, lng: v.out_lng }) : null })), // checked out away from Dock
        ...(outside ?? []).filter((o) => who.has(o.user_id)).map((o) => ({
          id: o.id, at: o.started_at, day: day(o.started_at), kind: "outside" as const, name: who.get(o.user_id)!.full_name,
          from: madridTime(o.started_at), to: o.ended_at ? madridTime(o.ended_at) : null,
          hours: hm((o.ended_at ? Date.parse(o.ended_at) : now) - Date.parse(o.started_at)), zero: false, note: o.note,
          start: map(o.places[0]), end: o.places.length > 1 ? map(o.places[o.places.length - 1]) : null })),
        // Eating: from leaving Dock to coming back (or now / 21:00); over 1 h shows how much longer
        ...vs.filter((v) => who.has(v.user_id) && v.lunch_until && v.left_at && v.arrived_at >= madridMidnight(week)).map((v) => {
          const back = vs.filter((n) => n.user_id === v.user_id && n.arrived_at > v.left_at! && n.arrived_at < new Date(dayClosesAt(v.left_at!)).toISOString())
            .sort((a, b) => a.arrived_at.localeCompare(b.arrived_at))[0]?.arrived_at ?? null;
          const end = back ? Date.parse(back) : Math.min(now, dayClosesAt(v.left_at!));
          const ms = end - Date.parse(v.left_at!);
          return { id: `${v.id}-lunch`, at: v.left_at!, day: new Date(v.left_at!).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }), kind: "lunch" as const,
            name: who.get(v.user_id)!.full_name, from: madridTime(v.left_at!), to: back ? madridTime(back) : null, hours: hm(ms),
            zero: false, note: ms > LUNCH_MS ? `+${Math.round((ms - LUNCH_MS) / 60e3)} min` : null, start: null, end: null };
        }),
        // Away (trip, sick…): one line per day of this week up to today
        ...(absences ?? []).filter((x) => who.has(x.user_id)).flatMap((x) => Array.from({ length: 7 }, (_, i) => new Date(Date.parse(week + "T12:00:00Z") + i * DAY).toISOString().slice(0, 10))
          .filter((d) => d >= x.from_day && d <= x.to_day && d <= today).map((d) => ({
            id: `${x.id}-${d}`, at: `${d}T00:00`, day: d, kind: "away" as const, name: who.get(x.user_id)!.full_name,
            from: "", to: null, hours: "", zero: false, note: x.reason, start: null, end: null }))),
      ].sort((a, b) => a.at.localeCompare(b.at));
      return [...Map.groupBy(rows, (r) => r.day)].sort((a, b) => b[0].localeCompare(a[0])).map(([d, items]) => ({ day: fmtDay(d), items }));
    })(),
  };


  return (
    <div className="space-y-5">
      <LiveRefresh tables={["cards", "card_assignees", "card_checklist_items", "agenda_items", "week_plans", "sales", "weekly_reports", "scout_leads", "member_points", "office_visits"]} />
      <HomeDashboard d={home} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="panel p-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{t("due")}</h2>
            <Link href="/tasks?view=mine" className="text-xs text-muted hover:text-ink">{t("allTasks")}</Link>
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
          <OfficeCard d={office} />
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
