import { createClient } from "@supabase/supabase-js";
import { applyEvent, madridTime } from "@/lib/office";

/**
 * Automatic office check-in. The member's phone automation (iPhone Shortcuts / Android MacroDroid: "arrive at" /
 * "leave" the office) sends POST /api/office/<token>?event=arrive|leave — no app open, mobile data is fine.
 * POST only, so a link preview (WhatsApp etc.) can never check someone in. The token is the key; reset it on Today.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = new URL(request.url).searchParams.get("event");
  if (!/^[a-f0-9]{40,80}$/.test(token) || (event !== "arrive" && event !== "leave")) return new Response("Not found", { status: 404 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: link } = await db.from("office_links").select("user_id, profiles(active)").eq("token", token)
    .maybeSingle<{ user_id: string; profiles: { active: boolean } | null }>();
  if (!link?.profiles?.active) return new Response("Not found", { status: 404 });
  const { arrivedAt } = await applyEvent(db, link.user_id, event, "phone");
  const time = madridTime(event === "arrive" && arrivedAt ? arrivedAt : new Date().toISOString());
  return new Response(event === "arrive" ? `emet: checked in ${time}` : `emet: checked out ${time}`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
