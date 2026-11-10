import { NextResponse, type NextRequest } from "next/server";
import { createClient as admin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { applyEvent } from "@/lib/office";

/** The Check in / Check out button on Today (fallback when the phone automation isn't set up). Only for yourself. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const [{ data: me }, { data: member }] = await Promise.all([supabase.rpc("my_profile_id"), supabase.rpc("is_member")]);
  if (!me || !member) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { event } = (await request.json().catch(() => ({}))) as { event?: string };
  if (event !== "arrive" && event !== "leave") return NextResponse.json({ error: "bad event" }, { status: 400 });
  const db = admin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await applyEvent(db, me as string, event, "manual");
  return NextResponse.json({ ok: true });
}
