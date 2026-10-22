import { getLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMembers } from "@/lib/boards";
import { weekStart } from "@/lib/metrics";
import { todayISO } from "@/lib/format";
import { SectionTabs } from "@/components/section-tabs";
import { PersonalDashboard, type PersonalData } from "@/components/camp/personal-dashboard";
import { WeekTab, type WeekPlan, type DueTask } from "@/components/camp/week";
import { AgendaTab, type AgendaItem } from "@/components/camp/agenda";
import { DocsTab, type Doc } from "@/components/camp/docs";
import { IdeasTab, type Idea } from "@/components/camp/ideas";
import { VaultTab } from "@/components/camp/vault";
import { cardHref } from "@/lib/projects";
import { loadMyGoogleEvents } from "@/lib/gcal-server";
import { loadMyNotionDeadlines } from "@/lib/notion/server";
import { NotionTab } from "@/components/notion/notion-tab";
import { loadMyProjects } from "@/lib/projects-server";
import { MyProjects } from "@/components/projects/my-projects";

type CardDue = { id: string; title: string; due_at: string; completed_at: string | null; boards: { slug: string; group_id: string | null } | null };
type SubDue = { id: string; text: string; due_on: string | null; done: boolean; cards: { id: string; title: string; boards: { slug: string; group_id: string | null } | null } | null };

/** Base camp: everyone's private working area. Only the owner can see it — the database enforces that. */
export default async function CampPage({ searchParams }: { searchParams: Promise<{ tab?: string; doc?: string }> }) {
  const { tab, doc: openDoc } = await searchParams;
  const t = await getTranslations("camp");
  const tp = await getTranslations("personal");
  const locale = await getLocale();
  const { me, groups } = await getSession();
  const supabase = await createClient();
  const week = weekStart(Date.now());
  const today = todayISO();

  const [plans, agenda, cards, subtasks, docs, ideas, vaultKey, vaultItems, members, aiKey] = await Promise.all([
    supabase.from("week_plans").select("*").eq("owner_id", me.id).order("week_start", { ascending: false }).limit(8).returns<WeekPlan[]>(),
    supabase.from("agenda_items").select("*").eq("owner_id", me.id).gte("day", today).order("day").order("start_time").returns<AgendaItem[]>(),
    supabase.from("cards").select("id, title, due_at, completed_at, boards(slug, group_id, project_id), card_assignees!inner(user_id)")
      .eq("card_assignees.user_id", me.id).is("completed_at", null).not("due_at", "is", null).returns<CardDue[]>(),
    supabase.from("card_checklist_items").select("id, text, due_on, done, cards(id, title, boards(slug, group_id, project_id))")
      .eq("assignee_id", me.id).eq("done", false).returns<SubDue[]>(),
    supabase.from("docs").select("*").order("pinned", { ascending: false }).order("updated_at", { ascending: false }).returns<Doc[]>(),
    supabase.from("ideas").select("*").eq("owner_id", me.id).order("created_at").returns<Idea[]>(),
    supabase.from("vault_keys").select("salt, check_iv, check_data").eq("owner_id", me.id).maybeSingle(),
    supabase.from("vault_items").select("id, iv, data").eq("owner_id", me.id).order("created_at"),
    loadMembers(),
    supabase.from("ai_keys").select("last4").maybeSingle(),
  ]);
  const weekEnd = new Date(Date.parse(week + "T00:00:00Z") + 7 * 864e5).toISOString();
  const notionWeek = loadMyNotionDeadlines(supabase, week, new Date(Date.parse(week + "T00:00:00Z") + 6 * 864e5).toISOString().slice(0, 10)); // my Notion deadlines
  const google = loadMyGoogleEvents(supabase, week, new Date(Date.parse(week + "T00:00:00Z") + 6 * 864e5).toISOString().slice(0, 10)); // in parallel
  const [openCards, weekCards, myLog, meetingsToday, reminders, boardMeta] = await Promise.all([
    supabase.from("cards").select("id, title, due_at, board_id, boards(slug, group_id, project_id), card_assignees!inner(user_id)")
      .eq("card_assignees.user_id", me.id).is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(12)
      .returns<{ id: string; title: string; due_at: string | null; board_id: string; boards: { slug: string; group_id: string | null; project_id: string | null } | null }[]>(),
    supabase.from("cards").select("id, title, due_at, completed_at, boards(slug, group_id, project_id), card_assignees!inner(user_id)")
      .eq("card_assignees.user_id", me.id).gte("due_at", week).lt("due_at", weekEnd)
      .returns<{ id: string; title: string; due_at: string; completed_at: string | null; boards: { slug: string; group_id: string | null; project_id: string | null } | null }[]>(),
    supabase.from("activity_log").select("created_at").eq("user_id", me.id).gte("created_at", week),
    supabase.from("meetings").select("id, title, kind, created_at").eq("meeting_date", today),
    supabase.from("reminders").select("id, title, remind_at, priority, done").eq("owner_id", me.id)
      .gte("remind_at", today).order("remind_at").limit(8),
    supabase.from("cards").select("board_id, boards(name, group_id), card_assignees!inner(user_id)").eq("card_assignees.user_id", me.id)
      .returns<{ board_id: string; boards: { name: string; group_id: string | null } | null }[]>(),
  ]);

  const link = (b: { slug: string; group_id: string | null; project_id?: string | null } | null | undefined, cardId: string) =>
    cardHref({ id: cardId, boards: b }, (gid) => groups.find((g) => g.id === gid)?.slug);

  // Everything with a date that is mine: cards I'm on, and small tasks given to me
  const due: DueTask[] = [
    ...(cards.data ?? []).map((c) => ({ id: c.id, title: c.title, day: c.due_at.slice(0, 10), href: link(c.boards, c.id), kind: "card" as const })),
    ...(subtasks.data ?? []).filter((s) => s.due_on && s.cards).map((s) => ({
      id: s.id, title: s.text, day: s.due_on!, href: link(s.cards!.boards, s.cards!.id), kind: "task" as const, parent: s.cards!.title,
    })),
  ].sort((a, b) => a.day.localeCompare(b.day));

  const allDocs = docs.data ?? [];
  const myDocs = allDocs.filter((d) => d.owner_id === me.id);
  const sharedDocs = allDocs.filter((d) => d.owner_id !== me.id);
  const thisWeek = (plans.data ?? []).find((p) => p.week_start === week) ?? null;
  const firstName = me.full_name.split(" ")[0];
  const prios = (thisWeek?.priorities ?? []).filter((x: string) => x.trim());
  const dayMs = Date.now() - Date.parse(week + "T00:00:00Z");
  const items = agenda.data ?? [];

  const teamName = (b: { group_id: string | null } | null | undefined) => (b?.group_id ? groups.find((g) => g.id === b.group_id)?.name ?? null : null);
  const tm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  // Activity: how many things I did each weekday (from the activity log), scaled to the busiest day
  const perDay = Array.from({ length: 5 }, (_, i) => { const d = new Date(Date.parse(week + "T00:00:00Z") + i * 864e5).toISOString().slice(0, 10); return (myLog.data ?? []).filter((x) => String(x.created_at).slice(0, 10) === d).length; });
  const peak = Math.max(1, ...perDay);
  const workedDays = Math.max(1, Math.min(5, Math.ceil(dayMs / 864e5)));
  const COLORS = ["#ff6a1a", "#ffc23d", "#f5f5f5", "#8b8b93", "#ff9f6b", "#5b5b63"];
  const byTeam = new Map<string, number>();
  for (const c of boardMeta.data ?? []) { const k = teamName(c.boards) ?? c.boards?.name ?? tp("company"); byTeam.set(k, (byTeam.get(k) ?? 0) + 1); }
  const workedTotal = [...byTeam.values()].reduce((a, b) => a + b, 0);
  const gEvents = (await google).events;
  const myProjects = await loadMyProjects(supabase, me.id);
  const gHref = (day: string) => `https://calendar.google.com/calendar/r/day/${day.replaceAll("-", "/")}`;
  const personal: PersonalData = {
    name: firstName, today, weekStart: week, focusTitle: prios.find((x: string) => !x.startsWith("✓ ")) ?? null,
    tasks: (openCards.data ?? []).map((c) => ({ id: c.id, title: c.title, href: link(c.boards, c.id), team: teamName(c.boards) })),
    meetings: [
      ...items.filter((x) => x.day === today).map((x) => ({ id: x.id, title: x.title, time: x.start_time?.slice(0, 5) ?? null, href: "/camp?tab=agenda#camp-tabs", kind: "agenda" as const })),
      ...(meetingsToday.data ?? []).map((m) => ({ id: m.id, title: m.title, time: tm(m.created_at), href: "/meetings", kind: "meeting" as const })),
      ...gEvents.filter((g) => g.day === today).map((g) => ({ id: `g:${g.id}`, title: g.title, time: g.start, href: gHref(g.day), kind: "google" as const })),
    ].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99")),
    week: [...(weekCards.data ?? []).map((c) => {
      const day = c.due_at.slice(0, 10);
      return { id: c.id, title: c.title, day, href: link(c.boards, c.id), team: teamName(c.boards),
        status: c.completed_at ? "done" as const : day < today ? "late" as const : day === today ? "today" as const : "planned" as const };
    }),
      // Google Calendar events (if connected), in time order after the day's tasks
      ...gEvents.map((g) => ({ id: `g:${g.id}`, title: g.title, day: g.day, href: gHref(g.day), team: null, status: "google" as const,
        time: g.allDay ? null : `${g.start}${g.end ? `–${g.end}` : ""}` })),
      // Notion deadlines (if I picked a deadlines database)
      ...(await notionWeek).items.map((n) => ({ id: `n:${n.id}`, title: n.title, day: n.day, href: n.url, team: null, status: "notion" as const,
        time: n.start ? `${n.start}${n.end ? `–${n.end}` : ""}` : null }))],
    activity: perDay.map((n, i) => ({ label: new Date(Date.parse(week + "T12:00:00Z") + i * 864e5).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }), pct: n / peak })),
    activityPct: perDay.slice(0, workedDays).filter((n) => n > 0).length / workedDays,
    worked: [...byTeam].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n], i) => ({ name, color: COLORS[i], share: n / workedTotal })),
    reminders: (reminders.data ?? []) as PersonalData["reminders"],
  };

  return (
    <div className="space-y-6">
      <PersonalDashboard d={personal} />
      <MyProjects projects={myProjects} today={today} />
      <div id="camp-tabs" className="scroll-mt-20" />

      <SectionTabs label={t("sections")} initial={tab} tabs={[
        { id: "week", label: t("tabs.week"), node: <WeekTab week={week} plan={thisWeek} past={(plans.data ?? []).filter((p) => p.week_start !== week)} due={due} meId={me.id} /> },
        { id: "agenda", label: t("tabs.agenda"), node: <AgendaTab items={agenda.data ?? []} due={due} today={today} /> },
        { id: "docs", label: t("tabs.docs"), node: <DocsTab mine={myDocs} shared={sharedDocs} members={members} meId={me.id} ai={{ connected: !!aiKey.data, last4: aiKey.data?.last4 ?? null }} initialOpen={openDoc} /> },
        { id: "ideas", label: t("tabs.ideas"), node: <IdeasTab ideas={ideas.data ?? []} meId={me.id} /> },
        { id: "notion", label: t("tabs.notion"), node: <NotionTab meId={me.id} /> },
        { id: "vault", label: t("tabs.vault"), node: <VaultTab keyRow={vaultKey.data} items={vaultItems.data ?? []} meId={me.id} /> },
      ]} />
    </div>
  );
}
