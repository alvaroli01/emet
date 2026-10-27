import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { archiveBatch } from "@/lib/drive";
import { buildWeeklyReport } from "@/lib/weekly-report";
import { syncBooks, snapshotXlsx } from "@/lib/books";

/**
 * Daily keep-alive (Vercel Cron). A free Supabase project pauses after 7 days without activity —
 * this touches the database once a day so the dashboard is never asleep after a holiday.
 * Also a quick health check: open it with the cron secret to see that the database answers.
 * Housekeeping: deletes recordings older than AUDIO_DAYS (free storage is 1 GB); transcripts stay.
 */
const AUDIO_DAYS = 60;
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const started = Date.now();
  const { count, error } = await db.from("groups").select("id", { count: "exact", head: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  const ms = Date.now() - started;

  const { data: expired } = await db.rpc("expired_recordings", { p_days: AUDIO_DAYS });
  const names = (expired as string[] | null) ?? [];
  let removed = 0;
  for (let i = 0; i < names.length; i += 100) {
    const { data } = await db.storage.from("recordings").remove(names.slice(i, i + 100));
    removed += data?.length ?? 0;
  }
  const { data: docsMarked } = await db.rpc("mark_audio_expired", { p_days: AUDIO_DAYS });
  // Workspace automation: repeating tasks, "due tomorrow" reminders, subscription charges, Monday training-leader reminders, Sunday "who leads training next week" for everyone, the Friday report
  const [{ data: repeated }, { data: reminders }, { data: subscriptions }, { data: trainingLeads }, { data: trainingWeek }] = await Promise.all([
    db.rpc("run_recurring"), db.rpc("notify_due_tomorrow"), db.rpc("run_subscriptions"), db.rpc("notify_training_leaders"), db.rpc("notify_training_week")]);
  let report: string | null = null;
  const madrid = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  if (madrid.getDay() === 5) {
    const data = await buildWeeklyReport(db);
    const { error: exists } = await db.from("weekly_reports").insert({ week_start: data.week, data });
    if (!exists) {
      report = data.week;
      const { data: people } = await db.rpc("active_member_ids");
      await db.from("notifications").insert(((people as string[] | null) ?? []).map((u) => ({ user_id: u, kind: "report", data: { week: data.week }, link: "/today", dedupe: `report:${data.week}` })));
    }
  }
  // Finance: retry any queued Google Sheet writes, then keep a dated .xlsx copy in Drive
  const books = await syncBooks().catch((e) => ({ error: String(e) }));
  const snapshot = await snapshotXlsx().catch(() => null);
  // Meeting audio older than 30 days → Google Drive (the nightly GitHub job does the bulk; this is the fallback)
  const archive = await archiveBatch(15_000);
  return NextResponse.json({ ok: true, groups: count, ms, audioRemoved: removed, docsMarked, repeated, reminders, subscriptions, trainingLeads, trainingWeek, report, books, snapshot, archive, at: new Date().toISOString() });
}
