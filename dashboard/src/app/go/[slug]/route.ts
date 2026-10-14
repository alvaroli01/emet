import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * emet short links (/go/<slug>): free replacement for Linktree/Bitly. Logs the click, adds UTM tags,
 * then sends the visitor on. Used for the Instagram bio link and the QR codes at stalls.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: link } = await db.from("go_links").select("id, destination, utm_source, utm_medium, utm_campaign, slug").eq("slug", slug.toLowerCase()).maybeSingle();
  if (!link) return NextResponse.redirect(new URL("/", request.url));
  const ua = request.headers.get("user-agent") ?? "";
  const device = /mobile|iphone|android/i.test(ua) ? "mobile" : /bot|crawl|spider|preview/i.test(ua) ? "bot" : "desktop";
  if (device !== "bot") {
    await db.from("go_clicks").insert({ link_id: link.id, referrer: (request.headers.get("referer") ?? "").slice(0, 200) || null, device });
  }
  const to = new URL(link.destination);
  to.searchParams.set("utm_source", link.utm_source);
  to.searchParams.set("utm_medium", link.utm_medium);
  to.searchParams.set("utm_campaign", link.utm_campaign || link.slug);
  return NextResponse.redirect(to, 302);
}
