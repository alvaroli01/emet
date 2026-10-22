import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signState } from "@/lib/notion/state";
import { oauthConfigured, redirectUri } from "@/lib/notion/server";

/** "Connect Notion": send the member to Notion's own page picker, with a state signed for them (10 minutes). */
export async function GET(request: NextRequest) {
  const sb = await createClient();
  const { data: me } = await sb.rpc("my_profile_id");
  if (!me) return NextResponse.redirect(new URL("/login", request.url));
  if (!oauthConfigured()) return NextResponse.redirect(new URL(`/team/${me}?notion=setup#connections`, request.url));
  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("client_id", process.env.NOTION_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("redirect_uri", redirectUri(request.nextUrl.origin));
  url.searchParams.set("state", signState(me as string));
  return NextResponse.redirect(url);
}
