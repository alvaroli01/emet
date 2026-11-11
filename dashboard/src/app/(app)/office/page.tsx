import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { isInNow, isOutsideDay, isWorkday, madridTime, type Visit } from "@/lib/office";
import { OfficeTap } from "@/components/office/office-tap";

/** One-tap check-in page: the 9:00 / 18:00 / "still working outside?" notifications open it (?go=in|out|still). */
export default async function OfficePage({ searchParams }: { searchParams: Promise<{ go?: string }> }) {
  const { go } = await searchParams;
  const { me } = await getSession();
  const supabase = await createClient();
  const now = Date.now();
  const [{ data: open }, { data: outside }, { data: lunch }] = await Promise.all([
    supabase.from("office_visits").select("id, user_id, arrived_at, left_at, forgot").eq("user_id", me.id).is("left_at", null).maybeSingle<Visit>(),
    supabase.from("office_outside").select("note, started_at").eq("user_id", me.id).is("ended_at", null).maybeSingle<{ note: string; started_at: string }>(),
    supabase.from("office_visits").select("lunch_until").eq("user_id", me.id).gt("lunch_until", new Date(now).toISOString()).maybeSingle<{ lunch_until: string }>(),
  ]);
  const state = open && isInNow(open, now) ? { kind: "in" as const, since: madridTime(open.arrived_at) }
    : lunch ? { kind: "lunch" as const, since: madridTime(lunch.lunch_until) }
    : outside ? { kind: "outside" as const, since: madridTime(outside.started_at), note: outside.note }
    : { kind: "none" as const };
  return <OfficeTap state={state} workday={isWorkday(now)} outsideDay={isOutsideDay(now)} go={["in", "out", "still"].includes(go ?? "") ? go : undefined} />;
}
