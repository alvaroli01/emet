import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptKey } from "@/lib/ai/keys";
import { normalizeGoogleIcalUrl, parseEvents } from "@/lib/gcal";
import { fetchIcal } from "@/lib/gcal-server";

/** A member connects / disconnects their own Google Calendar (secret iCal link). The link is checked, encrypted, and only used for them. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("google_calendars").select("user_id").maybeSingle();
  return NextResponse.json({ connected: !!data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_profile_id");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  const clean = normalizeGoogleIcalUrl(url ?? "");
  if (!clean) return NextResponse.json({ error: "format" }, { status: 400 });
  let ics: string;
  try { ics = await fetchIcal(clean); } catch { return NextResponse.json({ error: "unreachable" }, { status: 400 }); }
  try { parseEvents(ics, "2000-01-01", "2000-01-01"); } catch { return NextResponse.json({ error: "not_calendar" }, { status: 400 }); }
  const { key_iv, key_data } = encryptKey(clean);
  const { error } = await supabase.from("google_calendars").upsert({ user_id: me, url_iv: key_iv, url_data: key_data, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "save" }, { status: 500 });
  return NextResponse.json({ connected: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_profile_id");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await supabase.from("google_calendars").delete().eq("user_id", me);
  return NextResponse.json({ connected: false });
}
