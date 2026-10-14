import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Group } from "@/lib/session";

const DAY = 864e5;
export type Engagement = "active" | "somewhat" | "inactive";

/** One row of the Team table: how present and productive someone was in the last 30 days. */
export type TeamRow = {
  id: string; name: string; avatar: string | null; role: string | null; team: string | null; joined: boolean;
  status: Engagement; usedApp: boolean; didTask: boolean; done: number; total: number; lastActive: string | null;
};

type Act = { user_id: string; day: string; group_id: string | null; n: number };
type CardRow = { id: string; title: string; due_at: string | null; completed_at: string | null; created_at: string; boards: { slug: string; name: string; group_id: string | null } | null; card_assignees: { user_id: string }[] };

/** Active = did something on 3+ different days in 30; somewhat = 1–2 days; inactive = nothing (or never logged in). */
export const engagement = (activeDays: number, joined: boolean): Engagement => (!joined || !activeDays ? "inactive" : activeDays >= 3 ? "active" : "somewhat");

async function load(since: number) {
  const sb = await createClient();
  const sinceIso = new Date(since).toISOString();
  const [acts, cards, last] = await Promise.all([
    sb.rpc("team_activity", { since: sinceIso }),
    sb.from("cards").select("id, title, due_at, completed_at, created_at, boards(slug, name, group_id), card_assignees!inner(user_id)")
      .or(`completed_at.is.null,completed_at.gte.${sinceIso}`).returns<CardRow[]>(),
    sb.from("activity_log").select("user_id, created_at").order("created_at", { ascending: false }).limit(1000),
  ]);
  return { acts: ((acts.data ?? []) as Act[]).map((a) => ({ ...a, n: Number(a.n) })), cards: cards.data ?? [], last: last.data ?? [] };
}

export async function loadTeamTable(people: Profile[], groups: Group[]): Promise<TeamRow[]> {
  const since = Date.now() - 30 * DAY;
  const { acts, cards, last } = await load(since);
  return people.filter((p) => p.active).map((p) => {
    const mine = cards.filter((c) => c.card_assignees.some((a) => a.user_id === p.id));
    const inWindow = mine.filter((c) => (c.completed_at && Date.parse(c.completed_at) >= since) || (c.due_at && Date.parse(c.due_at) >= since && Date.parse(c.due_at) <= Date.now()));
    const done = inWindow.filter((c) => c.completed_at).length;
    const days = new Set(acts.filter((a) => a.user_id === p.id).map((a) => a.day)).size;
    const lastActive = last.find((x) => x.user_id === p.id)?.created_at ?? acts.filter((a) => a.user_id === p.id).map((a) => a.day).sort().at(-1) ?? null;
    return {
      id: p.id, name: p.full_name, avatar: p.avatar_url, role: p.role_title, team: groups.find((g) => g.id === p.group_id)?.name ?? null, joined: !!p.user_id,
      status: engagement(days, !!p.user_id), usedApp: days > 0, didTask: done > 0, done, total: inWindow.length, lastActive,
    };
  });
}

/** Everything the member page (HireWise-style) shows about one person. */
export type MemberData = {
  inProgress: number; newThisWeek: number; completed7: number; completedPrev7: number;
  salesMonth: number; salesPrevMonth: number;
  weekPct: number;
  current: { title: string; href: string; due: string | null } | null;
  projects: { names: string[]; days: { label: string; values: number[] }[] };
  format: { own: number; elsewhere: number };
  due: { id: string; title: string; day: string; href: string; done: boolean }[];
};

export async function loadMember(person: Profile, groups: Group[], weekStartIso: string, locale: string, companyLabel: string): Promise<MemberData> {
  const sb = await createClient();
  const now = Date.now(), monthStart = new Date(); monthStart.setDate(1);
  const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const { acts, cards } = await load(now - 60 * DAY);
  const { data: sales } = await sb.from("sales").select("amount, date, rep_id, logged_by, reverses_id")
    .gte("date", iso(prevMonthStart)).or(`rep_id.eq.${person.id},logged_by.eq.${person.id}`);

  const slugOf = (gid: string | null) => groups.find((g) => g.id === gid)?.slug;
  const href = (c: CardRow) => (slugOf(c.boards?.group_id ?? null) ? `/g/${slugOf(c.boards!.group_id)}?card=${c.id}` : `/board?card=${c.id}`);
  const mine = cards.filter((c) => c.card_assignees.some((a) => a.user_id === person.id));
  const open = mine.filter((c) => !c.completed_at).sort((a, b) => (a.due_at ?? "9").localeCompare(b.due_at ?? "9"));
  const doneBetween = (from: number, to: number) => mine.filter((c) => c.completed_at && Date.parse(c.completed_at) >= from && Date.parse(c.completed_at) < to).length;
  const sum = (from: string, to?: string) => (sales ?? []).filter((s) => Number(s.amount) > 0 && !s.reverses_id && s.date >= from && (!to || s.date < to)).reduce((a, s) => a + Number(s.amount), 0);

  const myActs = acts.filter((a) => a.user_id === person.id);
  const weekDays = Array.from({ length: 5 }, (_, i) => iso(new Date(Date.parse(weekStartIso + "T00:00:00Z") + i * DAY)));
  const elapsed = Math.max(1, Math.min(5, weekDays.filter((d) => d <= iso(new Date())).length));
  const teamName = (gid: string | null) => groups.find((g) => g.id === gid)?.name ?? companyLabel;
  const weekActs = myActs.filter((a) => weekDays.includes(a.day));
  const names = [...new Set(weekActs.map((a) => teamName(a.group_id)))].slice(0, 4);
  const own = myActs.filter((a) => a.group_id && a.group_id === person.group_id).reduce((s, a) => s + a.n, 0);
  const all = myActs.reduce((s, a) => s + a.n, 0);

  return {
    inProgress: open.length, newThisWeek: mine.filter((c) => Date.parse(c.created_at) >= now - 7 * DAY).length,
    completed7: doneBetween(now - 7 * DAY, now + DAY), completedPrev7: doneBetween(now - 14 * DAY, now - 7 * DAY),
    salesMonth: sum(iso(monthStart)), salesPrevMonth: sum(iso(prevMonthStart), iso(monthStart)),
    weekPct: new Set(weekActs.map((a) => a.day)).size / elapsed,
    current: open[0] ? { title: open[0].title, href: href(open[0]), due: open[0].due_at } : null,
    projects: {
      names,
      days: weekDays.map((d) => ({
        label: new Date(d + "T12:00:00Z").toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }),
        values: names.map((nm) => weekActs.filter((a) => a.day === d && teamName(a.group_id) === nm).reduce((s, a) => s + a.n, 0)),
      })),
    },
    format: { own: all ? own / all : 0, elsewhere: all ? 1 - own / all : 0 },
    due: mine.filter((c) => c.due_at).map((c) => ({ id: c.id, title: c.title, day: c.due_at!.slice(0, 10), href: href(c), done: !!c.completed_at }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}
