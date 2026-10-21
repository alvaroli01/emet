import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { decryptKey } from "@/lib/ai/keys";
import { totals, weekStart, onTimeRate, pace, type Sale, type Expense, type CardLite } from "@/lib/metrics";
import { todayISO } from "@/lib/format";
import { loadMyGoogleEvents } from "@/lib/gcal-server";
import { scheduleRange, buildMySchedule, scheduleLines } from "@/lib/my-schedule";

export const maxDuration = 60;
const LANG: Record<string, string> = { en: "English", es: "Spanish", de: "German", fr: "French", fi: "Finnish", "pt-BR": "Brazilian Portuguese", ru: "Russian" };

/**
 * Ask emet: answers questions from the team's own data, with the asker's free Groq key.
 * The data snapshot is read as the asker, so it never contains anything they couldn't open themselves.
 */
export async function POST(request: NextRequest) {
  const { question, history } = (await request.json().catch(() => ({}))) as { question?: string; history?: unknown };
  if (!question?.trim() || question.length > 500) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  // Earlier turns of the same conversation, so follow-ups ("and last month?") make sense. Only plain text, last 8 turns.
  const past = (Array.isArray(history) ? history : [])
    .filter((m): m is { role: "user" | "assistant"; content: string } => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const supabase = await createClient();
  const { data: keyRow } = await supabase.from("ai_keys").select("key_iv, key_data").maybeSingle();
  if (!keyRow) return NextResponse.json({ error: "no-key" }, { status: 400 });

  const now = Date.now();
  const [me, sales, expenses, cards, people, groups, blockers, meetings, ideas, decisions, kpis] = await Promise.all([
    supabase.rpc("my_profile_id"),
    supabase.from("sales").select("date, amount, cost, channel").returns<(Sale & { channel: string | null })[]>(),
    supabase.from("expenses").select("date, amount, category").returns<(Expense & { category: string | null })[]>(),
    supabase.from("cards").select("id, title, due_at, completed_at, board_id, boards(slug), card_assignees(user_id)").limit(400),
    supabase.from("profiles").select("id, full_name, role_title, group_id, is_admin").eq("active", true),
    supabase.from("groups").select("id, slug, name"),
    supabase.from("blockers").select("description, group_id, created_at").eq("status", "open").limit(20),
    supabase.from("meetings").select("title, kind, meeting_date, notes").eq("status", "ready").order("meeting_date", { ascending: false }).limit(8),
    supabase.from("lab_ideas").select("title, score, analysis->>verdict").order("score", { ascending: false, nullsFirst: false }).limit(10),
    supabase.from("decisions").select("date, decision").order("date", { ascending: false }).limit(10),
    supabase.from("kpi_targets").select("metric, role_title, target, period, group_id"),
  ]);
  // The asker's own schedule (last 14 → next 60 days): only their rows, read as them
  const today = todayISO();
  const { from, to } = scheduleRange(today);
  const [myCards, mySubtasks, myTeamTasks, myPlans, google] = await Promise.all([
    supabase.from("cards").select("title, due_at, completed_at, boards(slug), card_assignees!inner(user_id)").eq("card_assignees.user_id", me.data)
      .gte("due_at", `${from}T00:00:00Z`).lte("due_at", `${to}T23:59:59Z`).limit(300),
    supabase.from("card_checklist_items").select("text, due_on, cards(title)").eq("assignee_id", me.data).eq("done", false).gte("due_on", from).lte("due_on", to).limit(300),
    supabase.from("team_task_people").select("done_at, team_tasks(title, due_on)").eq("user_id", me.data).limit(300),
    supabase.from("agenda_items").select("title, day, start_time, end_time, done").eq("owner_id", me.data).gte("day", from).lte("day", to).limit(300),
    loadMyGoogleEvents(supabase, from, to),
  ]);
  const mySchedule = buildMySchedule({
    today, from, to, google,
    cards: ((myCards.data ?? []) as unknown as { title: string; due_at: string; completed_at: string | null; boards: { slug: string } | null }[])
      .map((c) => ({ title: c.title, board: c.boards?.slug, due_at: c.due_at, completed_at: c.completed_at })),
    subtasks: ((mySubtasks.data ?? []) as unknown as { text: string; due_on: string; cards: { title: string } | null }[])
      .map((x) => ({ text: x.text, card: x.cards?.title, due_on: x.due_on })),
    teamTasks: ((myTeamTasks.data ?? []) as unknown as { done_at: string | null; team_tasks: { title: string; due_on: string | null } | null }[])
      .flatMap((x) => (x.team_tasks ? [{ title: x.team_tasks.title, due_on: x.team_tasks.due_on, done_at: x.done_at }] : [])),
    plans: myPlans.data ?? [],
  });

  const name = new Map((people.data ?? []).map((p) => [p.id, p.full_name]));
  const gname = new Map((groups.data ?? []).map((g) => [g.id, g.slug]));
  const s = sales.data ?? [], e = expenses.data ?? [];
  const all = totals(s, e);
  const byWeek = new Map<string, { revenue: number; expenses: number }>();
  for (const x of s) { const w = weekStart(x.date); const r = byWeek.get(w) ?? { revenue: 0, expenses: 0 }; r.revenue += Number(x.amount); byWeek.set(w, r); }
  for (const x of e) { const w = weekStart(x.date); const r = byWeek.get(w) ?? { revenue: 0, expenses: 0 }; r.expenses += Number(x.amount); byWeek.set(w, r); }
  const c = (cards.data ?? []) as unknown as { title: string; due_at: string | null; completed_at: string | null; board_id: string; boards: { slug: string } | null; card_assignees: { user_id: string }[] }[];
  const open = c.filter((x) => !x.completed_at);
  const overdue = open.filter((x) => x.due_at && Date.parse(x.due_at) < now);
  const snapshot = {
    today: new Date(now).toISOString().slice(0, 10),
    asked_by: name.get(me.data as string) ?? null,
    my_schedule: { covers: mySchedule.range, google_calendar: mySchedule.google_calendar, entries: scheduleLines(mySchedule.items) },
    goal: "€30,000 revenue and €15,000 profit by 2027-06-30, min 50% margin",
    money: { ...all, ...pace(all.revenue, all.profit, now), sales_count: s.length,
      by_week: [...byWeek.entries()].sort().slice(-10).map(([week, v]) => ({ week, ...v })),
      by_channel: Object.entries(s.reduce<Record<string, number>>((a, x) => ({ ...a, [x.channel ?? "unknown"]: (a[x.channel ?? "unknown"] ?? 0) + Number(x.amount) }), {})) },
    tasks: { open: open.length, overdue: overdue.length, on_time_rate: onTimeRate(c as unknown as CardLite[], now).rate,
      overdue_list: overdue.slice(0, 25).map((x) => ({ title: x.title, board: x.boards?.slug, due: x.due_at?.slice(0, 10), people: x.card_assignees.map((a) => name.get(a.user_id)) })),
      due_next_7_days: open.filter((x) => x.due_at && Date.parse(x.due_at) >= now && Date.parse(x.due_at) < now + 7 * 864e5)
        .slice(0, 25).map((x) => ({ title: x.title, board: x.boards?.slug, due: x.due_at?.slice(0, 10), people: x.card_assignees.map((a) => name.get(a.user_id)) })) },
    team: (people.data ?? []).map((p) => ({ name: p.full_name, group: p.group_id ? gname.get(p.group_id) : null, role: p.role_title, admin: p.is_admin })),
    blockers: (blockers.data ?? []).map((b) => ({ text: b.description, group: gname.get(b.group_id), since: b.created_at.slice(0, 10) })),
    recent_meetings: (meetings.data ?? []).map((m) => ({ title: m.title, kind: m.kind, date: m.meeting_date, notes: m.notes.slice(0, 700) })),
    idea_lab: (ideas.data ?? []).map((i) => ({ title: i.title, score: i.score, verdict: (i as unknown as { verdict: string }).verdict })),
    decisions: decisions.data ?? [],
    kpi_targets: (kpis.data ?? []).map((k) => ({ metric: k.metric, role: k.role_title, target: k.target, period: k.period, group: gname.get(k.group_id) })),
  };

  const locale = await getLocale();
  const body = (model: string) => JSON.stringify({
    model, temperature: 0.2, ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
    messages: [
      { role: "system", content: `You are "emet", the assistant inside the emet HQ team dashboard. This is a conversation: use the earlier messages to understand follow-up questions. Answer ONLY from the JSON data below; if the data doesn't contain the answer, say so plainly and suggest where in the dashboard to find or add it. Be short and concrete (numbers, names, dates). Talk like a teammate: never mention the JSON, field names (like by_week) or "the data". Write money like €1,495.50. Use simple Markdown (bold, short lists). Answer in ${LANG[locale] ?? "English"}. Money in euros. For questions about the asker's own schedule, tasks, plans, exams, free time or what they had on a past day, answer from my_schedule (it covers ${from} to ${to}): go day by day with weekday, date and times, and say which items are Google Calendar events and which are emet plans or tasks. If my_schedule.google_calendar is "not connected" or "couldn't be loaded", say their Google events aren't included and why. If something is outside that range or not there, say so plainly.\n\nDATA:\n${JSON.stringify(snapshot).slice(0, 24000)}` },
      ...past,
      { role: "user", content: question.trim() },
    ],
  });
  const key = decryptKey(keyRow);
  for (const model of ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body(model) });
    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return NextResponse.json({ answer: data.choices?.[0]?.message?.content?.trim() ?? "" });
    }
    if (res.status === 401 || res.status === 403) return NextResponse.json({ error: "bad-key" }, { status: 400 });
    if (res.status !== 429 && res.status !== 413 && res.status !== 404 && res.status !== 400) break;
  }
  return NextResponse.json({ error: "limit" }, { status: 429 });
}
