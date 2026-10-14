import { createClient } from "@supabase/supabase-js";

/**
 * Private calendar feed (iCalendar). Google/Apple/Outlook subscribe to this URL and refresh it on their own:
 * your card due dates, your small tasks and your agenda. The long random token in the URL is the key —
 * reset it from Base camp if it ever leaks.
 */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const day = (d: string) => d.slice(0, 10).replace(/-/g, "");
const nextDay = (d: string) => new Date(Date.parse(d.slice(0, 10) + "T12:00:00Z") + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n "); // RFC 5545 line folding

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.ics$/, "");
  if (!/^[a-f0-9]{40,80}$/.test(clean)) return new Response("Not found", { status: 404 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: feed } = await db.from("calendar_feeds").select("user_id").eq("token", clean).maybeSingle();
  if (!feed) return new Response("Not found", { status: 404 });
  const me = feed.user_id as string;
  const origin = new URL(request.url).origin;

  const [profile, groups, cards, subtasks, agenda] = await Promise.all([
    db.from("profiles").select("full_name, active").eq("id", me).single(),
    db.from("groups").select("id, slug"),
    db.from("cards").select("id, title, due_at, boards(group_id), card_assignees!inner(user_id)").eq("card_assignees.user_id", me).is("completed_at", null).not("due_at", "is", null),
    db.from("card_checklist_items").select("id, text, due_on, done, cards(id, title, boards(group_id))").eq("assignee_id", me).eq("done", false).not("due_on", "is", null),
    db.from("agenda_items").select("id, title, day, start_time, end_time, done").eq("owner_id", me).gte("day", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)),
  ]);
  if (!profile.data?.active) return new Response("Not found", { status: 404 });
  const slug = new Map((groups.data ?? []).map((g) => [g.id, g.slug]));
  const link = (gid: string | null | undefined, id: string) => `${origin}${gid && slug.get(gid) ? `/g/${slug.get(gid)}` : "/board"}?card=${id}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

  const events: string[][] = [];
  for (const c of (cards.data ?? []) as unknown as { id: string; title: string; due_at: string; boards: { group_id: string | null } | null }[]) {
    events.push([`UID:card-${c.id}@emet-hq`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(c.due_at)}`, `DTEND;VALUE=DATE:${nextDay(c.due_at)}`,
      `SUMMARY:${esc(`✓ ${c.title}`)}`, `URL:${link(c.boards?.group_id, c.id)}`, `DESCRIPTION:${esc(link(c.boards?.group_id, c.id))}`]);
  }
  for (const s of (subtasks.data ?? []) as unknown as { id: string; text: string; due_on: string; cards: { id: string; title: string; boards: { group_id: string | null } | null } | null }[]) {
    if (!s.cards) continue;
    events.push([`UID:task-${s.id}@emet-hq`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(s.due_on)}`, `DTEND;VALUE=DATE:${nextDay(s.due_on)}`,
      `SUMMARY:${esc(`✓ ${s.text} (${s.cards.title})`)}`, `URL:${link(s.cards.boards?.group_id, s.cards.id)}`]);
  }
  for (const a of agenda.data ?? []) {
    const start = a.start_time ? `DTSTART;TZID=Europe/Madrid:${day(a.day)}T${a.start_time.replace(/:/g, "").slice(0, 6).padEnd(6, "0")}` : `DTSTART;VALUE=DATE:${day(a.day)}`;
    const end = a.start_time
      ? `DTEND;TZID=Europe/Madrid:${day(a.day)}T${(a.end_time ?? a.start_time).replace(/:/g, "").slice(0, 6).padEnd(6, "0")}`
      : `DTEND;VALUE=DATE:${nextDay(a.day)}`;
    events.push([`UID:agenda-${a.id}@emet-hq`, `DTSTAMP:${stamp}`, start, end, `SUMMARY:${esc(a.title)}`, ...(a.done ? ["STATUS:CANCELLED"] : []), `URL:${origin}/camp?tab=agenda`]);
  }

  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//emet HQ//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`emet HQ · ${profile.data.full_name}`)}`, "X-WR-TIMEZONE:Europe/Madrid",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
    ...events.flatMap((e) => ["BEGIN:VEVENT", ...e, "END:VEVENT"]),
    "END:VCALENDAR",
  ].map(fold).join("\r\n");
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" } });
}
