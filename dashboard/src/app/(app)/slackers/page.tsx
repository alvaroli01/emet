import { getTranslations } from "next-intl/server";
import { Siren } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMembers } from "@/lib/boards";
import { weekStart } from "@/lib/metrics";
import { madridDay, madridMidnight, visitMs, type Visit } from "@/lib/office";
import { PageHero } from "@/components/shell/page-hero";
import { Slackers, type SlackerRow } from "@/components/slackers/slackers";

const DAY = 864e5;
type BoardRow = { user_id: string; self_score: number | null; class_avg: number | string | null; class_n: number; tasks: { title: string; done_at: string }[] };
type Act = { user_id: string; day: string; n: number | string };
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);

/** Exposing Slackers: every week, how you think you worked vs. how the class thinks you worked vs. what emet shows you did. */
export default async function SlackersPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const { me } = await getSession();
  const supabase = await createClient();
  const now = Date.now();
  const today = madridDay(now);
  const thisWeek = weekStart(today);
  // On Mondays the session is about last week; any other day, about this week
  const fallback = new Date(today + "T12:00:00Z").getUTCDay() === 1 ? addDays(thisWeek, -7) : thisWeek;
  const week = w && /^\d{4}-\d{2}-\d{2}$/.test(w) && weekStart(w) === w && w <= thisWeek ? w : fallback;
  const next = addDays(week, 7);

  const [members, board, votes, notes, visits, acts, away] = await Promise.all([
    loadMembers(),
    supabase.rpc("slacker_board", { ws: week }),
    supabase.from("slacker_votes").select("target_id, score").eq("week_start", week).eq("voter_id", me.id).returns<{ target_id: string; score: number }[]>(),
    supabase.from("slacker_notes").select("user_id, note").eq("week_start", week).returns<{ user_id: string; note: string }[]>(),
    supabase.from("office_visits").select("id, user_id, arrived_at, left_at, forgot")
      .gte("arrived_at", madridMidnight(week)).lt("arrived_at", madridMidnight(next)).returns<Visit[]>(),
    supabase.rpc("team_activity", { since: madridMidnight(week) }),
    // Away (trips, sick days): shown so nobody gets exposed for a week they weren't here
    supabase.from("office_absences").select("user_id, from_day, to_day, reason").lte("from_day", addDays(week, 6)).gte("to_day", week)
      .returns<{ user_id: string; from_day: string; to_day: string; reason: string }[]>(),
  ]);

  const byId = new Map(((board.data ?? []) as BoardRow[]).map((b) => [b.user_id, b]));
  const rows: SlackerRow[] = members.filter((m) => !m.is_coach && byId.has(m.id)).map((m) => {
    const b = byId.get(m.id)!;
    const mine = ((acts.data ?? []) as Act[]).filter((a) => a.user_id === m.id && a.day < next);
    return {
      id: m.id, name: m.full_name, avatar: m.avatar_url,
      self: b.self_score, classAvg: b.class_avg === null ? null : Number(b.class_avg), classN: b.class_n,
      tasks: b.tasks.map((t) => t.title),
      officeMs: (visits.data ?? []).filter((v) => v.user_id === m.id).reduce((s, v) => s + visitMs(v, now), 0),
      activeDays: new Set(mine.map((a) => a.day)).size,
      actions: mine.reduce((s, a) => s + Number(a.n), 0),
      note: (notes.data ?? []).find((n) => n.user_id === m.id)?.note ?? null,
      away: (away.data ?? []).find((a) => a.user_id === m.id)?.reason ?? null,
    };
  });

  const tn = await getTranslations("nav");
  const t = await getTranslations("slackers");
  const voted = (votes.data ?? []).length;
  return (
    <div className="space-y-6">
      <PageHero section={{ label: tn("slackers"), icon: <Siren size={16} /> }} title={t("title")} subtitle={t("subtitle")}
        stats={[{ label: t("statVoted"), value: rows.filter((r) => r.self !== null).length, kind: "num" }, { label: t("statMine"), value: voted, kind: "num" }]} />
      <Slackers key={week} week={week} prev={addDays(week, -7)} next={next <= thisWeek ? next : null} canVote={week >= addDays(thisWeek, -7) && !me.is_coach && !me.is_guest}
        meId={me.id} rows={rows} myVotes={Object.fromEntries((votes.data ?? []).map((v) => [v.target_id, v.score]))} />
    </div>
  );
}
