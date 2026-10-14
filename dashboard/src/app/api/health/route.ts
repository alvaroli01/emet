import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Daily keep-alive (Vercel Cron). A free Supabase project pauses after 7 days without activity —
 * this touches the database once a day so the dashboard is never asleep after a holiday.
 * Also a quick health check: open it with the cron secret to see that the database answers.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const started = Date.now();
  const { count, error } = await db.from("groups").select("id", { count: "exact", head: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  return NextResponse.json({ ok: true, groups: count, ms: Date.now() - started, at: new Date().toISOString() });
}
