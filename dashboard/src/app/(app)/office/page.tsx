import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { visitMs, isInNow, isOutsideDay, isWorkday, madridTime, madridMidnight, madridDay, dayClosesAt, type Visit } from "@/lib/office";
import { OfficeTap } from "@/components/office/office-tap";

/** One-tap check-in page: the 9:00 / 18:00 / "still working outside?" notifications open it (?go=in|out|still). */
export default async function OfficePage({ searchParams }: { searchParams: Promise<{ go?: string }> }) {
  const { go } = await searchParams;
  const { me } = await getSession();
  const supabase = await createClient();
  const now = Date.now();
  const [{ data: day }, { data: outside }] = await Promise.all([
    // My stretches today: the big clock shows the whole day (it carries on after a pause instead of starting again)
    supabase.from("office_visits").select("id, user_id, arrived_at, left_at, forgot, lunch_until").eq("user_id", me.id)
      .or(`arrived_at.gte.${madridMidnight(madridDay(now))},left_at.is.null`).order("arrived_at").returns<(Visit & { lunch_until: string | null })[]>(),
    supabase.from("office_outside").select("note, started_at").eq("user_id", me.id).is("ended_at", null).maybeSingle<{ note: string; started_at: string }>(),
  ]);
  const mine = day ?? [];
  const open = mine.find((v) => !v.left_at);
  const last = mine[mine.length - 1];
  const doneMs = mine.filter((v) => v.left_at).reduce((a, v) => a + visitMs(v, now), 0);
  const state = open && isInNow(open, now) ? { kind: "in" as const, since: madridTime(open.arrived_at), at: open.arrived_at }
    : last?.lunch_until && last.left_at && now < dayClosesAt(now) ? { kind: "lunch" as const, since: madridTime(last.left_at), at: last.left_at } // paused, back later
    : outside ? { kind: "outside" as const, since: madridTime(outside.started_at), at: outside.started_at, note: outside.note }
    : { kind: "none" as const };
  return <OfficeTap state={state} doneMs={doneMs} workday={isWorkday(now)} outsideDay={isOutsideDay(now)} go={["in", "out", "still"].includes(go ?? "") ? go : undefined} />;
}
