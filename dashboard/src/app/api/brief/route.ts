import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { cardHref } from "@/lib/projects";
import { briefTasks, mondayOf, BRIEF_DAYS, type BriefItem } from "@/lib/daily-brief";

type CardRow = { id: string; title: string; due_at: string; boards: { group_id: string | null; project_id: string | null; owner_id: string | null } | null };
type LeadRow = { week_start: string; user_id: string; profiles: { full_name: string; avatar_url: string | null } | null };

/** The daily pop-up: my late tasks, my tasks for the next month, and this/next week's training leaders. Read as the member (RLS). */
export async function GET() {
  const sb = await createClient();
  const { data: me } = await sb.rpc("my_profile_id");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const today = todayISO();
  const thisWeek = mondayOf(today);
  const nextWeek = new Date(Date.parse(`${thisWeek}T12:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10);
  const until = new Date(Date.parse(`${today}T12:00:00Z`) + (BRIEF_DAYS + 1) * 864e5).toISOString().slice(0, 10);
  const [cards, leads] = await Promise.all([
    sb.from("cards").select("id, title, due_at, boards(group_id, project_id, owner_id), card_assignees!inner(user_id)")
      .eq("card_assignees.user_id", me).is("card_assignees.done_at", null).is("completed_at", null).not("due_at", "is", null).lt("due_at", `${until}T00:00:00Z`).returns<CardRow[]>(),
    sb.from("training_leaders").select("week_start, user_id, profiles!training_leaders_user_id_fkey(full_name, avatar_url)").in("week_start", [thisWeek, nextWeek]).returns<LeadRow[]>(),
  ]);
  const items: BriefItem[] = [
    ...(cards.data ?? []).map((c) => ({ id: c.id, title: c.title, due: c.due_at, href: cardHref(c) })),
  ];
  const people = (week: string) => (leads.data ?? []).filter((l) => l.week_start === week && l.profiles)
    .map((l) => ({ id: l.user_id, name: l.profiles!.full_name, avatar: l.profiles!.avatar_url }));
  return NextResponse.json({ today, ...briefTasks(items, today), training: { thisWeek: people(thisWeek), nextWeek: people(nextWeek) }, me });
}
